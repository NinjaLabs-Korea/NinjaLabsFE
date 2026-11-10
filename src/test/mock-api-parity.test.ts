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
    for (const method of ["getAccount", "getApplications", "getSubmissions"] as const) {
      expect(await mock[method](signedOut), method).toEqual(await api[method](signedOut));
    }
  });

  it("produce account rows with the same fields as the api mapping", async () => {
    const api = apiClient({
      "/applications/me": [{ id: "a", status: "PENDING", message: "m", applied_at: "t", reviewed_at: null, bounty_id: "b", bounty_title: "T", category: "DEV" }],
      "/submissions/me": [{ status: "SUBMITTED", bounty_id: "b" }],
    });
    const mock = createMockApiClient();
    // The default fixtures have no submission yet: make one so every list has a row to compare.
    await mock.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.y", description: "d" });
    const auth = owner();
    for (const method of ["getApplications", "getSubmissions"] as const) {
      const [apiResult, mockResult] = await Promise.all([api[method](auth), mock[method](auth)]);
      if (apiResult.status !== "available" || mockResult.status !== "available") throw new Error(`${method} unavailable`);
      expect(mockResult.data.length, method).toBeGreaterThan(0);
      // The submission content fields are optional on both sides (the dedicated test below covers them).
      // The BE #69 payout address fields are optional on both sides too (an older BE omits them; the mock only seeds the completed fixture).
      const content = new Set(["submissionUrl", "repositoryUrl", "commitSha", "description", "submissionId", "payoutAddress", "payoutAddressEvm", "payoutAddressUpdatedAt", "payoutAddressEditable"]);
      const base = (row: object) => keys(row).filter((key) => !content.has(key));
      for (const row of mockResult.data) expect(base(row), method).toEqual(base(apiResult.data[0]));
    }
  });

  it("mock and api keep the same content fields on a submission, and a resubmission replaces them wholesale", async () => {
    const api = apiClient({ "/submissions/me": [{ status: "SUBMITTED", bounty_id: "b", submission_url: "https://x.y", repository_url: "https://g.y/r", commit_sha: "abc1234", description: "d" }] });
    const mock = createMockApiClient();
    await mock.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.y", repositoryUrl: "https://g.y/r", commitSha: "abc1234", description: "d" });
    const [a, m] = [await api.getSubmissions(owner()), await mock.getSubmissions(owner())];
    if (a.status !== "available" || m.status !== "available") throw new Error("unavailable");
    const row = m.data.find((r) => r.bountySlug === "wallet-onboarding-states")!;
    expect(keys(row)).toEqual(keys(a.data[0]));
    expect(row).toMatchObject({ submissionUrl: "https://x.y", repositoryUrl: "https://g.y/r", commitSha: "abc1234", description: "d" });
    await mock.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.y", description: "e" });
    const again = await mock.getSubmissions(owner());
    if (again.status !== "available") throw new Error("unavailable");
    const next = again.data.find((r) => r.bountySlug === "wallet-onboarding-states")!;
    expect(next.description).toBe("e");
    expect(next.repositoryUrl).toBeUndefined();
  });

  it("maps review_comment to reviewComment, and the mock fixtures carry a forfeited submission", async () => {
    const api = apiClient({ "/submissions/me": [
      { status: "REJECTED", bounty_id: "b", review_comment: " forfeited: x " },
      { status: "SUBMITTED", bounty_id: "c" },
    ] });
    const result = await api.getSubmissions(owner());
    if (result.status !== "available") throw new Error("unavailable");
    expect(result.data.map((row) => row.reviewComment)).toEqual(["forfeited: x", null]);
    const mock = await createMockApiClient().getSubmissions(owner());
    if (mock.status !== "available") throw new Error("unavailable");
    expect(mock.data).toContainEqual(expect.objectContaining({ status: "rejected", reviewComment: "forfeited: winner wallet never connected" }));
  });

  it("withholds the fixture account from any other signed-in user", async () => {
    const mock = createMockApiClient();
    expect(await mock.getAccount(stranger)).toEqual({ status: "available", data: null });
    expect(await mock.getApplications(stranger)).toEqual({ status: "available", data: [] });
    expect(await mock.getSubmissions(stranger)).toEqual({ status: "available", data: [] });
  });
});

describe("mock errors mirror BE status and code", () => {
  it.each([
    ["setPayoutAddress on an unknown submission", (client: ReturnType<typeof createMockApiClient>) => client.setPayoutAddress("nope", `0x${"ab".repeat(20)}`), 404, "SUBMISSION_NOT_FOUND"],
    ["transitionAdminBounty on an unknown bounty", (client: ReturnType<typeof createMockApiClient>) => client.transitionAdminBounty("nope", "OPEN"), 404, "BOUNTY_NOT_FOUND"],
    ["deleteAdminPost on an unknown notice", (client: ReturnType<typeof createMockApiClient>) => client.deleteAdminPost("nope"), 404, "NOTICE_NOT_FOUND"],
    ["deleteAdminHighlight on an unknown highlight", (client: ReturnType<typeof createMockApiClient>) => client.deleteAdminHighlight("nope"), 404, "HIGHLIGHT_NOT_FOUND"],
    ["setAdminMember on an unknown user", (client: ReturnType<typeof createMockApiClient>) => client.setAdminMember("nope", { isMember: false }), 404, "USER_NOT_FOUND"],
  ])("%s -> %i %s", async (_label, action, status, code) => {
    const error = await action(createMockApiClient()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({ status, code });
  });
});
