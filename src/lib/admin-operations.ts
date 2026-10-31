// Fixture-free types and pure rules for the admin operations console (`/admin/operations`, `/admin/nft-jobs`).
// Client islands import from here; the BE mapping lives in `lib/api/admin.ts`, the in-memory twin in `lib/mocks/api-client.ts`.
// Status values stay the BE codes verbatim (the console shows operators the real state machine); copy lives under
// `admin.operations.*` / `admin.nftJobs.*`.
import { ERROR_COPY, listedCode, normalizedCode } from "./api/error-copy";
import { PAYABLE_REWARD_STATUSES } from "./payout-status";
import { isBountyFinished, isBountyInProgress, isDeadlinePassed, type BountyStatusCode } from "./bounty-status";

// The lifecycle predicates live in `bounty-status.ts`; re-exported so the console imports its rules from one place.
export { isBountyFinished, isBountyInProgress };

/** Mirror of the BE transition table (`bounty-status.ts TRANSITIONS`) - the mock uses it; api mode reads `lifecycle.allowedTransitions`. */
export const BOUNTY_TRANSITIONS: Readonly<Partial<Record<BountyStatusCode, readonly BountyStatusCode[]>>> = {
  DRAFT: ["FUNDING_PENDING", "OPEN", "CANCELLED"],
  FUNDING_PENDING: ["OPEN", "CANCELLED"],
  OPEN: ["SUBMISSION_CLOSED", "CANCELLED"],
  SUBMISSION_CLOSED: ["IN_REVIEW", "OPEN"],
  IN_REVIEW: ["COMPLETED", "OPEN"],
};

/** BE `LifecycleBlockerCode` (bounty-lifecycle.service.ts) - `admin.operations.blockers.<code>`. */
export const LIFECYCLE_BLOCKER_CODES = ["DEADLINE_PASSED", "REWARDS_UNFUNDED", "PENDING_APPLICATIONS", "UNSUBMITTED_PARTICIPANTS", "UNRESOLVED_SUBMISSIONS", "UNPAID_WINNERS"] as const;
export type LifecycleBlockerCode = (typeof LIFECYCLE_BLOCKER_CODES)[number];
export type LifecycleBlocker = { code: LifecycleBlockerCode | (string & {}); count?: number };

export type OpsActor = {
  kind: "USER" | "AGENT";
  /** Applicant, or the agent's owner. */
  userId: string | null;
  nickname: string | null;
  agentId: string | null;
  agentName: string | null;
};

export type OpsApplication = OpsActor & {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | (string & {});
  message: string;
  portfolioUrl: string | null;
  reviewNote: string | null;
  appliedAt: string;
  reviewedAt: string | null;
};

export type OpsRevision = { revisionNo: number; submissionUrl: string; description: string; repositoryUrl: string | null; commitSha: string | null; createdAt: string };
export type OpsReview = { revisionNo: number | null; decision: SubmissionDecision | (string & {}); comment: string | null; createdAt: string };

export type OpsSubmission = OpsActor & {
  id: string;
  status: "SUBMITTED" | "RESUBMITTED" | "IN_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "REJECTED" | "WITHDRAWN" | (string & {});
  /** Sent back as `revisionNo` so a resubmission landing mid-review answers SUBMISSION_REVISION_CHANGED instead of approving unseen work. */
  currentRevisionNo: number;
  submittedAt: string;
  reviewedAt: string | null;
  /** Owner's active primary wallet; null → a payout request answers APPROVED_SUBMISSION_OR_WALLET_NOT_FOUND. */
  recipientWalletAddress: string | null;
  reviewComment: string | null;
  /** Newest first - `revisions[0]` is the revision under review. */
  revisions: OpsRevision[];
  reviews: OpsReview[];
};

/** Amounts are BE integer strings in minimum token units; `lib/api/codecs.ts baseUnitsToHuman` formats them. */
export type OpsReward = {
  id: string;
  status: "DEPOSIT_PENDING" | "FUNDED" | "PARTIALLY_PAID" | "PAID" | "REFUND_PENDING" | "REFUNDED" | "CANCELLED" | (string & {});
  symbol: string;
  amount: string;
  depositedAmount: string | null;
  depositedAt: string | null;
  depositTxHash: string | null;
  custodyAddress: string | null;
  /** LEAST(amount, deposited) - the payout allocation cap (null before the deposit). */
  cap: string | null;
  /** Sum of non-cancelled payouts. */
  allocated: string;
};

export type OpsPayout = {
  id: string;
  rewardId: string;
  submissionId: string;
  status: "REQUESTED" | "AWAITING_MULTISIG_APPROVAL" | "APPROVED" | "BROADCASTING" | "PAID" | "FAILED" | "CANCELLED" | (string & {});
  amount: string;
  symbol: string;
  txHash: string | null;
  recipientAddress: string;
  requestedBy: string;
  requestedByNickname: string | null;
  requestedAt: string;
  approvedByNickname: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  /** The viewing admin requested it - under the two-person rule the BE answers 403 PAYOUT_SELF_APPROVAL. */
  requestedByMe: boolean;
};

export type AdminOperations = {
  bounty: { id: string; title: string; status: BountyStatusCode | (string & {}); submissionDeadline: string | null; maxWinners: number; applicationRequired: boolean };
  lifecycle: { blockers: Partial<Record<string, LifecycleBlocker[]>>; allowedTransitions: string[] };
  applications: OpsApplication[];
  submissions: OpsSubmission[];
  rewards: OpsReward[];
  payouts: OpsPayout[];
  policy: { payoutSelfApprovalAllowed: boolean };
};

export type SubmissionDecision = "START_REVIEW" | "REQUEST_REVISION" | "APPROVE" | "REJECT";

/** Decisions the BE accepts for a submission status (submission-review.service.ts), in button order. */
export function submissionDecisionsFor(status: string, bountyStatus: string): SubmissionDecision[] {
  if (!isBountyInProgress(bountyStatus)) return [];
  if (status === "SUBMITTED" || status === "RESUBMITTED") return ["START_REVIEW", "REQUEST_REVISION", "APPROVE", "REJECT"];
  if (status === "IN_REVIEW") return ["REQUEST_REVISION", "APPROVE", "REJECT"];
  if (status === "REVISION_REQUESTED") return ["REJECT"];
  return [];
}

/** BE REVISION_COMMENT_REQUIRED: a revision request, or rejecting a submission that is waiting for a revision. */
export const submissionCommentRequired = (decision: SubmissionDecision, status: string): boolean =>
  decision === "REQUEST_REVISION" || (decision === "REJECT" && status === "REVISION_REQUESTED");

/** BE application review: PENDING only; approval also needs OPEN + a future submission deadline (APPLICATION_APPROVAL_CLOSED). */
export function applicationDecisionsFor(application: Pick<OpsApplication, "status">, bounty: AdminOperations["bounty"], now = Date.now()): Array<"APPROVED" | "REJECTED"> {
  if (application.status !== "PENDING" || isBountyFinished(bounty.status)) return [];
  // A missing deadline cannot be "in the future", so it closes approval like a passed one.
  const open = bounty.status === "OPEN" && Boolean(bounty.submissionDeadline) && !isDeadlinePassed(bounty.submissionDeadline, now);
  return open ? ["APPROVED", "REJECTED"] : ["REJECTED"];
}

export const canApprovePayout = (payout: Pick<OpsPayout, "status">): boolean => payout.status === "REQUESTED" || payout.status === "AWAITING_MULTISIG_APPROVAL";
export const canMarkPayoutPaid = (payout: Pick<OpsPayout, "status">): boolean => payout.status === "APPROVED" || payout.status === "BROADCASTING";
export const isRewardFunded = (reward: Pick<OpsReward, "status">): boolean => PAYABLE_REWARD_STATUSES.includes(reward.status);

/** Two-person rule as the console shows it: blocked (needs another admin), allowed-with-audit, or a normal approval. */
export function payoutApprovalMode(payout: Pick<OpsPayout, "requestedByMe">, policy: AdminOperations["policy"]): "self-blocked" | "self-allowed" | "normal" {
  if (!payout.requestedByMe) return "normal";
  return policy.payoutSelfApprovalAllowed ? "self-allowed" : "self-blocked";
}

/** Approved submissions that still have no payout on `rewardId` (BE PAYOUT_ALREADY_REQUESTED otherwise). */
export function payoutCandidates(operations: Pick<AdminOperations, "submissions" | "payouts">, rewardId: string): OpsSubmission[] {
  const paid = new Set(operations.payouts.filter((payout) => payout.rewardId === rewardId).map((payout) => payout.submissionId));
  return operations.submissions.filter((submission) => submission.status === "APPROVED" && !paid.has(submission.id));
}

/** Headroom left under the allocation cap, in base units (never negative); null before the deposit. */
export function rewardHeadroom(reward: Pick<OpsReward, "cap" | "allocated">): string | null {
  if (reward.cap === null) return null;
  try {
    const left = BigInt(reward.cap) - BigInt(reward.allocated || "0");
    return (left > BigInt(0) ? left : BigInt(0)).toString();
  } catch {
    return null;
  }
}

/** Mirror of NinjaLabsBE `common/validation/tx-hash.ts TX_HASH` (32-byte hex, optional lowercase `0x`, surrounding spaces trimmed). */
const TX_HASH_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;
export const isTxHash = (value: string): boolean => TX_HASH_PATTERN.test(value.trim());

// ── NFT jobs ────────────────────────────────────────────
export const NFT_JOB_STATUSES = ["FAILED", "PENDING", "PROCESSING"] as const;
export type NftJobStatus = (typeof NFT_JOB_STATUSES)[number];

export type AdminNftJob = {
  id: string;
  nftId: string;
  jobType: "MINT_PARENT" | "MINT_CHILD" | "ATTACH_CHILD" | "RETRY_MINT" | "RETRY_ATTACH" | (string & {});
  status: NftJobStatus | (string & {});
  retryCount: number;
  lastError: string | null;
  scheduledAt: string | null;
  updatedAt: string | null;
  nftType: "NINJA_PARENT" | "BOUNTY_COMPLETION_CHILD" | (string & {});
  nftStatus: string;
  bountyTitle: string | null;
  ownerNickname: string | null;
  ownerWalletAddress: string | null;
};

export type AdminNftJobPage = { items: AdminNftJob[]; page: number; pageSize: number; total: number };

// ── errors ──────────────────────────────────────────────
/**
 * Every BE code the operations/NFT endpoints answer with (plus the FE transport codes) - each has
 * `admin.operations.errors.<CODE>` in all three locales; anything else renders `errors.unknown` with the raw code.
 * 코드 목록은 `lib/api/error-copy.ts`의 `ERROR_COPY.adminOperations`가 소유한다 - 추가/삭제는 거기서.
 */
export const OPS_ERROR_CODES = ERROR_COPY.adminOperations.codes;

/**
 * Normalizes a failed operations call to a message code: `normalizedCode` (non-HTTP failure → `NETWORK_ERROR`, 401 → `UNAUTHORIZED`,
 * 429 → `TOO_MANY_REQUESTS`, else the BE code), then two ops-specific rules: `INVALID_TRANSITION:OPEN->COMPLETED` → `INVALID_TRANSITION`;
 * a transition's 400 with a blocker list (Nest sends `message: string[]`, surfaced as VALIDATION_FAILED) → `TRANSITION_BLOCKED`.
 * Returns `{ code, known }` - unknown codes keep their raw value for the `errors.unknown` copy.
 */
export function opsErrorCode(error: unknown, context: "transition" | "other" = "other"): { code: string; known: boolean } {
  let code = normalizedCode(error);
  if (code.startsWith("INVALID_TRANSITION")) code = "INVALID_TRANSITION";
  else if (code === "VALIDATION_FAILED" && context === "transition") code = "TRANSITION_BLOCKED";
  return { code, known: listedCode(code, OPS_ERROR_CODES) !== null };
}
