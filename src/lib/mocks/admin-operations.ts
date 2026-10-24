import { isAuditUuid, type AdminAuditLog } from "@/lib/admin-audit";
import type { AdminApi } from "@/lib/contracts/api";
import type { AdminBounty } from "@/lib/admin-helpers";
import { MockApiError } from "@/lib/mocks/mock-error";
import { rewardToBaseUnits } from "@/lib/api/codecs";
import {
  BOUNTY_TRANSITIONS,
  applicationDecisionsFor,
  canApprovePayout,
  canMarkPayoutPaid,
  isBountyInProgress,
  isRewardFunded,
  rewardHeadroom,
  isTxHash,
  submissionCommentRequired,
  submissionDecisionsFor,
  type AdminNftJob,
  type AdminOperations,
  type BountyStatusCode,
  type LifecycleBlocker,
  type OpsPayout,
} from "@/lib/admin-operations";

type OperationsApi = Pick<AdminApi,
  "getAdminOperations" | "reviewAdminApplication" | "reviewAdminSubmission" | "confirmAdminDeposit" | "requestAdminPayout"
  | "approveAdminPayout" | "markAdminPayoutPaid" | "getAdminNftJobs" | "retryAdminNftJob" | "getAdminAuditLogs">;

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString();
const TOKEN_AMOUNT = /^[1-9][0-9]{0,77}$/;
/** The preview admin ("you"); seeded payouts are requested by another operator so the approve path is demonstrable. */
export const MOCK_ADMIN_ID = "preview-admin";
const OTHER_ADMIN = { id: "preview-ops-lead", nickname: "ops-lead" };

const fail = (status: number, code: string): never => {
  throw new MockApiError(status, code);
};

const STATUS_FROM_ADMIN: Record<AdminBounty["status"], BountyStatusCode> = {
  draft: "DRAFT", funding: "FUNDING_PENDING", active: "OPEN", reviewing: "IN_REVIEW", closed: "COMPLETED",
};
export const ADMIN_STATUS_FROM_CODE: Record<string, AdminBounty["status"]> = {
  DRAFT: "draft", FUNDING_PENDING: "funding", OPEN: "active", SUBMISSION_CLOSED: "reviewing", IN_REVIEW: "reviewing",
};

/** Deterministic per-bounty operations seed: one pending + one approved application, a resubmitted entry, an approved agent entry with a payout requested by another admin. */
function seedOperations(bounty: AdminBounty, nextId: (prefix: string) => string): AdminOperations {
  const status = STATUS_FROM_ADMIN[bounty.status];
  const symbol = bounty.reward.currency;
  const amount = bounty.reward.amount > 0 ? rewardToBaseUnits(bounty.reward) : null;
  const funded = status !== "DRAFT" && status !== "FUNDING_PENDING";
  const rewards: AdminOperations["rewards"] = amount ? [{
    id: nextId("preview-reward"), status: funded ? "FUNDED" : "DEPOSIT_PENDING", symbol, amount,
    depositedAmount: funded ? amount : null, depositedAt: funded ? iso(-10) : null,
    depositTxHash: funded ? `0x${"ab".repeat(32)}` : null, custodyAddress: "inj1previewmultisig", cap: funded ? amount : null, allocated: "0",
  }] : [];
  const live = funded && status !== "COMPLETED";
  const applications: AdminOperations["applications"] = live && bounty.intakeEnabled ? [
    { id: nextId("preview-app"), status: "PENDING", kind: "USER", userId: "mina", nickname: "mina", agentId: null, agentName: null, message: "I shipped two Helix dashboards last quarter.", portfolioUrl: "https://example.test/mina", reviewNote: null, appliedAt: iso(-3), reviewedAt: null },
    { id: nextId("preview-app"), status: "APPROVED", kind: "USER", userId: "juho", nickname: "juho", agentId: null, agentName: null, message: "Happy to take this on.", portfolioUrl: null, reviewNote: "Welcome aboard", appliedAt: iso(-6), reviewedAt: iso(-5) },
  ] : [];
  const submissions: AdminOperations["submissions"] = live ? [
    {
      id: nextId("preview-sub"), status: "RESUBMITTED", kind: "USER", userId: "juho", nickname: "juho", agentId: null, agentName: null,
      currentRevisionNo: 2, submittedAt: iso(-4), reviewedAt: null, recipientWalletAddress: "inj1...7n3q", reviewComment: null,
      revisions: [
        { revisionNo: 2, submissionUrl: "https://example.test/juho/v2", description: "Addressed the copy feedback.", repositoryUrl: "https://github.com/example/juho", commitSha: "c0ffee2", createdAt: iso(-1) },
        { revisionNo: 1, submissionUrl: "https://example.test/juho/v1", description: "First cut.", repositoryUrl: "https://github.com/example/juho", commitSha: "c0ffee1", createdAt: iso(-4) },
      ],
      reviews: [],
    },
    {
      id: nextId("preview-sub"), status: "APPROVED", kind: "AGENT", userId: "ara", nickname: "ara", agentId: "preview-agent-alpha", agentName: "alpha-bot",
      currentRevisionNo: 1, submittedAt: iso(-5), reviewedAt: iso(-2), recipientWalletAddress: "inj1...8c1v", reviewComment: "Great work",
      revisions: [{ revisionNo: 1, submissionUrl: "https://example.test/alpha", description: "Automated benchmark run.", repositoryUrl: null, commitSha: null, createdAt: iso(-5) }],
      reviews: [{ revisionNo: 1, decision: "APPROVE", comment: "Great work", createdAt: iso(-2) }],
    },
  ] : [];
  const maxWinners = Math.max(bounty.maxWinners, 2);
  const payouts: OpsPayout[] = [];
  if (live && rewards[0] && submissions[1]) {
    // One winner's share, not the whole reward: the rest stays allocatable so approving the resubmitted entry and
    // requesting its payout (then hitting the two-person rule on it) is demonstrable in mock mode.
    const share = (BigInt(rewards[0].amount) / BigInt(maxWinners)).toString();
    payouts.push({
      id: nextId("preview-payout"), rewardId: rewards[0].id, submissionId: submissions[1].id, status: "REQUESTED", amount: share, symbol,
      txHash: null, recipientAddress: "inj1...8c1v", requestedBy: OTHER_ADMIN.id, requestedByNickname: OTHER_ADMIN.nickname, requestedAt: iso(-1),
      approvedByNickname: null, approvedAt: null, paidAt: null, requestedByMe: false,
    });
    rewards[0].allocated = share;
  }
  return {
    bounty: { id: bounty.slug, title: bounty.title, status, submissionDeadline: live ? iso(14) : bounty.deadline, maxWinners, applicationRequired: bounty.intakeEnabled },
    lifecycle: { blockers: {}, allowedTransitions: [] },
    applications, submissions, rewards, payouts,
    policy: { payoutSelfApprovalAllowed: false },
  };
}

const OPEN_PAYOUT_STATUSES: readonly string[] = ["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING"];

/**
 * BE `owesUnpaidRewardSql`: among the funded rewards this submission is owed from, one has no PAID payout. A reward is owed when the
 * submission has a payout on it that is not CANCELLED (incl. FAILED), or has no payout on it at all and the reward still has headroom.
 * A cancelled award, an exhausted pool, or no funded reward means nothing is owed.
 */
function owesUnpaidReward(ops: AdminOperations, submissionId: string): boolean {
  return ops.rewards.filter(isRewardFunded).some((reward) => {
    const mine = ops.payouts.filter((p) => p.rewardId === reward.id && p.submissionId === submissionId);
    const owed = mine.some((p) => p.status !== "CANCELLED") || (mine.length === 0 && BigInt(rewardHeadroom(reward) ?? "0") > BigInt(0));
    return owed && !mine.some((p) => p.status === "PAID");
  });
}

/**
 * Mirrors NinjaLabsBE `src/bounties/admin/bounty-lifecycle.service.ts BountyLifecycleService.blockers`, with the payout rules of
 * `src/rewards/payout-status.ts` (`OPEN_PAYOUT_STATUSES`, `owesUnpaidRewardSql`), computed from the in-memory rows.
 * The mock has no withdrawn recipients, so the BE's `recipientActiveSql` is always true here.
 */
export function lifecycleFor(ops: AdminOperations): AdminOperations["lifecycle"] {
  const blockers: Record<string, LifecycleBlocker[]> = { OPEN: [], SUBMISSION_CLOSED: [], IN_REVIEW: [], COMPLETED: [], CANCELLED: [] };
  const deadline = ops.bounty.submissionDeadline ? new Date(ops.bounty.submissionDeadline).getTime() : Number.NaN;
  const expired = !(deadline > Date.now());
  const pending = ops.applications.filter((a) => a.status === "PENDING").length;
  const unsubmitted = ops.applications.filter((a) => a.status === "APPROVED" && !ops.submissions.some((s) => s.userId === a.userId && s.agentId === a.agentId)).length;
  const unresolved = ops.submissions.filter((s) => ["SUBMITTED", "RESUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(s.status)).length;
  const unfunded = ops.rewards.filter((r) => !isRewardFunded(r)).length;
  // BE OPEN_PAYOUT_STATUSES: waiting for approval or for the transfer. FAILED/CANCELLED/PAID do not count.
  const unpaid = ops.payouts.filter((p) => OPEN_PAYOUT_STATUSES.includes(p.status)).length;
  const unawarded = ops.submissions.filter((s) => s.status === "APPROVED" && owesUnpaidReward(ops, s.id)).length;
  if (expired) blockers.OPEN.push({ code: "DEADLINE_PASSED" });
  if (unfunded) blockers.OPEN.push({ code: "REWARDS_UNFUNDED", count: unfunded });
  if (pending) {
    blockers.SUBMISSION_CLOSED.push({ code: "PENDING_APPLICATIONS", count: pending });
    blockers.COMPLETED.push({ code: "PENDING_APPLICATIONS", count: pending });
  }
  if (unsubmitted && !expired) blockers.SUBMISSION_CLOSED.push({ code: "UNSUBMITTED_PARTICIPANTS", count: unsubmitted });
  if (unresolved) blockers.COMPLETED.push({ code: "UNRESOLVED_SUBMISSIONS", count: unresolved });
  if (unpaid || unawarded) {
    blockers.COMPLETED.push({ code: "UNPAID_WINNERS" });
    // Cancelling would refund deposit minus PAID, handing an unpaid winner's share back to the sponsor — same rule, same code.
    blockers.CANCELLED.push({ code: "UNPAID_WINNERS" });
  }
  return { blockers, allowedTransitions: [...(BOUNTY_TRANSITIONS[ops.bounty.status as BountyStatusCode] ?? [])] };
}

function seedNftJobs(): AdminNftJob[] {
  const job = (id: string, overrides: Partial<AdminNftJob>): AdminNftJob => ({
    id, nftId: `${id}-nft`, jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: "node unreachable: request timed out", scheduledAt: iso(-1),
    updatedAt: iso(-1), nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: "mina", ownerWalletAddress: "inj1...5w6r", ...overrides,
  });
  return [
    job("preview-job-1", {}),
    job("preview-job-2", { jobType: "MINT_CHILD", nftType: "BOUNTY_COMPLETION_CHILD", bountyTitle: "Design system build", ownerNickname: "juho", ownerWalletAddress: "inj1...7n3q", lastError: "mint rejected: insufficient funds for gas" }),
    job("preview-job-3", { status: "PENDING", retryCount: 2, lastError: "account sequence mismatch", nftStatus: "PENDING", ownerNickname: "ara", ownerWalletAddress: "inj1...8c1v" }),
  ];
}

function seedAuditLogs(): AdminAuditLog[] {
  const log = (n: number, overrides: Partial<AdminAuditLog>): AdminAuditLog => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, actorUserId: MOCK_ADMIN_ID, actorAgentId: null, action: "PAYOUT_REQUESTED",
    entityType: "payout", entityId: "11111111-1111-4111-8111-111111111111", createdAt: iso(-n / 24), ...overrides,
  });
  return [
    log(1, { action: "PAYOUT_APPROVED" }),
    log(2, { action: "PAYOUT_SELF_APPROVED" }),
    log(3, { actorUserId: null, action: "PAYOUT_CORRECTED_MANUAL" }),
    log(4, { actorUserId: null, action: "ADMIN_GRANTED", entityType: "user", entityId: "22222222-2222-4222-8222-222222222222" }),
    log(5, { action: "PAYOUT_REQUESTED" }),
  ];
}

/**
 * In-memory twin of the operations/NFT endpoints, with the BE's status checks and error codes, so the console behaves the
 * same in mock mode. `bounties` reads the manager's current list; `onStatus` writes a transition back to it.
 */
export function createMockOperationsApi(options: {
  findBounty: (bountyId: string) => AdminBounty | undefined;
  nextId: (prefix: string) => string;
}): OperationsApi & { transitionOperations: (bountyId: string, to: string) => void } {
  const state = new Map<string, AdminOperations>();
  let nftJobs = seedNftJobs();
  const auditLogs = seedAuditLogs();
  const opsFor = (bountyId: string): AdminOperations => {
    const cached = state.get(bountyId);
    if (cached) return cached;
    const bounty = options.findBounty(bountyId);
    if (!bounty) return fail(404, "BOUNTY_NOT_FOUND");
    const seeded = seedOperations(bounty as AdminBounty, options.nextId);
    state.set(bountyId, seeded);
    return seeded;
  };
  const find = <T extends { id: string }>(pick: (ops: AdminOperations) => T[], id: string, code: string): { ops: AdminOperations; row: T } => {
    for (const ops of state.values()) {
      const row = pick(ops).find((item) => item.id === id);
      if (row) return { ops, row };
    }
    return fail(404, code);
  };
  const snapshot = (ops: AdminOperations): AdminOperations => structuredClone({ ...ops, lifecycle: lifecycleFor(ops) });
  const allocated = (ops: AdminOperations, rewardId: string) =>
    ops.payouts.filter((p) => p.rewardId === rewardId && p.status !== "CANCELLED").reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));

  return {
    getAdminOperations: async (bountyId) => snapshot(opsFor(bountyId)),
    transitionOperations: (bountyId, to) => {
      const ops = opsFor(bountyId);
      const lifecycle = lifecycleFor(ops);
      if (!lifecycle.allowedTransitions.includes(to)) fail(400, `INVALID_TRANSITION:${ops.bounty.status}->${to}`);
      if (lifecycle.blockers[to]?.length) fail(400, "VALIDATION_FAILED");
      ops.bounty.status = to;
    },
    reviewAdminApplication: async (applicationId, { decision, note }) => {
      const { ops, row } = find((o) => o.applications, applicationId, "APPLICATION_NOT_FOUND_OR_NOT_PENDING");
      if (row.status !== "PENDING") fail(404, "APPLICATION_NOT_FOUND_OR_NOT_PENDING");
      if (ops.bounty.status === "COMPLETED" || ops.bounty.status === "CANCELLED") fail(400, "BOUNTY_REVIEW_CLOSED");
      if (!applicationDecisionsFor(row, ops.bounty).includes(decision)) fail(400, "APPLICATION_APPROVAL_CLOSED");
      Object.assign(row, { status: decision, reviewNote: note?.trim() || null, reviewedAt: new Date().toISOString() });
    },
    reviewAdminSubmission: async (submissionId, { decision, revisionNo, comment }) => {
      const { ops, row } = find((o) => o.submissions, submissionId, "SUBMISSION_NOT_FOUND");
      if (!isBountyInProgress(ops.bounty.status)) fail(400, "BOUNTY_REVIEW_CLOSED");
      if (!submissionDecisionsFor(row.status, ops.bounty.status).includes(decision)) fail(400, "SUBMISSION_NOT_REVIEWABLE");
      if (revisionNo !== row.currentRevisionNo) fail(400, "SUBMISSION_REVISION_CHANGED");
      if (submissionCommentRequired(decision, row.status) && !comment?.trim()) fail(400, "REVISION_COMMENT_REQUIRED");
      if (decision === "APPROVE" && ops.submissions.filter((s) => s.status === "APPROVED").length >= ops.bounty.maxWinners) fail(400, "MAX_WINNERS_REACHED");
      const next = { START_REVIEW: "IN_REVIEW", REQUEST_REVISION: "REVISION_REQUESTED", APPROVE: "APPROVED", REJECT: "REJECTED" }[decision];
      const now = new Date().toISOString();
      Object.assign(row, { status: next, reviewedAt: now, reviewComment: comment?.trim() || row.reviewComment });
      row.reviews = [{ revisionNo: row.currentRevisionNo, decision, comment: comment?.trim() || null, createdAt: now }, ...row.reviews];
    },
    confirmAdminDeposit: async (rewardId, { txHash, depositedAmount }) => {
      if (!TOKEN_AMOUNT.test(depositedAmount)) fail(400, "INVALID_TOKEN_AMOUNT");
      if (!isTxHash(txHash)) fail(400, "INVALID_TX_HASH");
      const { row } = find((o) => o.rewards, rewardId, "REWARD_NOT_FOUND_OR_NOT_PENDING");
      if (row.status !== "DEPOSIT_PENDING" || BigInt(depositedAmount) < BigInt(row.amount)) fail(404, "REWARD_NOT_FOUND_OR_NOT_PENDING");
      const hash = `0x${txHash.trim().replace(/^0x/i, "").toLowerCase()}`;
      for (const ops of state.values()) {
        if (ops.rewards.some((r) => r.depositTxHash === hash) || ops.payouts.some((p) => p.txHash === hash)) fail(409, "TX_HASH_ALREADY_USED");
      }
      const cap = BigInt(depositedAmount) < BigInt(row.amount) ? depositedAmount : row.amount;
      Object.assign(row, { status: "FUNDED", depositTxHash: hash, depositedAmount, depositedAt: new Date().toISOString(), cap });
    },
    requestAdminPayout: async ({ rewardId, submissionId, amount }) => {
      if (!TOKEN_AMOUNT.test(amount)) fail(400, "INVALID_TOKEN_AMOUNT");
      const { ops, row: reward } = find((o) => o.rewards, rewardId, "REWARD_NOT_FOUND");
      if (!isBountyInProgress(ops.bounty.status)) fail(400, "BOUNTY_REVIEW_CLOSED");
      if (!isRewardFunded(reward)) fail(400, "REWARD_NOT_FUNDED");
      const submission = ops.submissions.find((s) => s.id === submissionId && s.status === "APPROVED" && s.recipientWalletAddress);
      if (!submission) return fail(404, "APPROVED_SUBMISSION_OR_WALLET_NOT_FOUND");
      if (ops.payouts.some((p) => p.rewardId === rewardId && p.submissionId === submissionId)) fail(409, "PAYOUT_ALREADY_REQUESTED");
      if (allocated(ops, rewardId) + BigInt(amount) > BigInt(reward.cap ?? "0")) fail(400, "PAYOUT_EXCEEDS_AVAILABLE_REWARD");
      ops.payouts.unshift({
        id: options.nextId("preview-payout"), rewardId, submissionId, status: "REQUESTED", amount, symbol: reward.symbol, txHash: null,
        recipientAddress: submission.recipientWalletAddress!, requestedBy: MOCK_ADMIN_ID, requestedByNickname: "you", requestedAt: new Date().toISOString(),
        approvedByNickname: null, approvedAt: null, paidAt: null, requestedByMe: true,
      });
      reward.allocated = allocated(ops, rewardId).toString();
      if (reward.status === "PAID") reward.status = "PARTIALLY_PAID";
    },
    approveAdminPayout: async (payoutId) => {
      const { ops, row } = find((o) => o.payouts, payoutId, "PAYOUT_NOT_FOUND_OR_WRONG_STATUS");
      if (!canApprovePayout(row)) fail(404, "PAYOUT_NOT_FOUND_OR_WRONG_STATUS");
      if (row.requestedByMe && !ops.policy.payoutSelfApprovalAllowed) fail(403, "PAYOUT_SELF_APPROVAL");
      Object.assign(row, { status: "APPROVED", approvedByNickname: "you", approvedAt: new Date().toISOString() });
    },
    markAdminPayoutPaid: async (payoutId, txHash) => {
      if (!isTxHash(txHash)) fail(400, "INVALID_TX_HASH");
      const { ops, row } = find((o) => o.payouts, payoutId, "PAYOUT_NOT_FOUND_OR_WRONG_STATUS");
      const hash = `0x${txHash.trim().replace(/^0x/i, "").toLowerCase()}`;
      for (const other of state.values()) {
        if (other.rewards.some((r) => r.depositTxHash === hash)) fail(409, "TX_HASH_ALREADY_USED");
        if (other !== ops && other.payouts.some((p) => p.txHash === hash && p.status === "PAID")) fail(409, "TX_HASH_ALREADY_USED");
      }
      if (!canMarkPayoutPaid(row)) fail(404, "PAYOUT_NOT_FOUND_OR_WRONG_STATUS");
      Object.assign(row, { status: "PAID", txHash: hash, paidAt: new Date().toISOString() });
      const reward = ops.rewards.find((r) => r.id === row.rewardId);
      if (reward) {
        const open = ops.payouts.some((p) => p.rewardId === reward.id && p.status !== "PAID" && p.status !== "CANCELLED");
        const paid = ops.payouts.filter((p) => p.rewardId === reward.id && p.status === "PAID");
        const paidAmount = paid.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
        reward.status = !open && (paid.length >= ops.bounty.maxWinners || paidAmount >= BigInt(reward.cap ?? "0")) ? "PAID" : "PARTIALLY_PAID";
      }
    },
    getAdminNftJobs: async (status, page) => {
      const pageSize = 30;
      const matching = nftJobs.filter((job) => job.status === status);
      return { items: matching.slice((page - 1) * pageSize, page * pageSize).map((job) => ({ ...job })), page, pageSize, total: matching.length };
    },
    getAdminAuditLogs: async (filter, page) => {
      const pageSize = 30;
      if (filter.entityId && !isAuditUuid(filter.entityId)) return fail(400, "VALIDATION_FAILED");
      const matching = auditLogs.filter((log) => (!filter.entityType || log.entityType === filter.entityType) && (!filter.entityId || log.entityId === filter.entityId));
      return { items: matching.slice((page - 1) * pageSize, page * pageSize).map((log) => ({ ...log })), page, pageSize, total: matching.length };
    },
    retryAdminNftJob: async (jobId) => {
      const job = nftJobs.find((item) => item.id === jobId && item.status === "FAILED");
      if (!job) return fail(404, "NFT_JOB_NOT_FOUND_OR_NOT_FAILED");
      nftJobs = nftJobs.map((item) => (item === job ? { ...item, status: "PENDING", retryCount: 0, nftStatus: item.jobType === "ATTACH_CHILD" ? "MINTED" : "PENDING", scheduledAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item));
    },
  };
}
