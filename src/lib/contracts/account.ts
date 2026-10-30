import type { ClientUser } from "@/lib/contracts/auth";
import type { PayoutStatus } from "@/lib/types";

/**
 * FE steps of an application; `open` = BE PENDING (applied, awaiting the sponsor), `submitted`/`completed` come from the submission join.
 * `revisionRequested` = approved application whose submission needs changes: still the "Submitted" step, with an action-needed marker and a resubmit link.
 * `notAccepted` = approved application whose submission was finally REJECTED (including a reward-not-paid case): a final state, not a step.
 */
export type ApplicationStatus = "open" | "approved" | "submitted" | "completed" | "rejected" | "notAccepted" | "revisionRequested";

export type SubmissionStatus =
  | "submitted"
  | "resubmitted"
  | "in_review"
  | "revision_requested"
  | "approved"
  | "rejected";

/** Agent that made an application/submission on the owner's behalf; null when the owner acted directly. */
export type AccountAgentRef = { id: string; name: string };

export type AccountSubmission = {
  bountySlug: string;
  status: SubmissionStatus;
  agent: AccountAgentRef | null;
  /** BE `payment_status` (same rule as the public profile's `payoutStatus`); NONE when an older BE omits it. */
  paymentStatus: PayoutStatus;
  /** BE `review_comment`: the latest reviewer comment (revision request, rejection, or `forfeited: <reason>`); null when none. */
  reviewComment: string | null;
  /**
   * True when the BE says this REJECTED submission was closed by the sponsor cancelling the bounty without any review
   * (`bounty_status` CANCELLED and `has_review` false). Absent when the BE predates those fields (today's copy applies).
   */
  closedByCancellation?: boolean;
  /**
   * The content of the current submission (BE `GET /submissions/me`: `submission_url`, `repository_url`, `commit_sha`, `description`).
   * Each is absent when the BE predates it or the value is empty; the resubmit form pre-fills from these.
   */
  submissionUrl?: string;
  repositoryUrl?: string;
  commitSha?: string;
  description?: string;
};

export type AccountApplication = {
  id: string;
  /**
   * Where the row comes from. `application` = an apply-type bounty application (possibly joined with its submission).
   * `submission` = a direct or agent-mode submission with no application behind it; it has no Applied/Approved steps and
   * `appliedAt` is the submission time. Omitted = `application`. Both are listed together on /applications.
   */
  source?: "application" | "submission";
  bountySlug: string;
  bountyTitle: string;
  category: "Dev" | "Design" | "Content" | "Other";
  /** ISO timestamp; views format it at render (`useFormatter().dateTime`). */
  appliedAt: string;
  note: string;
  status: ApplicationStatus;
  agent: AccountAgentRef | null;
  /** Reviewer comment of the joined submission (set for `notAccepted`/`revisionRequested`, e.g. `forfeited: <reason>`); null otherwise. */
  reviewComment: string | null;
  /** BE `review_note`: what the operator wrote when approving/rejecting the application itself ("The note is shown to the applicant"); null when none. */
  reviewNote: string | null;
  /** Payout status of the joined APPROVED submission (meaningful for `completed` rows; NONE otherwise). Same rule as `AccountSubmission.paymentStatus`. */
  paymentStatus: PayoutStatus;
  /** Set on a `notAccepted` row whose submission was closed by a bounty cancellation with no review (see `AccountSubmission.closedByCancellation`). */
  closedByCancellation?: boolean;
  /** BE `bounty_status` of the bounty behind the row. Absent when the BE predates the field (the card then renders from the application status alone). */
  bountyStatus?: BountyStatusCode;
  /** BE `submission_deadline` (ISO); absent with the field above. */
  submissionDeadline?: string;
  /** BE `application_deadline` (ISO); null when the bounty has none, absent with the field above. */
  applicationDeadline?: string | null;
};

export type BountyStatusCode = "OPEN" | "SUBMISSION_CLOSED" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";

export type AgentStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
export type AgentKeyStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export type AccountAgent = {
  id: string;
  name: string;
  walletAddress: string;
  status: AgentStatus;
  verified: boolean;
  completedBounties: number;
  apiKeyMasked: string;
  /** ISO timestamp; null when no key has been issued. */
  keyExpiresAt: string | null;
  keyStatus: AgentKeyStatus | null;
  /** ISO timestamp; views format it at render (`useFormatter().dateTime`). */
  registeredAt: string;
};

export type Account = {
  user: ClientUser;
};
