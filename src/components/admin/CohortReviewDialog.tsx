"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { opsDateTime, opsTextarea } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Link } from "@/i18n/navigation";
import { ERROR_COPY, type ErrorCopyKey } from "@/lib/api/error-copy";
import { COHORT_REVIEW_DECISIONS, type AdminCohortApplication, type CohortReviewDecision } from "@/lib/cohorts";
import { COHORT_REVIEW_NOTE_MAX } from "@/lib/input-limits";

type CohortReviewDialogProps = {
  /** The application under review; `null` keeps the dialog closed. Each application starts from its own saved decision and note. */
  application: AdminCohortApplication | null;
  busy: boolean;
  error: ErrorCopyKey<typeof ERROR_COPY.adminCohort> | null;
  onCancel: () => void;
  onConfirm: (input: { decision: CohortReviewDecision; note: string }) => void;
};

/**
 * Review one cohort application: every answer, the decision (accept or reject; a decided application can be decided again) and
 * an internal note. The note is the operators' own, the applicant only ever sees the status. Accepting does not make anyone a member.
 */
export function CohortReviewDialog({ application, busy, error, onCancel, onConfirm }: CohortReviewDialogProps) {
  const t = useTranslations("admin.recruitment.review");
  const tForm = useTranslations("recruit.form");
  const tErrors = useTranslations(ERROR_COPY.adminCohort.messages);
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const noteId = useId();
  const savedDecision = (row: AdminCohortApplication | null): CohortReviewDecision | null => (row && (row.status === "ACCEPTED" || row.status === "REJECTED") ? row.status : null);
  const [decision, setDecision] = useState<CohortReviewDecision | null>(savedDecision(application));
  const [note, setNote] = useState(application?.reviewNote ?? "");
  const [openedId, setOpenedId] = useState(application?.id ?? null);
  // Opening another application resets the form to that application's saved decision and note (adjusting state while rendering,
  // so the dialog stays mounted and the modal keeps its focus return).
  if (application && application.id !== openedId) {
    setOpenedId(application.id);
    setDecision(savedDecision(application));
    setNote(application.reviewNote ?? "");
  }

  const activity = application
    ? application.activityType === "OTHER" && application.activityTypeOther
      ? `${tForm("activityType.options.OTHER")}: ${application.activityTypeOther}`
      : tForm(`activityType.options.${application.activityType}`)
    : "";
  const interests = application
    ? application.interestAreas
        .map((area) => (area === "OTHER" && application.interestOther ? `${tForm("interestAreas.options.OTHER")}: ${application.interestOther}` : tForm(`interestAreas.options.${area}`)))
        .join(", ")
    : "";

  return (
    <ConfirmDialog
      confirmDisabled={decision === null}
      pending={busy}
      confirmLabel={busy ? t("saving") : decision ? t(`confirm.${decision}`) : t("confirm.none")}
      description={
        <>
          <span className="block">{t("description")}</span>
          <span className="mt-1 block">
            {t("memberNote")}{" "}
            <Link className="font-semibold text-primary" href="/admin/users">{t("memberLink")}</Link>
          </span>
        </>
      }
      eyebrow={t("eyebrow")}
      onCancel={onCancel}
      onConfirm={() => decision && onConfirm({ decision, note })}
      open={application !== null}
      title={t("title", { name: application?.displayName ?? "" })}
    >
      {application ? (
        <>
          <dl className="mt-4 grid max-h-[40vh] grid-cols-1 gap-x-4 gap-y-2 overflow-y-auto rounded-tile border border-border bg-surface-subtle p-4 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-ink-muted">{t("fields.applicant")}</dt>
            <dd className="min-w-0 break-words font-semibold text-ink">{application.user.nickname} · {application.user.email}</dd>
            <dt className="text-ink-muted">{tForm("telegram.label")}</dt>
            <dd className="min-w-0 break-words text-ink">{application.telegram}</dd>
            <dt className="text-ink-muted">{tForm("twitter.label")}</dt>
            <dd className="min-w-0 break-words text-ink">{application.twitter}</dd>
            <dt className="text-ink-muted">{tForm("web3Experience.label")}</dt>
            <dd className="min-w-0 break-words text-ink">{tForm(`web3Experience.options.${application.web3Experience}`)}</dd>
            <dt className="text-ink-muted">{tForm("activityType.label")}</dt>
            <dd className="min-w-0 break-words text-ink">{activity}</dd>
            <dt className="text-ink-muted">{tForm("interestAreas.label")}</dt>
            <dd className="min-w-0 break-words text-ink">{interests}</dd>
            <dt className="text-ink-muted">{tForm("intro.label")}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-secondary">{application.intro}</dd>
            <dt className="text-ink-muted">{t("fields.status")}</dt>
            <dd className="text-ink">{t(`statuses.${application.status}`)}{application.reviewedAt ? ` · ${opsDateTime(format, application.reviewedAt, timeZone)}` : ""}</dd>
          </dl>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-ink">{t("decision")}</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {COHORT_REVIEW_DECISIONS.map((option) => (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink max-sm:min-h-10" key={option}>
                  <input checked={decision === option} className="size-4 accent-primary" name="cohort-decision" onChange={() => setDecision(option)} type="radio" value={option} />
                  {t(`decisions.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-sm font-semibold text-ink" htmlFor={noteId}>{t("note")}</label>
          <textarea
            aria-describedby={`${noteId}-hint`}
            className={opsTextarea}
            id={noteId}
            maxLength={COHORT_REVIEW_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            value={note}
          />
          <p className="mt-1 text-xs text-ink-muted" id={`${noteId}-hint`}>{t("noteHint")}</p>
          {error ? <p className="mt-3 text-sm font-semibold text-danger" role="alert">{tErrors(error)}</p> : null}
        </>
      ) : null}
    </ConfirmDialog>
  );
}
