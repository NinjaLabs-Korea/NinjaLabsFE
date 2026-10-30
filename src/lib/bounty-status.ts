// Single source for the BE bounty lifecycle on the FE. Every fold of the 7 BE statuses (public 3-state status, the reason a
// public bounty is `closed`, the admin status, "in progress" / "finished") lives here, so a new BE status is found in one file.
// Mirror of NinjaLabsBE/src/bounties/bounty-status.ts; the transition table stays in `lib/admin-operations.ts`.
import type { AdminBounty } from "./admin-helpers";
import type { Bounty } from "./types";

/** BE `bounty.status`. */
export type BountyStatusCode = "DRAFT" | "FUNDING_PENDING" | "OPEN" | "SUBMISSION_CLOSED" | "IN_REVIEW" | "COMPLETED" | "CANCELLED";

/** BE `BountyStatusPolicy.isInProgress`: reviews and payout requests are accepted only here. */
export const IN_PROGRESS: ReadonlySet<string> = new Set<BountyStatusCode>(["OPEN", "SUBMISSION_CLOSED", "IN_REVIEW"]);
/** Terminal statuses. */
export const FINISHED: ReadonlySet<string> = new Set<BountyStatusCode>(["COMPLETED", "CANCELLED"]);

export const isBountyInProgress = (code: string): boolean => IN_PROGRESS.has(code);
export const isBountyFinished = (code: string): boolean => FINISHED.has(code);

/** Why a public `closed` bounty is closed: finished work, a cancellation, or only its deadline having passed. */
export type ClosedReason = "completed" | "cancelled" | "deadline";

/** BE lifecycle → public status, ignoring the deadline. DRAFT/FUNDING_PENDING never reach the public list, so anything else that is not open or under review is closed. */
export function toLifecycleStatus(code: string): Bounty["status"] {
  if (code === "OPEN") return "active";
  if (code === "SUBMISSION_CLOSED" || code === "IN_REVIEW") return "reviewing";
  return "closed";
}

/**
 * Public status including the deadline: a BE `OPEN` bounty whose `submission_deadline` has passed (or cannot be parsed)
 * no longer accepts applications or submissions (BE answers DEADLINE_PASSED), so it presents as `closed` - status badge,
 * list chip and action panel alike - instead of "Active" with no countdown.
 */
export function toPublicStatus(code: string, submissionDeadline: string, now = Date.now()): Bounty["status"] {
  if (code !== "OPEN") return toLifecycleStatus(code);
  const deadline = new Date(submissionDeadline).getTime();
  return Number.isNaN(deadline) || deadline <= now ? "closed" : "active";
}

/** The reason behind a public `closed` (`undefined` while the bounty is `active` or `reviewing`). Unknown BE statuses read as cancelled, like every other non-open one. */
export function toClosedReason(code: string, publicStatus: Bounty["status"]): ClosedReason | undefined {
  if (publicStatus !== "closed") return undefined;
  if (code === "COMPLETED") return "completed";
  if (code === "OPEN") return "deadline";
  return "cancelled";
}

const ADMIN_STATUS: Record<BountyStatusCode, AdminBounty["status"]> = {
  DRAFT: "draft", FUNDING_PENDING: "funding", OPEN: "active", SUBMISSION_CLOSED: "submissionClosed", IN_REVIEW: "reviewing", COMPLETED: "completed", CANCELLED: "cancelled",
};
const CODE_BY_ADMIN_STATUS = Object.fromEntries(Object.entries(ADMIN_STATUS).map(([code, status]) => [status, code])) as Record<AdminBounty["status"], BountyStatusCode>;

/** BE status → admin list status. COMPLETED, and any status a newer BE adds, shows as finished rather than guessed. */
export function toAdminStatus(code: string): AdminBounty["status"] {
  return ADMIN_STATUS[code as BountyStatusCode] ?? "completed";
}

/** Inverse of `toAdminStatus` (the in-memory preview keeps admin statuses and needs the BE code). */
export function fromAdminStatus(status: AdminBounty["status"]): BountyStatusCode {
  return CODE_BY_ADMIN_STATUS[status];
}
