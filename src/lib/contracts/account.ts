import type { BountyCategory } from "@/lib/bounty-categories";
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

/**
 * Payout address fields of `GET /submissions/me` (BE #69). All absent on an older BE (then the payout form is not offered).
 * `payoutAddress` is the lowercase `inj1` form, `payoutAddressEvm` the same 20 bytes as EIP-55 `0x`; both null until entered.
 */
export type PayoutAddressFields = {
  /** The submission the address belongs to (`PUT /submissions/:id/payout-address`). */
  submissionId?: string;
  payoutAddress?: string | null;
  payoutAddressEvm?: string | null;
  payoutAddressUpdatedAt?: string | null;
  /** True while the BE still accepts a change: own APPROVED submission with no payout row yet. False = locked. */
  payoutAddressEditable?: boolean;
};

export type AccountSubmission = PayoutAddressFields & {
  bountySlug: string;
  status: SubmissionStatus;
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

export type AccountApplication = PayoutAddressFields & {
  id: string;
  /**
   * Where the row comes from. `application` = an apply-type bounty application (possibly joined with its submission).
   * `submission` = a direct submission with no application behind it; it has no Applied/Approved steps and
   * `appliedAt` is the submission time. Omitted = `application`. Both are listed together on /applications.
   */
  source?: "application" | "submission";
  bountySlug: string;
  bountyTitle: string;
  category: BountyCategory;
  /** ISO timestamp; views format it at render (`useFormatter().dateTime`). */
  appliedAt: string;
  note: string;
  status: ApplicationStatus;
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

export type Account = {
  user: ClientUser;
};
