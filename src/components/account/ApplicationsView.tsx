"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
  useBountyApi,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Link } from "@/i18n/navigation";
import { ERROR_COPY, errorCopyKey } from "@/lib/api/error-copy";
import { pushFlash } from "@/lib/flash";
import type { AccountApplication, ApplicationStatus } from "@/lib/contracts/account";
import type { PayoutStatus } from "@/lib/types";
import { payoutBadge } from "@/lib/payout";
import { parseReviewComment, REVIEW_TEXT_CLASS } from "@/lib/review-comment";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Badge color of each application status (also used by the home page's activity list). */
export const statusVariants: Record<ApplicationStatus, "neutral" | "warning" | "success" | "primary-soft" | "danger"> = {
  open: "neutral",
  approved: "success",
  submitted: "primary-soft",
  completed: "success",
  rejected: "danger",
  notAccepted: "danger",
  revisionRequested: "warning",
};

const outlineDangerClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

// Step labels live under account.applications.steps, keyed by status.
const applicationSteps: readonly ApplicationStatus[] = ["open", "approved", "submitted", "completed"];
// A submission with no application behind it (direct or agent-mode bounty) skips Applied/Approved.
const submissionSteps: readonly ApplicationStatus[] = ["submitted", "completed"];

/** The bounty behind the row no longer takes submissions. False when the BE did not send the bounty fields (older BE). */
export function isClosedForSubmit(application: Pick<AccountApplication, "bountyStatus" | "submissionDeadline">, now: number = Date.now()): boolean {
  const { bountyStatus, submissionDeadline } = application;
  if (!bountyStatus) return false;
  if (bountyStatus !== "OPEN") return true;
  return submissionDeadline !== undefined && new Date(submissionDeadline).getTime() <= now;
}

/**
 * The status words of a row (badge text). Single source for the My applications page and the home activity list, so a
 * forfeited award reads the same everywhere. `t` is `useTranslations("account.applications")`.
 */
export function applicationStatusLabel(
  t: (key: string, values?: Record<string, string>) => string,
  application: Pick<AccountApplication, "status" | "agent" | "reviewComment"> & Partial<Pick<AccountApplication, "closedByCancellation" | "bountyStatus" | "submissionDeadline">>,
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

/** Final state of an approved application whose submission was rejected; a forfeited award names the reason. */
function NotAcceptedNote({ application }: { application: AccountApplication }) {
  const t = useTranslations("account.applications");
  const review = parseReviewComment(application.reviewComment);
  if (review?.forfeited) return <p className={`mt-4 text-sm text-danger ${REVIEW_TEXT_CLASS}`}>{t("forfeitedNote", { reason: review.text })}</p>;
  return (
    <>
      <p className="mt-4 text-sm text-ink-muted">{t("notAcceptedNote")}</p>
      {review ? <p className={`mt-1 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{t("reviewerComment", { comment: review.text })}</p> : null}
    </>
  );
}

/** What the operator wrote when deciding this application (approve or reject); the admin form tells them the applicant sees it. */
function ApplicationNote({ application }: { application: AccountApplication }) {
  const t = useTranslations("account.applications");
  if (!application.reviewNote) return null;
  return <p className={`mt-1 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{t("sponsorNote", { note: application.reviewNote })}</p>;
}

/** Payout status of a completed (APPROVED) submission: Paid / Partially paid / Payout pending; NONE shows nothing. */
function PayoutLine({ status }: { status: PayoutStatus }) {
  const t = useTranslations("account.applications");
  const badge = payoutBadge(status, { showPaid: true });
  return badge ? <div className="mt-3"><Badge variant={badge.variant}>{t(badge.key)}</Badge></div> : null;
}

/** Approved work the reviewer sent back: the reviewer comment and the way back to the resubmit form on the bounty page. */
function RevisionNote({ application }: { application: AccountApplication }) {
  const t = useTranslations("account.applications");
  const review = parseReviewComment(application.reviewComment);
  return (
    <>
      <p className="mt-4 text-sm text-warning">{application.agent ? t("agentRevisionNote", { name: application.agent.name }) : t("revisionNote")}</p>
      {review ? <p className={`mt-1 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{t("reviewerComment", { comment: review.text })}</p> : null}
    </>
  );
}

export function ApplicationsView() {
  const t = useTranslations("account.applications");
  const tAccount = useTranslations("account.common");
  // Page-load time: deadlines are compared once per visit (the BE re-checks on submit).
  const [now] = useState(() => Date.now());
  const tBounties = useTranslations("bounties.categories");
  const format = useFormatter();
  const statusLabel = (application: AccountApplication): string => applicationStatusLabel(t, application, now);
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useAccountApi();
  const bountyApi = useBountyApi();
  const { data: applications, unavailable, reason, refresh } = useAccountQuery(apiClient.getApplications);
  const tErrors = useTranslations(ERROR_COPY.applicationWithdraw.messages);
  const [target, setTarget] = useState<AccountApplication | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const pendingRef = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);
  // The withdrawn card disappears with its button, so focus moves to the list instead of <body>.
  const focusList = () => listRef.current;

  const withdraw = async (application: AccountApplication) => {
    setTarget(null);
    if (pendingRef.current.has(application.id)) return;
    pendingRef.current.add(application.id);
    setBusyId(application.id);
    setNotice("");
    setErrors((current) => ({ ...current, [application.id]: "" }));
    try {
      await bountyApi.withdrawApplication(application.id);
      setNotice(t("withdrawn"));
      // The card (and its button) disappears, so the sr-only line alone leaves sighted users without a result.
      pushFlash("applicationWithdrawn");
      refresh();
    } catch (error) {
      const key = errorCopyKey(error, ERROR_COPY.applicationWithdraw);
      setErrors((current) => ({ ...current, [application.id]: tErrors(key) }));
      // A stale row (already reviewed elsewhere) should refresh so the card reflects the real state.
      if (key === "APPLICATION_NOT_FOUND_OR_NOT_PENDING") refresh();
    } finally {
      pendingRef.current.delete(application.id);
      setBusyId(null);
    }
  };

  // The BE rejected the session (401/403 after refresh): ask to sign in again instead of blaming the server.
  if (unavailable && reason === "unauthorized") {
    return <SignedOutPanel message={tAccount("sessionExpired")} returnTo="/applications" />;
  }

  if (unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("unavailableTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{tAccount("unavailableBody")}</p>
      </div>
    );
  }

  if (authSnapshot.status === "signed-out") {
    return <SignedOutPanel message={t("signedOutMessage")} returnTo="/applications" />;
  }

  if (authSnapshot.status === "loading" || !applications) {
    return <p className="text-sm text-ink-muted" role="status">{tAccount("loading")}</p>;
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        {/* Withdrawing the last application lands here: keep announcing the result. */}
        <p className="sr-only" role="status">{notice}</p>
        <p className="text-sm font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
        <Link
          className={`mt-4 inline-block rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong ${focusClass}`}
          href="/bounties"
        >
          {t("browseBounties")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="sr-only" role="status">{notice}</p>
      <div className="space-y-5" ref={listRef} tabIndex={-1}>
        {applications.map((application) => {
          const actionNeeded = application.status === "revisionRequested";
          const cancelled = application.bountyStatus === "CANCELLED";
          // An approved application with no submission yet cannot start work on a closed bounty; resubmission rules stay on the detail page.
          const approvedClosed = application.status === "approved" && isClosedForSubmit(application, now);
          // A pending application that can no longer be approved (deadline passed or bounty no longer OPEN): no progress steps, no Withdraw.
          const pendingClosed = application.status === "open" && isClosedForSubmit(application, now);
          // A requested revision is still the "Submitted" step; the marker says the next move is the applicant's.
          const steps = application.source === "submission" ? submissionSteps : applicationSteps;
          const currentIndex = steps.indexOf(actionNeeded ? "submitted" : application.status);

          return (
            <article
              className="rounded-card border border-border bg-surface p-5 shadow-card"
              key={application.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 max-w-full flex-wrap gap-2">
                  <Badge variant="primary-soft">{tBounties(application.category)}</Badge>
                  <Badge variant={application.closedByCancellation || approvedClosed ? "neutral" : statusVariants[application.status]}>
                    {statusLabel(application)}
                  </Badge>
                  {application.agent ? (
                    <Badge variant="neutral">{t("viaAgent", { name: application.agent.name })}</Badge>
                  ) : null}
                </span>
                <span className="text-xs text-ink-muted">{t(application.source === "submission" ? "submittedAt" : "appliedAt", { date: format.dateTime(new Date(application.appliedAt), { dateStyle: "medium" }) })}</span>
              </div>

              <Link
                className={`mt-3 inline-block font-display text-lg font-bold text-ink [overflow-wrap:anywhere] ${focusClass}`}
                href={`/bounties/${application.bountySlug}`}
              >
                {application.bountyTitle}
              </Link>
              <p className={`mt-1 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{application.note}</p>

              {application.status === "rejected" ? (
                <>
                  <p className="mt-4 text-sm text-ink-muted">{t(cancelled ? "cancelledNote" : "rejectedNote")}</p>
                  <ApplicationNote application={application} />
                </>
              ) : pendingClosed ? (
                <p className="mt-4 text-sm text-ink-muted">{t("pendingClosedNote")}</p>
              ) : application.status === "notAccepted" ? (
                application.closedByCancellation ? <p className="mt-4 text-sm text-ink-muted">{t("cancelledSubmissionNote")}</p> : <NotAcceptedNote application={application} />
              ) : (
                <ol
                  aria-label={t("progressLabel")}
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
                >
                  {steps.map((step, index) => (
                    <li
                      aria-current={index === currentIndex ? "step" : undefined}
                      className="flex items-center gap-2"
                      key={step}
                    >
                      <span
                        className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                          index < currentIndex
                            ? "bg-primary-soft-border text-primary-strong"
                            : index === currentIndex
                              ? "bg-primary text-on-inverse"
                              : "bg-surface-subtle text-ink-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`text-sm font-semibold ${index === currentIndex ? "text-ink" : "text-ink-muted"}`}
                      >
                        {t(`steps.${step}`)}
                      </span>
                      {actionNeeded && index === currentIndex ? <Badge variant="warning">{t("actionNeeded")}</Badge> : null}
                      {index < steps.length - 1 ? (
                        <span aria-hidden="true" className="hidden h-px w-5 bg-primary-outline sm:block" />
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}

              {application.status === "completed" && application.paymentStatus ? <PayoutLine status={application.paymentStatus} /> : null}
              {application.status === "approved" ? <ApplicationNote application={application} /> : null}
              {approvedClosed ? <p className="mt-4 text-sm text-ink-muted">{t("approvedClosedNote")}</p> : null}
              {actionNeeded ? <RevisionNote application={application} /> : null}
              {/* An agent's submission is resubmitted through the Agent API, not from this page (see the revision note). */}
              {(application.status === "approved" && !application.agent) || (actionNeeded && !application.agent) ? (
                <Link
                  className={approvedClosed
                    ? `mt-4 inline-block rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong ${focusClass}`
                    : `mt-4 inline-block rounded-control bg-primary px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-on-inverse ${focusClass}`}
                  href={`/bounties/${application.bountySlug}`}
                >
                  {actionNeeded ? t("resubmit") : approvedClosed ? t("viewBounty") : t("submitWork")}
                </Link>
              ) : null}
              {application.status === "open" && !pendingClosed ? (
                <div className="mt-4">
                  <button
                    className={outlineDangerClass}
                    disabled={busyId === application.id}
                    onClick={() => setTarget(application)}
                    type="button"
                  >
                    {busyId === application.id ? t("withdrawing") : t("withdraw")}
                  </button>
                </div>
              ) : null}
              {errors[application.id] ? (
                <p className="mt-3 text-sm text-danger" role="alert">{errors[application.id]}</p>
              ) : null}
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        confirmLabel={t("withdrawDialog.confirm")}
        description={t("withdrawDialog.description")}
        destructive
        eyebrow={t("withdrawDialog.eyebrow")}
        onCancel={() => setTarget(null)}
        onConfirm={() => { if (target) void withdraw(target); }}
        open={target !== null}
        returnFocusTo={focusList}
        title={t("withdrawDialog.title", { title: target?.bountyTitle ?? "" })}
      />

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">{tAccount("mockNote")}</p>
      ) : null}
    </>
  );
}
