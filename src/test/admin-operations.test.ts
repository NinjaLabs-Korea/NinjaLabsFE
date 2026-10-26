import { describe, expect, it, vi } from "vitest";
import { createFormatter } from "next-intl";
import enAdmin from "../../messages/en/admin.json";
import { opsDateTime } from "@/components/admin/ops-ui";
import {
  LIFECYCLE_BLOCKER_CODES,
  OPS_ERROR_CODES,
  applicationDecisionsFor,
  isTxHash,
  opsErrorCode,
  payoutApprovalMode,
  payoutCandidates,
  rewardHeadroom,
  submissionCommentRequired,
  submissionDecisionsFor,
  type AdminOperations,
} from "@/lib/admin-operations";
import { createAdminApi, toAdminOperations } from "@/lib/api/admin";
import { baseUnitsToHuman, humanToBaseUnits, tokenDecimalsFor } from "@/lib/api/codecs";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";

const HASH = "ab".repeat(32);

/** BE operations payload exactly as `GET /admin/bounties/:id/operations` answers (bounty-lifecycle.e2e-spec pins the same fields). */
const operationsBody = {
  bounty: { id: "b1", title: "Widget", status: "IN_REVIEW", submission_deadline: "2026-11-01T00:00:00.000Z", application_deadline: null, max_winners: 2, application_required: true, submission_mode: "DIRECT" },
  lifecycle: {
    blockers: { OPEN: [], SUBMISSION_CLOSED: [], IN_REVIEW: [], COMPLETED: ["Record completed payments for all approved winners and finish every pending payout."] },
    blockerDetails: { OPEN: [], SUBMISSION_CLOSED: [], IN_REVIEW: [], COMPLETED: [{ code: "UNPAID_WINNERS" }] },
    allowedTransitions: ["COMPLETED", "OPEN"],
  },
  applications: [{ id: "a1", status: "APPROVED", message: "hi", portfolio_url: null, review_note: "welcome", applied_at: "2026-10-01T00:00:00Z", reviewed_at: "2026-10-02T00:00:00Z", actor_name: "juho", actor_kind: "USER", user_id: "u1", nickname: "juho", agent_id: null, agent_name: null }],
  submissions: [{
    id: "s1", status: "APPROVED", submission_url: "https://x.test/v2", description: "v2", repository_url: null, commit_sha: null, current_revision_no: 2, submitted_at: "2026-10-03T00:00:00Z",
    last_resubmitted_at: null, reviewed_at: null, actor_name: "bot", actor_kind: "AGENT", user_id: "u2", nickname: "ara", agent_id: "ag1", agent_name: "bot", recipient_wallet_address: "inj1abc", review_comment: "ok",
    revisions: [{ revision_no: 2, submission_url: "https://x.test/v2", description: "v2", repository_url: null, commit_sha: "c2", created_at: "2026-10-04T00:00:00Z" }],
    reviews: [{ revision_no: 2, decision: "APPROVE", comment: "ok", created_at: "2026-10-05T00:00:00Z" }],
  }],
  rewards: [{ id: "r1", status: "FUNDED", token_type: "NATIVE", display_symbol: "INJ", amount: "5000000000000000000", deposited_amount: "6000000000000000000", deposited_at: "2026-10-01T00:00:00Z", custody_address: "inj1multisig", deposit_tx_hash: `0x${HASH}`, token_contract_address: null, evm_chain_id: null, cap: "5000000000000000000", allocated_amount: "2000000000000000000" }],
  payouts: [{ id: "p1", bounty_reward_id: "r1", submission_id: "s1", status: "REQUESTED", amount: "2000000000000000000", payout_tx_hash: null, recipient_address: "inj1abc", display_symbol: "INJ", requested_by: "admin-1", requested_by_nickname: "ops", requested_at: "2026-10-06T00:00:00Z", approved_by: null, approved_by_nickname: null, approved_at: null, paid_at: null, requested_by_me: true }],
  policy: { payoutSelfApprovalAllowed: false },
};

function createHttp(response: unknown = undefined) {
  const fetchJson = vi.fn(async () => response);
  const http = { fetchJson, fetchForm: vi.fn(), hasSession: () => true, signOutRemote: vi.fn() } as unknown as ApiHttp;
  return { http, fetchJson };
}
const calls = (fetchJson: ReturnType<typeof vi.fn>) => fetchJson.mock.calls as unknown as Array<[string, { method?: string; body?: unknown } | undefined]>;

describe("operations API mapping (lib/api/admin.ts)", () => {
  it("maps the operations payload to the console model, keeping base-unit amounts and BE status codes", () => {
    const ops = toAdminOperations(operationsBody as never);
    expect(ops.bounty).toEqual({ id: "b1", title: "Widget", status: "IN_REVIEW", submissionDeadline: "2026-11-01T00:00:00.000Z", maxWinners: 2, applicationRequired: true });
    expect(ops.lifecycle).toEqual({ blockers: operationsBody.lifecycle.blockerDetails, allowedTransitions: ["COMPLETED", "OPEN"] });
    expect(ops.applications[0]).toMatchObject({ id: "a1", kind: "USER", userId: "u1", nickname: "juho", reviewNote: "welcome" });
    expect(ops.submissions[0]).toMatchObject({ id: "s1", kind: "AGENT", agentName: "bot", nickname: "ara", currentRevisionNo: 2, recipientWalletAddress: "inj1abc", revisions: [{ revisionNo: 2, commitSha: "c2" }], reviews: [{ revisionNo: 2, decision: "APPROVE" }] });
    expect(ops.rewards[0]).toMatchObject({ id: "r1", symbol: "INJ", amount: "5000000000000000000", cap: "5000000000000000000", allocated: "2000000000000000000", depositTxHash: `0x${HASH}` });
    expect(ops.payouts[0]).toMatchObject({ id: "p1", rewardId: "r1", submissionId: "s1", requestedByMe: true, requestedByNickname: "ops" });
    expect(ops.policy).toEqual({ payoutSelfApprovalAllowed: false });
  });

  it("an older BE without blockerDetails/allowedTransitions/policy degrades to no buttons and the two-person rule", () => {
    const ops = toAdminOperations({ ...operationsBody, lifecycle: { blockers: {} }, policy: undefined } as never);
    expect(ops.lifecycle).toEqual({ blockers: {}, allowedTransitions: [] });
    expect(ops.policy.payoutSelfApprovalAllowed).toBe(false);
  });

  it("sends each write to the BE route with the BE body shape (trimmed text, base-unit amounts, revisionNo)", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.reviewAdminApplication("a 1", { decision: "APPROVED", note: "  " });
    await api.reviewAdminApplication("a1", { decision: "REJECTED", note: " not a fit " });
    await api.reviewAdminSubmission("s1", { decision: "REQUEST_REVISION", revisionNo: 3, comment: " add tests " });
    await api.confirmAdminDeposit("r1", { txHash: ` 0x${HASH} `, depositedAmount: "5000000000000000000" });
    await api.requestAdminPayout({ rewardId: "r1", submissionId: "s1", amount: "1" });
    await api.approveAdminPayout("p1");
    await api.markAdminPayoutPaid("p1", `${HASH}\n`);
    await api.retryAdminNftJob("j1");
    expect(calls(fetchJson)).toEqual([
      ["/admin/applications/a%201/review", { method: "POST", body: { decision: "APPROVED" } }],
      ["/admin/applications/a1/review", { method: "POST", body: { decision: "REJECTED", note: "not a fit" } }],
      ["/admin/submissions/s1/review", { method: "POST", body: { decision: "REQUEST_REVISION", revisionNo: 3, comment: "add tests" } }],
      ["/admin/rewards/r1/confirm-deposit", { method: "POST", body: { txHash: `0x${HASH}`, depositedAmount: "5000000000000000000" } }],
      ["/admin/payouts", { method: "POST", body: { rewardId: "r1", submissionId: "s1", amount: "1" } }],
      ["/admin/payouts/p1/approve", { method: "POST" }],
      ["/admin/payouts/p1/paid", { method: "POST", body: { txHash: HASH } }],
      ["/admin/nft-jobs/j1/retry", { method: "POST" }],
    ]);
  });

  it("reads the operations and NFT job pages from their routes", async () => {
    const ops = createHttp(operationsBody);
    await createAdminApi(ops.http).getAdminOperations("b1");
    expect(calls(ops.fetchJson)[0][0]).toBe("/admin/bounties/b1/operations");
    const jobs = createHttp({ items: [{ id: "j1", nft_id: "n1", job_type: "MINT_PARENT", status: "FAILED", retry_count: 5, last_error: "boom", scheduled_at: null, updated_at: "2026-10-01T00:00:00Z", nft_type: "NINJA_PARENT", nft_status: "FAILED", bounty_title: null, owner_nickname: "mina", owner_wallet_address: "inj1m" }], page: 2, pageSize: 30, total: 31 });
    const page = await createAdminApi(jobs.http).getAdminNftJobs("FAILED", 2);
    expect(calls(jobs.fetchJson)[0][0]).toBe("/admin/nft-jobs?status=FAILED&page=2");
    expect(page).toEqual({ page: 2, pageSize: 30, total: 31, items: [{ id: "j1", nftId: "n1", jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: "boom", scheduledAt: null, updatedAt: "2026-10-01T00:00:00Z", nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: "mina", ownerWalletAddress: "inj1m" }] });
  });
});

describe("audit log api", () => {
  const row = { id: "l1", actor_user_id: null, actor_agent_id: null, action: "ADMIN_GRANTED", entity_type: "user", entity_id: "u1", created_at: "2026-10-01T00:00:00Z" };

  it("maps rows and sends only the filters that are set, always with the page", async () => {
    const audit = createHttp({ items: [row], page: 2, pageSize: 30, total: 31 });
    const page = await createAdminApi(audit.http).getAdminAuditLogs({ entityType: "payout", entityId: "11111111-1111-4111-8111-111111111111" }, 2);
    expect(calls(audit.fetchJson)[0][0]).toBe("/admin/audit-logs?entityType=payout&entityId=11111111-1111-4111-8111-111111111111&page=2");
    expect(page).toEqual({ page: 2, pageSize: 30, total: 31, items: [{ id: "l1", actorUserId: null, actorAgentId: null, actorNickname: null, action: "ADMIN_GRANTED", entityType: "user", entityId: "u1", createdAt: "2026-10-01T00:00:00Z" }] });
    const bare = createHttp({ items: [], page: 1, pageSize: 30, total: 0 });
    await createAdminApi(bare.http).getAdminAuditLogs({}, 1);
    expect(calls(bare.fetchJson)[0][0]).toBe("/admin/audit-logs?page=1");
  });

  it("requests the next users page only past page 1", async () => {
    const users = createHttp([]);
    await createAdminApi(users.http).getAdminUsers("", 2);
    expect(calls(users.fetchJson)[0][0]).toBe("/admin/users?q=&page=2");
  });
});

describe("token amount codecs", () => {
  it("converts operator input to base units, refusing what the BE TOKEN_AMOUNT would refuse", () => {
    expect(humanToBaseUnits("12.5", "INJ")).toBe("12500000000000000000");
    expect(humanToBaseUnits(" 250.5 ", "usdc")).toBe("250500000");
    expect(humanToBaseUnits("0.000000000000000001", "INJ")).toBe("1");
    for (const bad of ["", "0", "0.0", "-1", "1e3", "1,000", "abc", "0.0000001"]) expect(humanToBaseUnits(bad, "USDC")).toBeNull();
    expect(humanToBaseUnits("1", "DOGE")).toBeNull();
  });

  it("formats base units exactly (no rounding) and refuses unknown tokens or non-integers", () => {
    expect(baseUnitsToHuman("12500000000000000001", "INJ")).toBe("12.500000000000000001");
    expect(baseUnitsToHuman("250500000", "USDC")).toBe("250.5");
    expect(baseUnitsToHuman("1.5", "INJ")).toBeNull();
    expect(baseUnitsToHuman(null, "INJ")).toBeNull();
    expect(baseUnitsToHuman("1", "DOGE")).toBeNull();
    expect([tokenDecimalsFor("inj"), tokenDecimalsFor("USDC"), tokenDecimalsFor("X")]).toEqual([18, 6, null]);
  });
});

describe("operations rules (mirror of the BE review/payout checks)", () => {
  const bounty: AdminOperations["bounty"] = { id: "b", title: "B", status: "OPEN", submissionDeadline: "2099-01-01T00:00:00Z", maxWinners: 1, applicationRequired: true };

  it("offers the submission decisions the BE accepts per status, none once the bounty is not in progress", () => {
    expect(submissionDecisionsFor("SUBMITTED", "OPEN")).toEqual(["START_REVIEW", "REQUEST_REVISION", "APPROVE", "REJECT"]);
    expect(submissionDecisionsFor("RESUBMITTED", "IN_REVIEW")).toEqual(["START_REVIEW", "REQUEST_REVISION", "APPROVE", "REJECT"]);
    expect(submissionDecisionsFor("IN_REVIEW", "SUBMISSION_CLOSED")).toEqual(["REQUEST_REVISION", "APPROVE", "REJECT"]);
    expect(submissionDecisionsFor("REVISION_REQUESTED", "OPEN")).toEqual(["REJECT"]);
    expect(submissionDecisionsFor("APPROVED", "OPEN")).toEqual([]);
    expect(submissionDecisionsFor("SUBMITTED", "COMPLETED")).toEqual([]);
    expect(submissionCommentRequired("REQUEST_REVISION", "IN_REVIEW")).toBe(true);
    expect(submissionCommentRequired("REJECT", "REVISION_REQUESTED")).toBe(true);
    expect(submissionCommentRequired("REJECT", "IN_REVIEW")).toBe(false);
  });

  it("allows approving an application only on an OPEN bounty before its deadline; rejection until it finishes", () => {
    expect(applicationDecisionsFor({ status: "PENDING" }, bounty)).toEqual(["APPROVED", "REJECTED"]);
    expect(applicationDecisionsFor({ status: "PENDING" }, { ...bounty, submissionDeadline: "2020-01-01T00:00:00Z" })).toEqual(["REJECTED"]);
    expect(applicationDecisionsFor({ status: "PENDING" }, { ...bounty, status: "IN_REVIEW" })).toEqual(["REJECTED"]);
    expect(applicationDecisionsFor({ status: "PENDING" }, { ...bounty, status: "CANCELLED" })).toEqual([]);
    expect(applicationDecisionsFor({ status: "APPROVED" }, bounty)).toEqual([]);
  });

  it("two-person rule modes, payout candidates and allocation headroom", () => {
    expect(payoutApprovalMode({ requestedByMe: true }, { payoutSelfApprovalAllowed: false })).toBe("self-blocked");
    expect(payoutApprovalMode({ requestedByMe: true }, { payoutSelfApprovalAllowed: true })).toBe("self-allowed");
    expect(payoutApprovalMode({ requestedByMe: false }, { payoutSelfApprovalAllowed: false })).toBe("normal");
    const ops = toAdminOperations(operationsBody as never);
    expect(payoutCandidates(ops, "r1")).toEqual([]); // s1 already has a payout on r1
    expect(payoutCandidates(ops, "r2").map((s) => s.id)).toEqual(["s1"]);
    expect(rewardHeadroom(ops.rewards[0])).toBe("3000000000000000000");
    expect(rewardHeadroom({ cap: "1", allocated: "5" })).toBe("0");
    expect(rewardHeadroom({ cap: null, allocated: "0" })).toBeNull();
  });

  it("mirrors the BE tx hash rule", () => {
    expect(isTxHash(HASH)).toBe(true);
    expect(isTxHash(` 0x${HASH.toUpperCase()} `)).toBe(true);
    expect(isTxHash(`0X${HASH}`)).toBe(false);
    expect(isTxHash(HASH.slice(2))).toBe(false);
    expect(isTxHash("not-a-hash")).toBe(false);
  });
});

describe("operations error codes", () => {
  it("normalizes transport and BE errors to message codes", () => {
    expect(opsErrorCode(new ApiHttpError(403, "PAYOUT_SELF_APPROVAL"))).toEqual({ code: "PAYOUT_SELF_APPROVAL", known: true });
    expect(opsErrorCode(new ApiHttpError(503, "DATABASE_UNAVAILABLE"))).toEqual({ code: "DATABASE_UNAVAILABLE", known: true });
    expect(opsErrorCode(new ApiHttpError(400, "INVALID_TRANSITION:OPEN->COMPLETED"))).toEqual({ code: "INVALID_TRANSITION", known: true });
    expect(opsErrorCode(new ApiHttpError(400, "VALIDATION_FAILED", ["Resolve 1 pending application(s)."]), "transition")).toEqual({ code: "TRANSITION_BLOCKED", known: true });
    expect(opsErrorCode(new ApiHttpError(400, "VALIDATION_FAILED", ["amount must match"]))).toEqual({ code: "VALIDATION_FAILED", known: true });
    expect(opsErrorCode(new ApiHttpError(429, "ThrottlerException: Too Many Requests"))).toEqual({ code: "TOO_MANY_REQUESTS", known: true });
    expect(opsErrorCode(new ApiHttpError(401, "Unauthorized"))).toEqual({ code: "UNAUTHORIZED", known: true });
    expect(opsErrorCode(new TypeError("Failed to fetch"))).toEqual({ code: "NETWORK_ERROR", known: true });
    expect(opsErrorCode(new ApiHttpError(500, "SOMETHING_NEW"))).toEqual({ code: "SOMETHING_NEW", known: false });
  });

  it("every mapped error code and blocker code has copy (parity test covers ko/zh)", () => {
    const errors = enAdmin.operations.errors as Record<string, string>;
    for (const code of OPS_ERROR_CODES) expect(errors[code], code).toBeTruthy();
    expect(errors.unknown).toContain("{code}");
    const blockers = enAdmin.operations.blockers as Record<string, string>;
    for (const code of LIFECYCLE_BLOCKER_CODES) expect(blockers[code], code).toBeTruthy();
    expect(enAdmin.common.errors.BOUNTY_HAS_OPEN_FUNDS).toBeTruthy();
  });
});

describe("opsDateTime", () => {
  const format = createFormatter({ locale: "en", timeZone: "UTC" });

  it("formats a BE ISO timestamp in the given zone with the zone name", () => {
    expect(opsDateTime(format, "2026-10-24T12:05:00.000Z", "UTC")).toBe("Oct 24, 2026, 12:05 PM UTC");
  });

  it.each([null, undefined, "", "07.14", "2026-10-24", "not a date"])("renders %p as a dash instead of a guessed date", (value) => {
    expect(opsDateTime(format, value, "UTC")).toBe("–");
  });
});
