import { describe, expect, it, vi } from "vitest";
import { createAdminApi } from "@/lib/api/admin";
import type { ApiHttp } from "@/lib/api/http";
import type { AdminBounty } from "@/lib/admin";

function createHttp(answer: unknown = { id: "x" }) {
  const fetchJson = vi.fn(async () => answer);
  const fetchForm = vi.fn(async () => ({ id: "m1", url: "/media/11111111-1111-4111-8111-111111111111" }));
  const http = { fetchJson, fetchForm, hasSession: () => true, signOutRemote: vi.fn() } as unknown as ApiHttp;
  return { http, fetchJson, fetchForm };
}

type Call = [string, { method?: string; body?: Record<string, unknown> } | undefined];
const calls = (fetchJson: ReturnType<typeof createHttp>["fetchJson"]) => fetchJson.mock.calls as unknown as Call[];

const bountyRow = (over: Record<string, unknown> = {}) => ({
  id: "b1", title: "Widget", sponsor_name: "Injective", summary: "Short", description: "Long", requirements: "- Repo", evaluation_criteria: "E",
  category: "DESIGN", status: "OPEN", application_required: true, submission_mode: "AGENT", cover_image_url: "/media/x",
  submission_deadline: "2026-07-14T00:00:00.000Z", application_deadline: null, max_winners: 1, rewards: [], ...over,
});

const bounty: AdminBounty = {
  slug: "b1", title: "Widget", sponsor: "Injective", reward: { amount: 1.5, currency: "INJ" }, intakeEnabled: true, submissionMode: "agent",
  coverImage: "/media/11111111-1111-4111-8111-111111111111", status: "draft", deadline: "2026-07-14T00:00:00.000Z", applicationDeadline: null,
  maxWinners: 1, tags: ["Design"], description: "Plain description", submissionGuide: "", requirements: "- Repo", deliverables: ["- Repo"], reviewProcess: "Review",
};

describe("GET /admin/bounties row mapping", () => {
  it.each([
    ["DRAFT", "draft"],
    ["FUNDING_PENDING", "funding"],
    ["OPEN", "active"],
    ["SUBMISSION_CLOSED", "reviewing"],
    ["IN_REVIEW", "reviewing"],
    ["COMPLETED", "closed"],
    ["CANCELLED", "closed"],
  ])("BE status %s -> %s", async (status, expected) => {
    const { http } = createHttp([bountyRow({ status })]);
    const [row] = await createAdminApi(http).getAdminBounties();
    expect(row.status).toBe(expected);
  });

  it("maps the first reward with its ERC20 contract and chain, the codes and the flags", async () => {
    const { http } = createHttp([bountyRow({
      rewards: [
        { symbol: "USDC", amount: "250000000", tokenType: "ERC20", tokenContractAddress: "0xusdc", evmChainId: 1439 },
        { symbol: "INJ", amount: "1000000000000000000", tokenType: "NATIVE", tokenContractAddress: null, evmChainId: null },
      ],
    })]);
    const [row] = await createAdminApi(http).getAdminBounties();
    expect(row).toMatchObject({
      slug: "b1", sponsor: "Injective", reward: { amount: 250, currency: "USDC" }, rewardContractAddress: "0xusdc", rewardChainId: 1439,
      intakeEnabled: true, submissionMode: "agent", coverImage: "/media/x", tags: ["Design"], description: "Long", submissionGuide: "- Repo",
      reviewProcess: "E", maxWinners: 1,
    });
  });

  it("shows 0 INJ without contract fields for a bounty without rewards, and survives odd rows", async () => {
    const { http } = createHttp([bountyRow({ rewards: [], category: "UNKNOWN", submission_mode: "DIRECT", description: "", max_winners: "0" })]);
    const [row] = await createAdminApi(http).getAdminBounties();
    expect(row.reward).toEqual({ amount: 0, currency: "INJ" });
    expect(row).not.toHaveProperty("rewardContractAddress");
    expect(row).not.toHaveProperty("rewardChainId");
    expect(row).toMatchObject({ tags: ["Other"], submissionMode: "direct", description: "Short", maxWinners: 1 });
  });
});

describe("POST/PATCH /admin/bounties body", () => {
  it("creates an INJ reward as NATIVE inj in base units", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty(bounty, true);
    const [path, init] = calls(fetchJson)[0];
    expect(path).toBe("/admin/bounties");
    expect(init?.method).toBe("POST");
    expect(init?.body).toMatchObject({
      title: "Widget", sponsorName: "Injective", category: "DESIGN", applicationRequired: true, submissionMode: "AGENT",
      coverImageUrl: bounty.coverImage, submissionDeadline: bounty.deadline, evaluationCriteria: "Review",
      reward: { tokenType: "NATIVE", tokenDenom: "inj", displaySymbol: "INJ", amount: "1500000000000000000" },
    });
  });

  it("creates a USDC reward as ERC20 without a denom (the BE resolves the contract)", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty({ ...bounty, reward: { amount: 250.5, currency: "USDC" } }, true);
    expect(calls(fetchJson)[0][1]?.body?.reward).toEqual({ tokenType: "ERC20", displaySymbol: "USDC", amount: "250500000" });
  });

  it("sends no reward for a zero amount and never on PATCH", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminBounty({ ...bounty, reward: { amount: 0, currency: "INJ" } }, true);
    await api.saveAdminBounty(bounty, false);
    expect(calls(fetchJson)[0][1]?.body).not.toHaveProperty("reward");
    expect(calls(fetchJson)[1][0]).toBe("/admin/bounties/b1");
    expect(calls(fetchJson)[1][1]?.method).toBe("PATCH");
    expect(calls(fetchJson)[1][1]?.body).not.toHaveProperty("reward");
  });

  it("keeps the BE summary budget and never sends an empty summary", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty({ ...bounty, description: "x".repeat(600) }, true);
    const summary = calls(fetchJson)[0][1]?.body?.summary as string;
    expect(Array.from(summary).length).toBeLessThanOrEqual(240);
    expect(summary.trim()).not.toBe("");
  });

  it("encodes the bounty id in transition and delete paths", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.transitionAdminBounty("b/1", "OPEN");
    await api.deleteAdminBounty("b/1");
    expect(calls(fetchJson)).toEqual([
      ["/admin/bounties/b%2F1/transition", { method: "POST", body: { to: "OPEN" } }],
      ["/admin/bounties/b%2F1", { method: "DELETE" }],
    ]);
  });
});

describe("admin users and members", () => {
  it("maps users with member role labels and wallet link state, and encodes the search query", async () => {
    const { http, fetchJson } = createHttp([
      { id: "u1", email: "a@x", nickname: "alpha", is_member: true, member_role: "CORE", member_display_order: 2, created_at: "2026-07-01T23:59:59.999Z", wallet_address: "0xabc" },
      { id: "u2", email: "b@x", nickname: "beta", is_member: false, member_role: null, member_display_order: null, created_at: "not a date", wallet_address: null },
      { id: "u3", email: "c@x", nickname: "gamma", is_member: true, member_role: "INTERN", member_display_order: 1, created_at: "2026-07-02T00:00:00.000Z", wallet_address: null },
    ]);
    const users = await createAdminApi(http).getAdminUsers("a&b c");
    expect(calls(fetchJson)[0][0]).toBe("/admin/users?q=a%26b%20c");
    expect(users).toEqual([
      { slug: "u1", nickname: "alpha", email: "a@x", joinedAt: "2026-07-01", walletAddress: "0xabc", walletStatus: "linked", isMember: true, memberRole: "Core", memberDisplayOrder: 2 },
      { slug: "u2", nickname: "beta", email: "b@x", joinedAt: "", walletAddress: null, walletStatus: null, isMember: false, memberRole: null, memberDisplayOrder: null },
      { slug: "u3", nickname: "gamma", email: "c@x", joinedAt: "2026-07-02", walletAddress: null, walletStatus: null, isMember: true, memberRole: null, memberDisplayOrder: 1 },
    ]);
  });

  it("sends member roles as BE codes and leaves the role out when removing a member", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.setAdminMember("u/1", { isMember: true, role: "Design", displayOrder: 3 });
    await api.setAdminMember("u1", { isMember: false });
    expect(calls(fetchJson)).toEqual([
      ["/admin/users/u%2F1/member", { method: "POST", body: { isMember: true, role: "DESIGN", displayOrder: 3 } }],
      ["/admin/users/u1/member", { method: "POST", body: { isMember: false } }],
    ]);
  });

  it("uploads media as multipart form data with the file under `file`", async () => {
    const { http, fetchForm } = createHttp();
    const file = new File(["png"], "logo.png", { type: "image/png" });
    await expect(createAdminApi(http).uploadAdminMedia(file)).resolves.toEqual({ id: "m1", url: "/media/11111111-1111-4111-8111-111111111111" });
    const [path, form] = fetchForm.mock.calls[0] as unknown as [string, FormData];
    expect(path).toBe("/admin/media");
    expect((form.get("file") as File).name).toBe("logo.png");
  });
});

describe("admin notice and highlight reads", () => {
  it("maps notice rows: unknown category to Other, only PUBLISHED is published, missing date is null", async () => {
    const { http } = createHttp([
      { id: "n1", title: "T", body: "B", category: "RECRUITMENT", status: "PUBLISHED", published_at: "2026-07-01T10:00:00.000Z", thumbnail_url: null, external_url: "https://x.y" },
      { id: "n2", title: "T", body: "B", category: "WHATEVER", status: "ARCHIVED", published_at: null, thumbnail_url: "/media/x", external_url: null },
    ]);
    expect(await createAdminApi(http).getAdminPosts()).toEqual([
      { slug: "n1", title: "T", category: "Recruitment", status: "published", publishedAt: "2026-07-01", bodyMarkdown: "B", thumbnail: null, externalUrl: "https://x.y" },
      { slug: "n2", title: "T", category: "Other", status: "draft", publishedAt: null, bodyMarkdown: "B", thumbnail: "/media/x", externalUrl: null },
    ]);
  });

  it("maps highlight rows and turns a null link into undefined", async () => {
    const { http } = createHttp([{ id: "h1", type: "AWARD", title: "T", description: "D", image_url: null, link_url: null, display_order: 4, is_published: false }]);
    expect(await createAdminApi(http).getAdminHighlights()).toEqual([
      { id: "h1", type: "AWARD", title: "T", description: "D", order: 4, link: undefined, image: null, published: false },
    ]);
  });
});
