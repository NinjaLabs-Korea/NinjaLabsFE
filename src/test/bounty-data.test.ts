import { afterEach, describe, expect, it, vi } from "vitest";
import { rewardToBaseUnits as toBaseUnits, toReward, toRewards } from "@/lib/api/codecs";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public")>()),
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { PublicApiError, settle } = await import("@/lib/api/public");
const { pickGuideBounties, deliverablesFromMarkdown, getBounties, getRuntimeBounties, getRuntimeBounty, toBountyStatus, toPublicBountyStatus } = await import("@/lib/bounties");

const row = (id: string, rewards = [{ symbol: "INJ", amount: "1500000000000000000", tokenType: "NATIVE" }]) => ({
  id, title: id, summary: "", sponsor_name: "S", category: "DEV", status: "OPEN",
  application_required: false, submission_mode: "DIRECT", cover_image_url: null,
  application_deadline: null, submission_deadline: "2099-01-01T00:00:00Z", rewards,
});

describe("reward conversion", () => {
  it("uses per-token decimals without floating-point loss", () => {
    expect(toReward({ symbol: "INJ", amount: "1500000000000000000" })).toEqual({ amount: 1.5, currency: "INJ" });
    expect(toReward({ symbol: "USDC", amount: "250000000" })).toEqual({ amount: 250, currency: "USDC" });
    expect(toBaseUnits({ amount: 250, currency: "USDC" })).toBe("250000000");
  });

  it("drops unknown symbols and malformed amounts", () => {
    expect(toReward({ symbol: "ATOM", amount: "1" })).toBeNull();
    expect(toReward({ symbol: "INJ", amount: "1.5" })).toBeNull();
    expect(toRewards([{ symbol: "USDC", amount: "1000000" }, { symbol: "ATOM", amount: "1" }])).toEqual([{ amount: 1, currency: "USDC" }]);
  });
});

describe("bounty mapping", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("extracts deliverables from markdown list items only", () => {
    expect(deliverablesFromMarkdown("Intro paragraph.\n\n- A **public** repo\n* [Preview](https://x.test) URL\n1. `README`\nNot a list")).toEqual([
      "A public repo",
      "Preview URL",
      "README",
    ]);
    expect(deliverablesFromMarkdown(undefined)).toEqual([]);
  });

  it("extracts deliverables from a CRLF body too", () => {
    expect(deliverablesFromMarkdown("Intro\r\n\r\n- Repo\r\n- Preview URL\r\n")).toEqual(["Repo", "Preview URL"]);
  });

  it("flags an application-required bounty whose application deadline has passed", async () => {
    const past = { ...row("late"), application_required: true, application_deadline: "2020-01-01T00:00:00Z" };
    const future = { ...row("early"), application_required: true, application_deadline: "2099-01-01T00:00:00Z" };
    const direct = { ...row("direct"), application_deadline: "2020-01-01T00:00:00Z" };
    fetchPublicJson.mockResolvedValue({ items: [past, future, direct, row("none")], page: 1, pageSize: 50, total: 4 });
    const [late, early, notRequired, none] = await getRuntimeBounties("en");
    expect(late.applicationClosed).toBe(true);
    expect(late.status).toBe("active");
    expect(early.applicationClosed).toBeUndefined();
    expect(notRequired.applicationClosed).toBeUndefined();
    expect(none.applicationClosed).toBeUndefined();
  });

  it("flags an OPEN bounty closed only by its submission deadline, but not a finished one", async () => {
    const expired = { ...row("expired"), submission_deadline: "2020-01-01T00:00:00Z" };
    const completed = { ...row("done"), status: "COMPLETED", submission_deadline: "2020-01-01T00:00:00Z" };
    fetchPublicJson.mockResolvedValue({ items: [expired, completed, row("open")], page: 1, pageSize: 50, total: 3 });
    const [late, done, open] = await getRuntimeBounties("en");
    expect([late.status, late.closedReason]).toEqual(["closed", "deadline"]);
    expect([done.status, done.closedReason]).toEqual(["closed", "completed"]);
    expect(open.closedReason).toBeUndefined();
  });

  it("does not offer an application bounty past its application deadline as the apply-guide example", () => {
    const base = { title: "", summary: "", category: "Dev" as const, status: "active" as const, reward: { amount: 1, currency: "INJ" as const }, sponsor: "S", deadline: "Open", coverImage: "" };
    const closedApply = { ...base, slug: "late", applicationRequired: true, applicationClosed: true };
    const openApply = { ...base, slug: "open", applicationRequired: true };
    const direct = { ...base, slug: "direct" };
    expect(pickGuideBounties([closedApply, openApply, direct])).toEqual({ applicationBounty: openApply, directBounty: direct });
    expect(pickGuideBounties([closedApply, direct]).applicationBounty).toBeUndefined();
  });

  it("does not offer an agent-only bounty as a guide example a person cannot act on", () => {
    const base = { title: "", summary: "", category: "Dev" as const, status: "active" as const, reward: { amount: 1, currency: "INJ" as const }, sponsor: "S", deadline: "Open", coverImage: "" };
    const agentApply = { ...base, slug: "agent-apply", applicationRequired: true, submissionMode: "agent" as const };
    const agentDirect = { ...base, slug: "agent-direct", submissionMode: "agent" as const };
    const direct = { ...base, slug: "direct", submissionMode: "direct" as const };
    expect(pickGuideBounties([agentApply, agentDirect, direct])).toEqual({ applicationBounty: undefined, directBounty: direct });
  });

  it("loads every page and keeps all reward tokens", async () => {
    fetchPublicJson.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      const items = page === 1
        ? Array.from({ length: 50 }, (_, index) => row(`b${index}`))
        : [row("b50", [{ symbol: "INJ", amount: "1000000000000000000", tokenType: "NATIVE" }, { symbol: "USDC", amount: "5000000", tokenType: "ERC20" }])];
      return { items, page, pageSize: 50, total: 51 };
    });
    const bounties = await getRuntimeBounties("en");
    expect(bounties).toHaveLength(51);
    expect(fetchPublicJson).toHaveBeenCalledTimes(2);
    expect(bounties[0].reward).toEqual({ amount: 1.5, currency: "INJ" });
    expect(bounties[50].rewards).toEqual([{ amount: 1, currency: "INJ" }, { amount: 5, currency: "USDC" }]);
  });

  it("maps the BE lifecycle onto active / reviewing / closed, keeps the Closed deadline sentinel, and exposes daysLeft as a number", async () => {
    expect(["OPEN", "SUBMISSION_CLOSED", "IN_REVIEW", "COMPLETED", "CANCELLED"].map(toBountyStatus)).toEqual(["active", "reviewing", "reviewing", "closed", "closed"]);
    fetchPublicJson.mockResolvedValue({ items: [{ ...row("open") }, { ...row("review"), status: "IN_REVIEW" }, { ...row("done"), status: "COMPLETED" }], page: 1, pageSize: 50, total: 3 });
    const bounties = await getRuntimeBounties("en");
    expect(bounties.map((bounty) => [bounty.status, bounty.deadline])).toEqual([["active", "Open"], ["reviewing", "Closed"], ["closed", "Closed"]]);
    // The card localizes the countdown (bounties.card.daysLeft); the model never carries a "D-7" string.
    expect(bounties.map((bounty) => bounty.daysLeft)).toEqual([expect.any(Number), undefined, undefined]);
    expect(bounties[0].daysLeft).toBeGreaterThan(0);
    // Only a finished (COMPLETED) bounty is `completed`; CANCELLED and expired-OPEN also present as closed.
    expect(bounties.map((bounty) => bounty.closedReason)).toEqual([undefined, undefined, "completed"]);
    expect(getBounties().filter((bounty) => bounty.status === "closed").every((bounty) => bounty.closedReason === "completed")).toBe(true);
    expect(getBounties().every((bounty) => !/^D-\d+$/.test(bounty.deadline))).toBe(true);
    expect(getBounties().some((bounty) => bounty.status === "reviewing")).toBe(true);
  });

  it("presents an OPEN bounty whose submission deadline has passed (or is unparseable) as closed", async () => {
    const now = new Date("2026-07-01T00:00:00Z").getTime();
    expect(toPublicBountyStatus("OPEN", "2026-07-02T00:00:00Z", now)).toBe("active");
    expect(toPublicBountyStatus("OPEN", "2026-07-01T00:00:00Z", now)).toBe("closed");
    expect(toPublicBountyStatus("OPEN", "2026-06-30T23:59:59Z", now)).toBe("closed");
    expect(toPublicBountyStatus("OPEN", "not a date", now)).toBe("closed");
    expect(toPublicBountyStatus("IN_REVIEW", "2020-01-01T00:00:00Z", now)).toBe("reviewing");

    fetchPublicJson.mockResolvedValue({ items: [{ ...row("past"), submission_deadline: "2020-01-01T00:00:00Z" }, { ...row("broken"), submission_deadline: "soon" }, row("open")], page: 1, pageSize: 50, total: 3 });
    const bounties = await getRuntimeBounties("en");
    expect(bounties.map((bounty) => [bounty.status, bounty.deadline, bounty.daysLeft])).toEqual([
      ["closed", "Closed", undefined],
      ["closed", "Closed", undefined],
      ["active", "Open", expect.any(Number)],
    ]);
  });

  it("formats deadlineDetail in UTC through the shared formatter and leaves it empty when unparseable", async () => {
    fetchPublicJson.mockResolvedValueOnce({ ...row("open"), submission_deadline: "2026-07-14T23:59:00.000Z", description: "D", requirements: "- Repo", evaluation_criteria: "E" });
    const bounty = await getRuntimeBounty("open", "en");
    expect(bounty?.deadlineDetail).toBe("July 14, 2026 at 11:59 PM UTC");
    fetchPublicJson.mockResolvedValueOnce({ ...row("broken"), submission_deadline: "soon", description: "D", requirements: "", evaluation_criteria: "E" });
    const broken = await getRuntimeBounty("broken", "en");
    expect(broken?.deadlineDetail).toBe("");
    expect(broken?.status).toBe("closed");
  });

  it("reports an unavailable API instead of throwing", async () => {
    fetchPublicJson.mockRejectedValue(new Error("down"));
    await expect(settle(getRuntimeBounties("en"), [])).resolves.toEqual({ value: [], unavailable: true });
  });
});

describe("bounty detail loader failure modes", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("returns undefined (→ notFound) only when the BE answers 404", async () => {
    fetchPublicJson.mockRejectedValueOnce(new PublicApiError(404, "/bounties/x"));
    await expect(getRuntimeBounty("x", "en")).resolves.toBeUndefined();
  });

  it.each([
    ["a BE 500", new PublicApiError(500, "/bounties/x")],
    ["a BE 503 during a restart", new PublicApiError(503, "/bounties/x")],
    ["the 8s timeout", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["a network failure", new TypeError("fetch failed")],
  ])("rethrows %s so the error boundary renders instead of a false 404", async (_label, failure) => {
    fetchPublicJson.mockRejectedValueOnce(failure);
    await expect(getRuntimeBounty("x", "en")).rejects.toBe(failure);
  });
});
