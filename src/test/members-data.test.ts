import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatUtcDate } from "@/lib/api/codecs";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public")>()),
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { PublicApiError } = await import("@/lib/api/public");
const { getRuntimeProfile, parentNftState, payoutBadge, portfolioBodyKey, profiles, PROFILE_FILLED_EXAMPLE_ID, toCompletionReward } = await import("@/lib/members");
const { loadRuntimeHallOfFame } = await import("@/lib/hall-of-fame");

const previousTimeZone = process.env.TZ;

// UTC+14: 23:30Z on the last day of a month is already the next month locally, so an unpinned
// toLocaleDateString(locale) would print the wrong month/day.
beforeAll(() => {
  process.env.TZ = "Pacific/Kiritimati";
  expect(new Date("2026-05-31T23:30:00Z").getMonth()).toBe(5);
});
afterAll(() => {
  if (previousTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimeZone;
});

describe("formatUtcDate", () => {
  it("pins the display date to UTC like src/i18n/request.ts and yields empty for bad input", () => {
    expect(formatUtcDate("2026-05-31T23:30:00Z", "en", { year: "numeric", month: "long", day: "numeric" })).toBe("May 31, 2026");
    expect(formatUtcDate("2026-05-31T23:30:00Z", "ko", { year: "numeric", month: "long" })).toBe("2026년 5월");
    expect(formatUtcDate(null, "en", { year: "numeric" })).toBe("");
    expect(formatUtcDate("garbage", "en", { year: "numeric" })).toBe("");
  });
});

describe("public profile dates", () => {
  it("formats joinedAt and completedAt in UTC regardless of the server time zone", async () => {
    fetchPublicJson.mockResolvedValueOnce({
      nickname: "ninja.inj", bio: "", created_at: "2026-05-31T23:30:00Z", tags: ["DEV"],
      completedBounties: [{ id: "b1", title: "Widget", category: "DEV", completed_at: "2026-06-30T23:59:00Z", rewards: [{ amount: "1000000000000000000", symbol: "INJ" }] }],
      agents: [], nfts: [],
    });
    const profile = await getRuntimeProfile("ninja.inj", "en");
    expect(profile?.joinedAt).toBe("May 2026");
    expect(profile?.completions[0]?.completedAt).toBe("June 30, 2026");
  });
});

describe("public profile payout status", () => {
  const paid = [{ amount: "1000000000000000000", symbol: "INJ" }];
  const posted = [{ amount: "500000000", symbol: "USDC" }];

  it("shows the paid payout when PAID", () => {
    expect(toCompletionReward({ rewards: paid, postedRewards: posted, payoutStatus: "PAID" })).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" });
  });

  it("shows the posted reward flagged as pending when PENDING", () => {
    expect(toCompletionReward({ rewards: [], postedRewards: posted, payoutStatus: "PENDING" })).toEqual({ reward: { amount: 500, currency: "USDC" }, payoutStatus: "PENDING" });
  });

  it("shows the paid payout so far flagged as partially paid when PARTIALLY_PAID", () => {
    expect(toCompletionReward({ rewards: paid, postedRewards: [...paid, ...posted], payoutStatus: "PARTIALLY_PAID" })).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PARTIALLY_PAID" });
  });

  it("reads an unknown payoutStatus as PENDING (never claims a payout)", () => {
    expect(toCompletionReward({ rewards: paid, postedRewards: posted, payoutStatus: "REFUNDED" })).toEqual({ reward: { amount: 500, currency: "USDC" }, payoutStatus: "PENDING" });
  });

  it("flags PENDING and PARTIALLY_PAID completions with a warning badge, nothing otherwise", () => {
    expect(payoutBadge("PENDING")).toEqual({ variant: "warning", key: "payoutPending" });
    expect(payoutBadge("PARTIALLY_PAID")).toEqual({ variant: "warning", key: "payoutPartial" });
    expect(payoutBadge("PAID")).toBeNull();
    expect(payoutBadge("NONE")).toBeNull();
  });

  it("keeps one PARTIALLY_PAID completion in the mock fixture, visible among the first three cards", () => {
    const jaemin = profiles[PROFILE_FILLED_EXAMPLE_ID];
    expect(jaemin?.completions.slice(0, 3).filter((completion) => completion.payoutStatus === "PARTIALLY_PAID")).toHaveLength(1);
  });

  it("shows nothing when NONE, even if the bounty posted a reward", () => {
    expect(toCompletionReward({ rewards: [], postedRewards: posted, payoutStatus: "NONE" })).toEqual({ reward: null, payoutStatus: "NONE" });
  });

  it("renders NONE with paid rewards as PAID (paid amount, no badge)", () => {
    const result = toCompletionReward({ rewards: paid, postedRewards: posted, payoutStatus: "NONE" });
    expect(result).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" });
    expect(payoutBadge(result.payoutStatus)).toBeNull();
  });

  it("falls back to `rewards` when an older BE omits payoutStatus/postedRewards", () => {
    expect(toCompletionReward({ rewards: paid })).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" });
    expect(toCompletionReward({ rewards: [] })).toEqual({ reward: null, payoutStatus: "NONE" });
  });

  it("maps the profile rows end to end", async () => {
    fetchPublicJson.mockResolvedValueOnce({
      nickname: "ninja.inj", bio: "", created_at: "2026-05-31T23:30:00Z", tags: ["DEV"],
      completedBounties: [
        { id: "b1", title: "Paid", category: "DEV", completed_at: "2026-06-30T23:59:00Z", rewards: paid, postedRewards: paid, payoutStatus: "PAID" },
        { id: "b2", title: "Pending", category: "DESIGN", completed_at: "2026-06-29T23:59:00Z", rewards: [], postedRewards: posted, payoutStatus: "PENDING" },
        { id: "b3", title: "None", category: "CONTENT", completed_at: "2026-06-28T23:59:00Z", rewards: [], postedRewards: posted, payoutStatus: "NONE" },
        { id: "b4", title: "Partial", category: "DEV", completed_at: "2026-06-27T23:59:00Z", rewards: paid, postedRewards: [...paid, ...posted], payoutStatus: "PARTIALLY_PAID" },
      ],
      agents: [], nfts: [],
    });
    const profile = await getRuntimeProfile("ninja.inj", "en");
    expect(profile?.completions.map(({ reward, payoutStatus }) => ({ reward, payoutStatus }))).toEqual([
      { reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" },
      { reward: { amount: 500, currency: "USDC" }, payoutStatus: "PENDING" },
      { reward: null, payoutStatus: "NONE" },
      { reward: { amount: 1, currency: "INJ" }, payoutStatus: "PARTIALLY_PAID" },
    ]);
  });
});

describe("hall of fame milestone dates", () => {
  it("formats published_at in UTC and keeps an empty date for unpublished rows", async () => {
    fetchPublicJson.mockImplementation(async (path: string) =>
      path.endsWith("/stats")
        ? { completedBounties: 0, builders: 0, completionNfts: 0, sponsors: 0 }
        : [
            { id: "m1", type: "MILESTONE", title: "Launch", description: "", image_url: null, link_url: null, published_at: "2026-05-31T23:30:00Z" },
            { id: "m2", type: "MILESTONE", title: "Soon", description: "", image_url: null, link_url: null, published_at: null },
          ],
    );
    const { hallOfFame } = await loadRuntimeHallOfFame("en");
    expect(hallOfFame.milestones.map((milestone) => milestone.date)).toEqual(["May 31, 2026", ""]);
  });
});

describe("portfolio parent NFT copy", () => {
  const parent = (status: "PENDING" | "MINTING" | "MINTED" | "ATTACHING" | "ATTACHED" | "FAILED") => ({ type: "parent" as const, status });
  const child = { type: "completion" as const, status: "ATTACHED" as const };

  it("says the Ninja NFT is minted only when a MINTED/ATTACHED parent exists", async () => {
    const en = (await import("../../messages/en/members.json")).default.profile.portfolio;
    expect(portfolioBodyKey(false, parentNftState([parent("MINTED")]))).toBe("bodyEmpty");
    expect(portfolioBodyKey(false, parentNftState([parent("ATTACHED")]))).toBe("bodyEmpty");
    expect(en.bodyEmpty).toMatch(/already minted/);
  });

  it("never claims a mint for an empty list, a lone child, a failed or an in-flight parent", async () => {
    const en = (await import("../../messages/en/members.json")).default.profile.portfolio;
    expect(parentNftState([])).toBe("none");
    expect(parentNftState([child])).toBe("none");
    expect(parentNftState([parent("FAILED")])).toBe("none");
    expect(parentNftState([parent("PENDING")])).toBe("pending");
    expect(parentNftState([parent("MINTING")])).toBe("pending");
    expect(portfolioBodyKey(false, "none")).toBe("bodyEmptyNotMinted");
    expect(portfolioBodyKey(false, "pending")).toBe("bodyEmptyPending");
    expect(en[portfolioBodyKey(false, "none")]).not.toMatch(/already minted/);
    expect(en[portfolioBodyKey(false, "pending")]).not.toMatch(/already minted/);
    // Completed profiles keep the generic parent/child explanation.
    expect(portfolioBodyKey(true, "none")).toBe("bodyCompleted");
  });

  it("maps the API profile's NINJA_PARENT row into a parent the copy can read", async () => {
    fetchPublicJson.mockResolvedValueOnce({
      nickname: "kim", bio: "", tags: [], created_at: "2026-05-01T00:00:00Z", completedBounties: [], agents: [],
      nfts: [{ id: "n1", nft_type: "NINJA_PARENT", status: "MINTING", contract_address: "inj1x", token_id: null, mint_tx_hash: null, bounty_title: null }],
    });
    const profile = await getRuntimeProfile("kim", "en");
    expect(profile && parentNftState(profile.nfts)).toBe("pending");
  });
});

describe("public profile loader failure modes", () => {
  it("returns undefined (→ notFound) only when the BE answers 404", async () => {
    fetchPublicJson.mockRejectedValueOnce(new PublicApiError(404, "/users/ghost"));
    await expect(getRuntimeProfile("ghost", "en")).resolves.toBeUndefined();
  });

  it.each([
    ["a BE 502", new PublicApiError(502, "/users/kim")],
    ["the 8s timeout", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["a network failure", new TypeError("fetch failed")],
  ])("rethrows %s", async (_label, failure) => {
    fetchPublicJson.mockRejectedValueOnce(failure);
    await expect(getRuntimeProfile("kim", "en")).rejects.toBe(failure);
  });
});
