import { describe, expect, it, vi } from "vitest";
import { createApiApiClient, unavailableReason } from "@/lib/api/api-client";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { toClientUser, type MeResponse } from "@/lib/api/me";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { signedInWith } from "@/test/support/auth";

const signedIn = signedInWith({ id: "u1" });
const signedOut: AuthSnapshot = { status: "signed-out", user: null };

type Routes = Record<string, unknown>;

/** Fake transport: answers GETs from `routes` (an Error value is thrown), records every call. */
function createHttp(routes: Routes = {}, session = true) {
  const fetchJson = vi.fn(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method && init.method !== "GET") return { ok: true };
    if (!(path in routes)) throw new Error(`unexpected GET ${path}`);
    const value = routes[path];
    if (value instanceof Error) throw value;
    return value;
  });
  const http = { fetchJson, fetchForm: vi.fn(), hasSession: () => session, initSession: vi.fn(), signOutRemote: vi.fn() } as unknown as ApiHttp;
  return { http, fetchJson };
}

const application = (over: Record<string, unknown>) => ({
  id: "a1", status: "PENDING", message: "note", applied_at: "2026-07-01T00:00:00.000Z", reviewed_at: null,
  bounty_id: "b1", bounty_title: "Widget", category: "DEV", agent: null, ...over,
});

describe("GET /applications/me + /submissions/me join", () => {
  it("maps every BE application status and joins each row to its own (owner or agent) submission", async () => {
    const agent = { id: "ag1", name: "Bot" };
    const { http } = createHttp({
      "/applications/me": [
        application({ id: "pending", status: "PENDING", bounty_id: "b-pending" }),
        application({ id: "rejected", status: "REJECTED", bounty_id: "b-rejected" }),
        application({ id: "withdrawn", status: "WITHDRAWN", bounty_id: "b-withdrawn" }),
        application({ id: "approved", status: "APPROVED", bounty_id: "b-approved" }),
        application({ id: "submitted", status: "APPROVED", bounty_id: "b-shared" }),
        application({ id: "agent-done", status: "APPROVED", bounty_id: "b-shared", agent }),
        application({ id: "pending-with-sub", status: "PENDING", bounty_id: "b-early" }),
      ],
      "/submissions/me": [
        { status: "IN_REVIEW", bounty_id: "b-shared", agent: null },
        { status: "APPROVED", bounty_id: "b-shared", agent },
        { status: "SUBMITTED", bounty_id: "b-early", agent: null },
      ],
    });

    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result.status).toBe("available");
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ["pending", "open"],
      ["rejected", "rejected"],
      ["approved", "approved"],
      // The owner's own IN_REVIEW submission makes the owner's row "submitted"; the agent's APPROVED one completes only the agent row.
      ["submitted", "submitted"],
      ["agent-done", "completed"],
      // A submission never promotes an application the sponsor has not approved.
      ["pending-with-sub", "open"],
    ]);
    expect(rows.find((row) => row.id === "agent-done")?.agent).toEqual(agent);
    expect(rows.find((row) => row.id === "submitted")?.agent).toBeNull();
  });

  it("maps the row fields and falls back to Other for an unknown category code", async () => {
    const { http } = createHttp({
      "/applications/me": [application({ category: "QUANTUM", message: "hello", bounty_title: "T", applied_at: "2026-07-02T03:04:05.000Z" })],
      "/submissions/me": [],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result).toEqual({
      status: "available",
      data: [{ id: "a1", bountySlug: "b1", bountyTitle: "T", category: "Other", appliedAt: "2026-07-02T03:04:05.000Z", note: "hello", status: "open", agent: null }],
    });
  });

  it("treats a row without an `agent` key (older BE) as the owner's own", async () => {
    const legacy: Record<string, unknown> = application({ status: "APPROVED" });
    delete legacy.agent;
    const { http } = createHttp({ "/applications/me": [legacy], "/submissions/me": [{ status: "APPROVED", bounty_id: "b1" }] });
    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result.status === "available" && result.data[0]).toMatchObject({ status: "completed", agent: null });
  });
});

describe("GET /submissions/me mapping", () => {
  it.each([
    ["SUBMITTED", "submitted"],
    ["RESUBMITTED", "resubmitted"],
    ["IN_REVIEW", "in_review"],
    ["REVISION_REQUESTED", "revision_requested"],
    ["APPROVED", "approved"],
    ["REJECTED", "rejected"],
    ["SOMETHING_NEW", "submitted"],
  ])("%s -> %s", async (status, expected) => {
    const { http } = createHttp({ "/submissions/me": [{ status, bounty_id: "b1", agent: { id: "ag", name: "Bot" } }] });
    expect(await createApiApiClient(http).getSubmissions(signedIn)).toEqual({
      status: "available",
      data: [{ bountySlug: "b1", status: expected, agent: { id: "ag", name: "Bot" }, paymentStatus: "NONE", reviewComment: null }],
    });
  });

  it.each([
    ["PAID", "PAID"],
    ["PARTIALLY_PAID", "PARTIALLY_PAID"],
    ["PENDING", "PENDING"],
    ["NONE", "NONE"],
    ["REFUNDED", "PENDING"],
    [null, "NONE"],
    [undefined, "NONE"],
  ])("payment_status %p -> %s (unknown → PENDING, missing → NONE)", async (paymentStatus, expected) => {
    const { http } = createHttp({ "/submissions/me": [{ status: "APPROVED", bounty_id: "b1", agent: null, payment_status: paymentStatus }] });
    const result = await createApiApiClient(http).getSubmissions(signedIn);
    expect(result.status === "available" ? result.data[0]?.paymentStatus : null).toBe(expected);
  });
});

describe("GET /agents/me mapping", () => {
  const agentRow = {
    id: "ag1", name: "Bot", description: null, status: "ACTIVE", wallet_address: "0xabc", verified_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-06-30T00:00:00.000Z", completed_bounties: 3, key_prefix: "nj_ab12", key_status: "ACTIVE", key_expires_at: "2026-09-28T00:00:00.000Z",
  };

  it("masks the key by its prefix and marks only ACTIVE agents verified", async () => {
    const { http } = createHttp({
      "/agents/me": [
        agentRow,
        { ...agentRow, id: "ag2", status: "PENDING_VERIFICATION", verified_at: null, completed_bounties: 0, key_prefix: null, key_status: null, key_expires_at: null },
        { ...agentRow, id: "ag3", status: "REVOKED", key_status: "REVOKED" },
      ],
    });
    const result = await createApiApiClient(http).getAgents(signedIn);
    expect(result).toEqual({
      status: "available",
      data: [
        { id: "ag1", name: "Bot", walletAddress: "0xabc", status: "ACTIVE", verified: true, completedBounties: 3, apiKeyMasked: "nj_ab12••••••••", keyExpiresAt: "2026-09-28T00:00:00.000Z", keyStatus: "ACTIVE", registeredAt: "2026-06-30T00:00:00.000Z" },
        { id: "ag2", name: "Bot", walletAddress: "0xabc", status: "PENDING_VERIFICATION", verified: false, completedBounties: 0, apiKeyMasked: "-", keyExpiresAt: null, keyStatus: null, registeredAt: "2026-06-30T00:00:00.000Z" },
        { id: "ag3", name: "Bot", walletAddress: "0xabc", status: "REVOKED", verified: false, completedBounties: 3, apiKeyMasked: "nj_ab12••••••••", keyExpiresAt: "2026-09-28T00:00:00.000Z", keyStatus: "REVOKED", registeredAt: "2026-06-30T00:00:00.000Z" },
      ],
    });
  });

  it("never exposes a raw key field even if a row carried one", async () => {
    const { http } = createHttp({ "/agents/me": [{ ...agentRow, key_hash: "secret", api_key: "nj_raw" }] });
    const result = await createApiApiClient(http).getAgents(signedIn);
    expect(JSON.stringify(result)).not.toMatch(/secret|nj_raw/);
  });
});

describe("account reads: signed-out and failures", () => {
  it("answers every account read for a signed-out snapshot without calling the BE", async () => {
    const { http, fetchJson } = createHttp();
    const client = createApiApiClient(http);
    expect(await client.getAccount(signedOut)).toEqual({ status: "available", data: null });
    expect(await client.getApplications(signedOut)).toEqual({ status: "available", data: [] });
    expect(await client.getSubmissions(signedOut)).toEqual({ status: "available", data: [] });
    expect(await client.getAgents(signedOut)).toEqual({ status: "available", data: [] });
    expect(await client.getAgents({ status: "loading", user: null })).toEqual({ status: "available", data: [] });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it.each([
    [new ApiHttpError(401, "UNAUTHORIZED"), "unauthorized"],
    [new ApiHttpError(403, "FORBIDDEN"), "unauthorized"],
    [new ApiHttpError(500, "INTERNAL"), "server-error"],
    [new ApiHttpError(429, "ThrottlerException"), "server-error"],
    [new ApiHttpError(404, "NOT_FOUND"), "server-error"],
    [new ApiHttpError(0, "REFRESH_UNAVAILABLE"), "network-error"],
    [new TypeError("Failed to fetch"), "network-error"],
    ["string", "network-error"],
  ])("classifies %o as %s", (error, reason) => {
    expect(unavailableReason(error)).toBe(reason);
  });

  it("reports an unavailable list when either half of the applications join fails", async () => {
    const { http } = createHttp({ "/applications/me": [], "/submissions/me": new ApiHttpError(503, "DOWN") });
    expect(await createApiApiClient(http).getApplications(signedIn)).toEqual({ status: "unavailable", reason: "server-error" });
  });

  it("maps /auth/me into the client user and reads a failed /auth/me as signed-out (not unavailable)", async () => {
    const me: MeResponse = {
      id: "u1", nickname: "ninja.inj", email: "n@x", bio: "", tags: [], onboardingStep: 4, onboardingCompleted: true, isAdmin: true, isMember: false,
      wallet: { address: "0xwallet", verifiedAt: "2026-07-01T00:00:00.000Z" }, nft: null,
    };
    const { http } = createHttp({ "/auth/me": me });
    expect(await createApiApiClient(http).getAccount(signedIn)).toEqual({
      status: "available",
      data: { user: { id: "u1", handle: "ninja.inj", initials: "NI", profileSlug: "ninja.inj", onboardingStep: 4, onboardingCompleted: true, isAdmin: true, walletAddress: "0xwallet" } },
    });
    const failing = createHttp({ "/auth/me": new ApiHttpError(401, "UNAUTHORIZED") });
    expect(await createApiApiClient(failing.http).getAccount(signedIn)).toEqual({ status: "available", data: null });
    const noSession = createHttp({ "/auth/me": me }, false);
    expect(await createApiApiClient(noSession.http).getAccount(signedIn)).toEqual({ status: "available", data: null });
    expect(noSession.fetchJson).not.toHaveBeenCalled();
  });

  it("leaves walletAddress off a user without a wallet and upper-cases two code units of the nickname for initials", () => {
    const user = toClientUser({ id: "u", nickname: "zed", onboardingStep: 2, onboardingCompleted: false, isAdmin: false, wallet: null } as unknown as MeResponse);
    expect(user).toEqual({ id: "u", handle: "zed", initials: "ZE", profileSlug: "zed", onboardingStep: 2, onboardingCompleted: false, isAdmin: false });
    expect(user).not.toHaveProperty("walletAddress");
  });
});

describe("write requests: method, path encoding and body", () => {
  const call = (fetchJson: ReturnType<typeof createHttp>["fetchJson"], index = 0) => fetchJson.mock.calls[index];

  it("encodes ids into the path so a slash or query character cannot reach another route", async () => {
    const { http, fetchJson } = createHttp();
    const client = createApiApiClient(http);
    await client.applyToBounty("a/b?c", { message: "m", portfolioUrl: "https://x.y" });
    await client.submitBounty("../admin", { submissionUrl: "https://x.y", description: "d" });
    await client.verifyAgent("ag 1", "0xsig");
    await client.rotateAgentKey("ag#1");
    await client.revokeAgent("ag%1");
    expect(fetchJson.mock.calls.map(([path, init]) => [path, init?.method, init?.body])).toEqual([
      ["/bounties/a%2Fb%3Fc/applications", "POST", { message: "m", portfolioUrl: "https://x.y" }],
      ["/bounties/..%2Fadmin/submissions", "POST", { submissionUrl: "https://x.y", description: "d" }],
      ["/agents/ag%201/verify", "POST", { signature: "0xsig" }],
      ["/agents/ag%231/keys/rotate", "POST", undefined],
      ["/agents/ag%251/revoke", "POST", undefined],
    ]);
  });

  it("omits an empty agent description and an absent wallet public key instead of sending empty values", async () => {
    const { http, fetchJson } = createHttp();
    const client = createApiApiClient(http);
    await client.registerAgent({ name: "Bot", description: "", walletAddress: "0xabc" });
    await client.registerAgent({ name: "Bot", description: "Does things", walletAddress: "0xabc" });
    await client.verifyWallet("0xabc", "0xsig");
    await client.verifyWallet("0xabc", "0xsig", "0xpub");
    expect(call(fetchJson, 0)).toEqual(["/agents", { method: "POST", body: { name: "Bot", walletAddress: "0xabc" } }]);
    expect(call(fetchJson, 1)).toEqual(["/agents", { method: "POST", body: { name: "Bot", description: "Does things", walletAddress: "0xabc" } }]);
    expect(call(fetchJson, 2)).toEqual(["/wallets/verify", { method: "POST", body: { address: "0xabc", signature: "0xsig" } }]);
    expect(call(fetchJson, 3)).toEqual(["/wallets/verify", { method: "POST", body: { address: "0xabc", signature: "0xsig", publicKey: "0xpub" } }]);
  });

  it("encodes the nickname query and posts the onboarding steps", async () => {
    const { http, fetchJson } = createHttp({ "/users/check-nickname?nickname=%EB%8B%8C%EC%9E%90%26x%3D1": { available: true } });
    const client = createApiApiClient(http);
    await expect(client.checkNickname("닌자&x=1")).resolves.toEqual({ available: true });
    await expect(client.completeProfile({ nickname: "ninja", bio: "b", tags: ["DEV"] })).resolves.toBeUndefined();
    await expect(client.completeOnboarding()).resolves.toBeUndefined();
    await client.createWalletChallenge("0xabc");
    expect(fetchJson.mock.calls.slice(1)).toEqual([
      ["/users/me/profile", { method: "POST", body: { nickname: "ninja", bio: "b", tags: ["DEV"] } }],
      ["/users/me/complete-onboarding", { method: "POST" }],
      ["/wallets/challenge", { method: "POST", body: { address: "0xabc" } }],
    ]);
  });

  it("lets a BE error from a write reach the caller unchanged (the UI branches on its code)", async () => {
    const { http, fetchJson } = createHttp();
    fetchJson.mockRejectedValueOnce(new ApiHttpError(409, "ALREADY_APPLIED"));
    await expect(createApiApiClient(http).applyToBounty("b1", { message: "m" })).rejects.toMatchObject({ status: 409, code: "ALREADY_APPLIED" });
  });
});
