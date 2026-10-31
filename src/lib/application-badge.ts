// Single source for the status badge of one of my bounty applications (color and words). `/applications` and the home activity
// list both draw it from here, so a row reads the same on both pages; the home card only shortens "Approved: submit unlocked"
// to the step name (`compact`).
import { isDeadlinePassed } from "./bounty-status";
import type { AccountApplication, ApplicationStatus } from "./contracts/account";
import { parseReviewComment } from "./review-comment";

export type ApplicationBadgeVariant = "neutral" | "warning" | "success" | "primary-soft" | "danger";

/** Badge color of each status before the bounty's own state is taken into account (see `applicationBadge`). */
const APPLICATION_STATUS_VARIANTS: Record<ApplicationStatus, ApplicationBadgeVariant> = {
  open: "neutral",
  approved: "success",
  submitted: "primary-soft",
  completed: "success",
  rejected: "danger",
  notAccepted: "danger",
  revisionRequested: "warning",
};

type BadgeRow = Pick<AccountApplication, "status" | "agent" | "reviewComment"> &
  Partial<Pick<AccountApplication, "closedByCancellation" | "bountyStatus" | "submissionDeadline">>;

/** The bounty behind the row no longer takes submissions. False when the BE did not send the bounty fields (older BE). */
export function isClosedForSubmit(application: Pick<AccountApplication, "bountyStatus" | "submissionDeadline">, now: number = Date.now()): boolean {
  const { bountyStatus, submissionDeadline } = application;
  if (!bountyStatus) return false;
  if (bountyStatus !== "OPEN") return true;
  return isDeadlinePassed(submissionDeadline, now, { invalidPassed: false });
}

/** The row belongs to a bounty the sponsor cancelled (its submission closed by the cancellation, or the bounty itself CANCELLED). */
function isOnCancelledBounty(application: Pick<AccountApplication, "closedByCancellation" | "bountyStatus">): boolean {
  return application.closedByCancellation === true || application.bountyStatus === "CANCELLED";
}

/**
 * The status words of a row (badge text). A reward-not-paid case reads the same on every page.
 * `t` is `useTranslations("account.applications")`.
 */
export function applicationStatusLabel(
  t: (key: string, values?: Record<string, string>) => string,
  application: BadgeRow,
  now: number = Date.now(),
): string {
  const { status } = application;
  const closedForSubmit = isClosedForSubmit(application, now);
  // An approved application on a bounty that stopped taking submissions: "submit unlocked" would be false.
  if (status === "approved" && closedForSubmit) return t("approvedClosedStatus");
  // The BE approves only an OPEN bounty before its submission deadline, so a pending application past either can never be approved.
  if (status === "open" && closedForSubmit) return t("pendingClosedStatus");
  if (status === "approved") return application.agent ? t("agentApprovedStatus", { name: application.agent.name }) : t("approvedStatus");
  if (status === "revisionRequested") return t("revisionRequestedStatus");
  if (status === "rejected") return t("rejectedStatus");
  if (status === "notAccepted" && application.closedByCancellation) return t("cancelledSubmissionStatus");
  if (status === "notAccepted") return parseReviewComment(application.reviewComment)?.forfeited ? t("forfeitedStatus") : t("notAcceptedStatus");
  return t(`steps.${status}`);
}

/**
 * Badge color of a row. Product rule (2026-10-31): any row on a cancelled bounty is neutral (gray), whatever its status; an
 * approved row whose bounty stopped taking submissions is neutral too (nothing left to do). Otherwise the status color.
 */
export function applicationBadgeVariant(application: BadgeRow, now: number = Date.now()): ApplicationBadgeVariant {
  if (isOnCancelledBounty(application)) return "neutral";
  if (application.status === "approved" && isClosedForSubmit(application, now)) return "neutral";
  return APPLICATION_STATUS_VARIANTS[application.status];
}

/** Color and words of a row's badge. `compact` (home card) names an approved, still-open row by its step ("Approved"). */
export function applicationBadge(
  t: (key: string, values?: Record<string, string>) => string,
  application: BadgeRow,
  now: number = Date.now(),
  { compact = false }: { compact?: boolean } = {},
): { variant: ApplicationBadgeVariant; label: string } {
  const shortApproved = compact && application.status === "approved" && !isClosedForSubmit(application, now);
  return {
    variant: applicationBadgeVariant(application, now),
    label: shortApproved ? t("steps.approved") : applicationStatusLabel(t, application, now),
  };
}
