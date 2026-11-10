import { describe, expect, it, vi } from "vitest";
import { createApiApiClient } from "@/lib/api/api-client";
import { unavailableReason } from "@/lib/api/unavailable";
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
  bounty_id: "b1", bounty_title: "Widget", category: "DEV", ...over,
});

describe("GET /applications/me + /submissions/me join", () => {
  it("maps every BE application status and joins each row to its own submission", async () => {
    const { http } = createHttp({
      "/applications/me": [
        application({ id: "pending", status: "PENDING", bounty_id: "b-pending" }),
        application({ id: "rejected", status: "REJECTED", bounty_id: "b-rejected" }),
        application({ id: "withdrawn", status: "WITHDRAWN", bounty_id: "b-withdrawn" }),
        application({ id: "approved", status: "APPROVED", bounty_id: "b-approved" }),
        application({ id: "submitted", status: "APPROVED", bounty_id: "b-shared" }),
        // An old BE row made by an agent (non-null `agent`) is excluded: it would collide with the owner's row on bounty_id.
        application({ id: "legacy-agent", status: "PENDING", bounty_id: "b-legacy", agent: { id: "ag1", name: "Bot" } }),
        application({ id: "pending-with-sub", status: "PENDING", bounty_id: "b-early" }),
      ],
      "/submissions/me": [
        { status: "IN_REVIEW", bounty_id: "b-shared" },
        { status: "SUBMITTED", bounty_id: "b-early" },
      ],
    });

    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result.status).toBe("available");
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ["pending", "open"],
      ["rejected", "rejected"],
      ["approved", "approved"],
      // The IN_REVIEW submission makes the approved application's row "submitted".
      ["submitted", "submitted"],
      // A submission never promotes an application the sponsor has not approved.
      ["pending-with-sub", "open"],
    ]);
    expect(rows.every((row) => !("agent" in row))).toBe(true);
  });

  it("uses only the owner's row when an agent row for the same bounty comes first", async () => {
    const { http } = createHttp({
      "/applications/me": [
        application({ id: "agent-app", status: "REJECTED", bounty_id: "b-dup", agent: { id: "ag1" } }),
        application({ id: "own-app", status: "APPROVED", bounty_id: "b-dup", agent: null }),
        application({ id: "agent-only", status: "PENDING", bounty_id: "b-agent-only", agent: { id: "ag1" } }),
      ],
      "/submissions/me": [
        { id: "agent-sub", status: "REJECTED", bounty_id: "b-dup", agent: { id: "ag1" } },
        { id: "own-sub", status: "IN_REVIEW", bounty_id: "b-dup" },
        { id: "agent-sub-only", status: "SUBMITTED", bounty_id: "b-agent-only", agent: { id: "ag1" } },
      ],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.id, row.status])).toEqual([["own-app", "submitted"]]);
  });

  it("maps the row fields and falls back to Other for an unknown category code", async () => {
    const { http } = createHttp({
      "/applications/me": [application({ category: "QUANTUM", message: "hello", bounty_title: "T", applied_at: "2026-07-02T03:04:05.000Z" })],
      "/submissions/me": [],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result).toEqual({
      status: "available",
      data: [{ id: "a1", source: "application", bountySlug: "b1", bountyTitle: "T", category: "Other", appliedAt: "2026-07-02T03:04:05.000Z", note: "hello", status: "open", reviewComment: null, reviewNote: null, paymentStatus: "NONE" }],
    });
  });

  it("treats a row without an `agent` key (older BE) as the owner's own", async () => {
    const legacy: Record<string, unknown> = application({ status: "APPROVED" });
    delete legacy.agent;
    const { http } = createHttp({ "/applications/me": [legacy], "/submissions/me": [{ status: "APPROVED", bounty_id: "b1" }] });
    const result = await createApiApiClient(http).getApplications(signedIn);
    expect(result.status === "available" && result.data[0]).toMatchObject({ status: "completed" });
  });
});

describe("GET /submissions/me content fields", () => {
  it("drops agent-made rows so only the owner's submission remains for a bounty", async () => {
    const { http } = createHttp({
      "/submissions/me": [
        { id: "agent-sub", status: "APPROVED", bounty_id: "b-dup", agent: { id: "ag1" } },
        { id: "own-sub", status: "IN_REVIEW", bounty_id: "b-dup" },
        { id: "agent-only", status: "SUBMITTED", bounty_id: "b-agent-only", agent: { id: "ag1" } },
      ],
    });
    const result = await createApiApiClient(http).getSubmissions(signedIn);
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.bountySlug, row.status])).toEqual([["b-dup", "in_review"]]);
  });

  it("maps submission_url, repository_url, commit_sha and description, and omits null or absent ones", async () => {
    const { http } = createHttp({
      "/submissions/me": [
        { status: "SUBMITTED", bounty_id: "b1", submission_url: "https://x.test/w", repository_url: "https://github.com/o/r", commit_sha: "3f2a9c1", description: "d" },
        { status: "SUBMITTED", bounty_id: "b2", submission_url: "https://x.test/w", repository_url: null, commit_sha: null },
        { status: "SUBMITTED", bounty_id: "b3" },
      ],
    });
    const result = await createApiApiClient(http).getSubmissions(signedIn);
    const rows = result.status === "available" ? result.data : [];
    expect(rows[0]).toMatchObject({ submissionUrl: "https://x.test/w", repositoryUrl: "https://github.com/o/r", commitSha: "3f2a9c1", description: "d" });
    expect(Object.keys(rows[1]!)).not.toContain("repositoryUrl");
    expect(Object.keys(rows[1]!)).not.toContain("commitSha");
    expect(Object.keys(rows[2]!)).not.toEqual(expect.arrayContaining(["submissionUrl"]));
  });
});

describe("standalone submissions on /applications", () => {
  it("lists direct submissions (no application behind them) with status, reviewer comment and payout", async () => {
    const { http } = createHttp({
      "/applications/me": [application({ id: "with-app", status: "APPROVED", bounty_id: "b-apply" })],
      "/submissions/me": [
        { id: "s0", status: "IN_REVIEW", bounty_id: "b-apply" },
        { id: "s1", status: "SUBMITTED", bounty_id: "b-d1", bounty_title: "Direct one", category: "DEV", submitted_at: "2026-10-01T00:00:00.000Z", description: "my work" },
        { id: "s2", status: "REVISION_REQUESTED", bounty_id: "b-d2", review_comment: " fix links " },
        { id: "s3", status: "REJECTED", bounty_id: "b-d3", review_comment: "forfeited: no wallet" },
        { id: "s4", status: "APPROVED", bounty_id: "b-d4", payment_status: "PAID" },
        { id: "s5", status: "REVISION_REQUESTED", bounty_id: "b-d5", review_comment: "add repo" },
      ],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const rows = result.status === "available" ? result.data : [];
    // The submission behind an application row is joined into it, never listed twice.
    // Newest first across both kinds: s1 (2026-10-01) is newer than the application (2026-07-01); rows without a time go last.
    expect(rows.map((row) => [row.id, row.source ?? "application", row.status])).toEqual([
      ["submission:s1", "submission", "submitted"],
      ["with-app", "application", "submitted"],
      ["submission:s2", "submission", "revisionRequested"],
      ["submission:s3", "submission", "notAccepted"],
      ["submission:s4", "submission", "completed"],
      ["submission:s5", "submission", "revisionRequested"],
    ]);
    expect(rows[0]).toMatchObject({ bountySlug: "b-d1", bountyTitle: "Direct one", appliedAt: "2026-10-01T00:00:00.000Z", note: "my work" });
    expect(rows[2].reviewComment).toBe("fix links");
    expect(rows[3].reviewComment).toBe("forfeited: no wallet");
    expect(rows[4].paymentStatus).toBe("PAID");
    expect(rows[5].reviewComment).toBe("add repo");
  });
});

describe("payout status join", () => {
  it("carries the APPROVED submission's payment_status onto the completed row (NONE for older BE and other states)", async () => {
    const { http } = createHttp({
      "/applications/me": [
        application({ id: "paid", status: "APPROVED", bounty_id: "b-paid" }),
        application({ id: "partial", status: "APPROVED", bounty_id: "b-partial" }),
        application({ id: "old", status: "APPROVED", bounty_id: "b-old" }),
        application({ id: "weird", status: "APPROVED", bounty_id: "b-weird" }),
        application({ id: "review", status: "APPROVED", bounty_id: "b-review" }),
      ],
      "/submissions/me": [
        { status: "APPROVED", bounty_id: "b-paid", payment_status: "PAID" },
        { status: "APPROVED", bounty_id: "b-partial", payment_status: "PARTIALLY_PAID" },
        { status: "APPROVED", bounty_id: "b-old" },
        { status: "APPROVED", bounty_id: "b-weird", payment_status: "REFUNDED" },
        { status: "IN_REVIEW", bounty_id: "b-review", payment_status: "PAID" },
      ],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.id, row.status, row.paymentStatus])).toEqual([
      ["paid", "completed", "PAID"],
      ["partial", "completed", "PARTIALLY_PAID"],
      ["old", "completed", "NONE"],
      ["weird", "completed", "PENDING"],
      ["review", "submitted", "NONE"],
    ]);
  });
});

describe("revision-requested join", () => {
  it("maps an approved application whose submission is REVISION_REQUESTED, carrying the trimmed reviewer comment", async () => {
    const { http } = createHttp({
      "/applications/me": [
        application({ id: "rev", status: "APPROVED", bounty_id: "b-rev" }),
        application({ id: "rev-nocomment", status: "APPROVED", bounty_id: "b-rev2" }),
        application({ id: "rev-pending", status: "PENDING", bounty_id: "b-rev3" }),
      ],
      "/submissions/me": [
        { status: "REVISION_REQUESTED", bounty_id: "b-rev", review_comment: "  Add tests\nand docs  " },
        { status: "REVISION_REQUESTED", bounty_id: "b-rev2" },
        { status: "REVISION_REQUESTED", bounty_id: "b-rev3", review_comment: "x" },
      ],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const rows = result.status === "available" ? result.data : [];
    expect(rows.map((row) => [row.id, row.status, row.reviewComment])).toEqual([
      ["rev", "revisionRequested", "Add tests\nand docs"],
      ["rev-nocomment", "revisionRequested", null],
      // An unapproved application is never promoted by a submission row.
      ["rev-pending", "open", null],
    ]);
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
    const { http } = createHttp({ "/submissions/me": [{ status, bounty_id: "b1", agent: null }] });
    expect(await createApiApiClient(http).getSubmissions(signedIn)).toEqual({
      status: "available",
      data: [{ bountySlug: "b1", status: expected, paymentStatus: "NONE", reviewComment: null }],
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
    const { http } = createHttp({ "/submissions/me": [{ status: "APPROVED", bounty_id: "b1", payment_status: paymentStatus }] });
    const result = await createApiApiClient(http).getSubmissions(signedIn);
    expect(result.status === "available" ? result.data[0]?.paymentStatus : null).toBe(expected);
  });
});

describe("account reads: signed-out and failures", () => {
  it("answers every account read for a signed-out snapshot without calling the BE", async () => {
    const { http, fetchJson } = createHttp();
    const client = createApiApiClient(http);
    expect(await client.getAccount(signedOut)).toEqual({ status: "available", data: null });
    expect(await client.getApplications(signedOut)).toEqual({ status: "available", data: [] });
    expect(await client.getSubmissions(signedOut)).toEqual({ status: "available", data: [] });
    expect(await client.getSubmissions({ status: "loading", user: null })).toEqual({ status: "available", data: [] });
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
      data: { user: { id: "u1", handle: "ninja.inj", initials: "NI", profileSlug: "ninja.inj", onboardingStep: 4, onboardingCompleted: true, isAdmin: true, bio: "", tags: [], nftStatus: null } },
    });
    const failing = createHttp({ "/auth/me": new ApiHttpError(401, "UNAUTHORIZED") });
    expect(await createApiApiClient(failing.http).getAccount(signedIn)).toEqual({ status: "available", data: null });
    const noSession = createHttp({ "/auth/me": me }, false);
    expect(await createApiApiClient(noSession.http).getAccount(signedIn)).toEqual({ status: "available", data: null });
    expect(noSession.fetchJson).not.toHaveBeenCalled();
  });

  it("maps a legacy wallet key to nothing and upper-cases two code units of the nickname for initials", () => {
    const user = toClientUser({ id: "u", nickname: "zed", onboardingStep: 2, onboardingCompleted: false, isAdmin: false, wallet: null } as unknown as MeResponse);
    expect(user).toEqual({ id: "u", handle: "zed", initials: "ZE", profileSlug: "zed", onboardingStep: 2, onboardingCompleted: false, isAdmin: false, nftStatus: null });
    expect(user).not.toHaveProperty("walletAddress");
  });

  it("takes initials by code point so an astral letter is not cut into a lone surrogate", () => {
    const user = toClientUser({ id: "u", nickname: "\u{1D4D0}\u{1D4D1}c", onboardingStep: 2, onboardingCompleted: false, isAdmin: false, wallet: null } as unknown as MeResponse);
    expect(user.initials).toBe("\u{1D4D0}\u{1D4D1}");
  });
});

describe("write requests: method, path encoding and body", () => {
  it("encodes ids into the path so a slash or query character cannot reach another route", async () => {
    const { http, fetchJson } = createHttp();
    const client = createApiApiClient(http);
    await client.applyToBounty("a/b?c", { message: "m", portfolioUrl: "https://x.y" });
    await client.submitBounty("../admin", { submissionUrl: "https://x.y", description: "d" });
    expect(fetchJson.mock.calls.map(([path, init]) => [path, init?.method, init?.body])).toEqual([
      ["/bounties/a%2Fb%3Fc/applications", "POST", { message: "m", portfolioUrl: "https://x.y" }],
      ["/bounties/..%2Fadmin/submissions", "POST", { submissionUrl: "https://x.y", description: "d" }],
    ]);
  });

  it("encodes the nickname query and posts the onboarding steps", async () => {
    const { http, fetchJson } = createHttp({ "/users/check-nickname?nickname=%EB%8B%8C%EC%9E%90%26x%3D1": { available: true } });
    const client = createApiApiClient(http);
    await expect(client.checkNickname("닌자&x=1")).resolves.toEqual({ available: true });
    await expect(client.completeProfile({ nickname: "ninja", bio: "b", tags: ["DEV"] })).resolves.toBeUndefined();
    await expect(client.completeOnboarding()).resolves.toBeUndefined();
    expect(fetchJson.mock.calls.slice(1)).toEqual([
      ["/users/me/profile", { method: "POST", body: { nickname: "ninja", bio: "b", tags: ["DEV"] } }],
      ["/users/me/complete-onboarding", { method: "POST" }],
    ]);
  });

  it("lets a BE error from a write reach the caller unchanged (the UI branches on its code)", async () => {
    const { http, fetchJson } = createHttp();
    fetchJson.mockRejectedValueOnce(new ApiHttpError(409, "ALREADY_APPLIED"));
    await expect(createApiApiClient(http).applyToBounty("b1", { message: "m" })).rejects.toMatchObject({ status: 409, code: "ALREADY_APPLIED" });
  });
});

describe("GET /applications/me bounty state fields", () => {
  it("maps bounty_status and deadlines when the BE sends them", async () => {
    const { http } = createHttp({
      "/applications/me": [application({ bounty_status: "CANCELLED", submission_deadline: "2026-08-01T00:00:00.000Z", application_deadline: null })],
      "/submissions/me": [],
    });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const row = result.status === "available" ? result.data[0] : undefined;
    expect(row?.bountyStatus).toBe("CANCELLED");
    expect(row?.submissionDeadline).toBe("2026-08-01T00:00:00.000Z");
    expect(row?.applicationDeadline).toBeNull();
  });

  it("leaves the fields absent for an older BE", async () => {
    const { http } = createHttp({ "/applications/me": [application({})], "/submissions/me": [] });
    const result = await createApiApiClient(http).getApplications(signedIn);
    const row = result.status === "available" ? result.data[0] : undefined;
    expect(row && "bountyStatus" in row).toBe(false);
    expect(row && "submissionDeadline" in row).toBe(false);
    expect(row && "applicationDeadline" in row).toBe(false);
  });
});
