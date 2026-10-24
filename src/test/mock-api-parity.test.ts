import { describe, expect, it, vi } from "vitest";
import { createApiApiClient } from "@/lib/api/api-client";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { getMockFixtureSnapshot, createMockFixtures } from "@/lib/mocks/fixtures";

/** api client over a fake transport that answers GETs from `routes`. */
function apiClient(routes: Record<string, unknown>) {
  const fetchJson = vi.fn(async (path: string, init?: { method?: string }) => (init?.method && init.method !== "GET" ? { id: "x" } : routes[path]));
  return createApiApiClient({ fetchJson, fetchForm: vi.fn(), hasSession: () => true } as unknown as ApiHttp);
}

const owner = (): AuthSnapshot => ({ status: "signed-in", user: getMockFixtureSnapshot(createMockFixtures("default")).account.user });
const stranger: AuthSnapshot = { status: "signed-in", user: { id: "someone-else", handle: "x", initials: "X", profileSlug: "x" } };
const keys = (value: object) => Object.keys(value).sort();

describe("mock and api clients implement the same contract", () => {
  it("expose exactly the same methods", () => {
    expect(keys(createMockApiClient())).toEqual(keys(apiClient({})));
  });

  it("answer signed-out account reads identically", async () => {
    const mock = createMockApiClient();
    const api = apiClient({});
    const signedOut: AuthSnapshot = { status: "signed-out", user: null };
    for (const method of ["getAccount", "getApplications", "getSubmissions", "getAgents"] as const) {
      expect(await mock[method](signedOut), method).toEqual(await api[method](signedOut));
    }
  });

  it("produce account rows with the same fields as the api mapping", async () => {
    const api = apiClient({
      "/applications/me": [{ id: "a", status: "PENDING", message: "m", applied_at: "t", reviewed_at: null, bounty_id: "b", bounty_title: "T", category: "DEV", agent: null }],
      "/submissions/me": [{ status: "SUBMITTED", bounty_id: "b", agent: null }],
      "/agents/me": [{ id: "g", name: "n", description: null, status: "ACTIVE", wallet_address: "w", verified_at: null, created_at: "t", completed_bounties: 0, key_prefix: "p", key_status: "ACTIVE", key_expires_at: "t" }],
    });
    const mock = createMockApiClient();
    // The default fixtures have no submission yet: make one so every list has a row to compare.
    await mock.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.y", description: "d" });
    const auth = owner();
    for (const method of ["getApplications", "getSubmissions", "getAgents"] as const) {
      const [apiResult, mockResult] = await Promise.all([api[method](auth), mock[method](auth)]);
      if (apiResult.status !== "available" || mockResult.status !== "available") throw new Error(`${method} unavailable`);
      expect(mockResult.data.length, method).toBeGreaterThan(0);
      for (const row of mockResult.data) expect(keys(row), method).toEqual(keys(apiResult.data[0]));
    }
  });

  it("withholds the fixture account from any other signed-in user", async () => {
    const mock = createMockApiClient();
    expect(await mock.getAccount(stranger)).toEqual({ status: "available", data: null });
    expect(await mock.getApplications(stranger)).toEqual({ status: "available", data: [] });
    expect(await mock.getAgents(stranger)).toEqual({ status: "available", data: [] });
  });
});

describe("mock errors mirror BE status and code", () => {
  it.each([
    ["rotateAgentKey on an unknown agent", (client: ReturnType<typeof createMockApiClient>) => client.rotateAgentKey("nope"), 404, "AGENT_NOT_FOUND"],
    ["revokeAgent on an unknown agent", (client: ReturnType<typeof createMockApiClient>) => client.revokeAgent("nope"), 404, "AGENT_NOT_FOUND"],
    ["transitionAdminBounty on an unknown bounty", (client: ReturnType<typeof createMockApiClient>) => client.transitionAdminBounty("nope", "OPEN"), 404, "BOUNTY_NOT_FOUND"],
    ["deleteAdminPost on an unknown notice", (client: ReturnType<typeof createMockApiClient>) => client.deleteAdminPost("nope"), 404, "NOTICE_NOT_FOUND"],
    ["deleteAdminHighlight on an unknown highlight", (client: ReturnType<typeof createMockApiClient>) => client.deleteAdminHighlight("nope"), 404, "HIGHLIGHT_NOT_FOUND"],
    ["setAdminMember on an unknown user", (client: ReturnType<typeof createMockApiClient>) => client.setAdminMember("nope", { isMember: false }), 404, "USER_NOT_FOUND"],
  ])("%s -> %i %s", async (_label, action, status, code) => {
    const error = await action(createMockApiClient()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({ status, code });
  });

  it("refuses to rotate a revoked agent's key with 409 AGENT_NOT_ACTIVE and keeps it revoked", async () => {
    const mock = createMockApiClient();
    await mock.revokeAgent("agent-1");
    await expect(mock.rotateAgentKey("agent-1")).rejects.toMatchObject({ status: 409, code: "AGENT_NOT_ACTIVE" });
    const agents = await mock.getAgents(owner());
    expect(agents.status === "available" && agents.data.find((agent) => agent.id === "agent-1")).toMatchObject({ status: "REVOKED", verified: false, keyStatus: "REVOKED" });
  });

  it("refuses a second registration of an active wallet regardless of case, but re-issues a pending one", async () => {
    const mock = createMockApiClient();
    const pending = await mock.registerAgent({ name: "a", walletAddress: "0xAbC" });
    const reissued = await mock.registerAgent({ name: "b", walletAddress: "0xabc" });
    expect(reissued.agentId).not.toBe(pending.agentId);
    const agents = await mock.getAgents(owner());
    expect(agents.status === "available" && agents.data.filter((agent) => agent.walletAddress.toLowerCase() === "0xabc")).toHaveLength(1);
    await mock.verifyAgent(reissued.agentId, "0xsig");
    await expect(mock.registerAgent({ name: "c", walletAddress: "0XABC" })).rejects.toMatchObject({ status: 409, code: "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED" });
  });
});

describe("admin bounty status parity", () => {
  it.each(["DRAFT", "FUNDING_PENDING", "OPEN", "SUBMISSION_CLOSED", "IN_REVIEW", "COMPLETED", "CANCELLED"])(
    "a transition to %s shows the same console status in mock mode as the api row mapping",
    async (status) => {
      const api = apiClient({
        "/admin/bounties": [{
          id: "b", title: "t", sponsor_name: "s", summary: "s", description: "d", requirements: "", evaluation_criteria: "", category: "DEV", status,
          application_required: false, submission_mode: "DIRECT", cover_image_url: null, submission_deadline: "2026-07-01T00:00:00.000Z",
          application_deadline: null, max_winners: 1, rewards: [],
        }],
      });
      const [apiRow] = await api.getAdminBounties();

      const mock = createMockApiClient();
      const [first] = await mock.getAdminBounties();
      await mock.transitionAdminBounty(first.slug, status);
      const mockRow = (await mock.getAdminBounties()).find((bounty) => bounty.slug === first.slug)!;
      expect(mockRow.status).toBe(apiRow.status);
    },
  );
});

describe("mock submission revisions", () => {
  it("numbers revisions per bounty and reports RESUBMITTED after the first", async () => {
    const mock = createMockApiClient();
    const input = { submissionUrl: "https://x.y", description: "d" };
    expect(await mock.submitBounty("b1", input)).toMatchObject({ revisionNo: 1, status: "SUBMITTED" });
    expect(await mock.submitBounty("b1", input)).toMatchObject({ revisionNo: 2, status: "RESUBMITTED" });
    expect(await mock.submitBounty("b2", input)).toMatchObject({ revisionNo: 1, status: "SUBMITTED" });
    const submissions = await mock.getSubmissions(owner());
    expect(submissions.status === "available" && submissions.data.filter((row) => row.bountySlug === "b1")).toEqual([{ bountySlug: "b1", status: "submitted", agent: null }]);
  });

  it("starts every new client from the fixtures (nothing leaks between clients)", async () => {
    const first = createMockApiClient();
    await first.applyToBounty("helix-volume-analytics", { message: "m" });
    const fresh = await createMockApiClient().getApplications(owner());
    expect(fresh.status === "available" && fresh.data.some((row) => row.bountySlug === "helix-volume-analytics")).toBe(false);
  });
});
