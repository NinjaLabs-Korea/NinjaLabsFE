"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSingleFlight } from "@/components/ui/useSingleFlight";
import { ERROR_COPY, errorCopyKey, type ErrorCopyKey } from "@/lib/api/error-copy";
import type { CohortApplicationStatus, MyCohortApplication } from "@/lib/cohorts";

const statusVariant = {
  SUBMITTED: "warning",
  ACCEPTED: "success",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
} as const satisfies Record<CohortApplicationStatus, string>;

const buttonClass =
  "rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClass =
  "rounded-control border border-danger px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

type CohortApplicationCardProps = {
  application: MyCohortApplication;
  /** `full` lists every answer (the /recruit page); `compact` is the status line used on the account page and the home. */
  variant?: "full" | "compact";
  /** Present when the application can be edited (SUBMITTED and the cohort accepts): shows the Edit button. */
  onEdit?: () => void;
  /** Called after a withdrawal (or a stale-state error) so the owner re-reads the list. */
  onChanged?: () => void;
};

/**
 * One of my cohort applications: cohort, status badge and what the status means. The applicant never sees the reviewer's
 * note (the BE does not send it): the result is the status alone. Edit and Withdraw follow the BE flags `editable` / `withdrawable`.
 */
export function CohortApplicationCard({ application, variant = "full", onEdit, onChanged }: CohortApplicationCardProps) {
  const t = useTranslations("recruit");
  const tErrors = useTranslations(ERROR_COPY.cohortWithdraw.messages);
  const format = useFormatter();
  const api = useCohortApi();
  const headingId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { busy, run } = useSingleFlight();
  const [error, setError] = useState<ErrorCopyKey<typeof ERROR_COPY.cohortWithdraw> | null>(null);

  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const interestAreas = application.interestAreas
    .map((area) => (area === "OTHER" && application.interestOther ? `${t("form.interestAreas.options.OTHER")}: ${application.interestOther}` : t(`form.interestAreas.options.${area}`)))
    .join(", ");
  const activity =
    application.activityType === "OTHER" && application.activityTypeOther
      ? `${t("form.activityType.options.OTHER")}: ${application.activityTypeOther}`
      : t(`form.activityType.options.${application.activityType}`);

  const withdraw = () =>
    run(async () => {
      setError(null);
      try {
        await api.withdrawCohortApplication(application.id);
        setDialogOpen(false);
        onChanged?.();
      } catch (caught) {
        const key = errorCopyKey(caught, ERROR_COPY.cohortWithdraw);
        setError(key);
        if (key === "COHORT_APPLICATION_NOT_FOUND" || key === "COHORT_APPLICATION_NOT_SUBMITTED") onChanged?.();
      }
    });

  return (
    <article aria-labelledby={headingId} className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("mine.eyebrow")}</p>
          <h3 className="mt-1 break-words font-display text-xl font-bold text-ink" id={headingId}>{application.cohort.name}</h3>
        </div>
        <Badge variant={statusVariant[application.status]}>{t(`status.${application.status}.label`)}</Badge>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{t(`status.${application.status}.description`)}</p>
      <p className="mt-2 text-xs text-ink-muted">
        {t("mine.appliedOn", { date: date(application.createdAt) })}
        {application.reviewedAt && (application.status === "ACCEPTED" || application.status === "REJECTED") ? ` · ${t("mine.reviewedOn", { date: date(application.reviewedAt) })}` : ""}
      </p>

      {variant === "full" ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-5 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-muted">{t("form.displayName.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{application.displayName}</dd>
          <dt className="text-ink-muted">{t("form.telegram.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{application.telegram}</dd>
          <dt className="text-ink-muted">{t("form.twitter.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{application.twitter}</dd>
          <dt className="text-ink-muted">{t("form.web3Experience.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{t(`form.web3Experience.options.${application.web3Experience}`)}</dd>
          <dt className="text-ink-muted">{t("form.activityType.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{activity}</dd>
          <dt className="text-ink-muted">{t("form.interestAreas.label")}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{interestAreas}</dd>
          <dt className="text-ink-muted">{t("form.intro.label")}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-secondary">{application.intro}</dd>
        </dl>
      ) : null}

      {onEdit || application.withdrawable ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {onEdit && application.editable ? (
            <button className={buttonClass} onClick={onEdit} type="button">{t("mine.edit")}</button>
          ) : null}
          {application.withdrawable ? (
            <button className={dangerButtonClass} onClick={() => setDialogOpen(true)} type="button">{t("mine.withdraw")}</button>
          ) : null}
        </div>
      ) : null}
      {onEdit && application.withdrawable && !application.editable ? <p className="mt-3 text-xs text-ink-muted">{t("mine.editClosed")}</p> : null}

      <ConfirmDialog
        calloutText={t("mine.withdrawDialog.callout")}
        pending={busy}
        confirmLabel={busy ? t("mine.withdrawing") : t("mine.withdrawDialog.confirm")}
        description={t("mine.withdrawDialog.description")}
        destructive
        eyebrow={t("mine.withdrawDialog.eyebrow")}
        onCancel={() => {
          if (busy) return;
          setDialogOpen(false);
          setError(null);
        }}
        onConfirm={() => void withdraw()}
        open={dialogOpen}
        title={t("mine.withdrawDialog.title", { name: application.cohort.name })}
      >
        {error ? <p className="mt-3 text-sm font-semibold text-danger" role="alert">{tErrors(error)}</p> : null}
      </ConfirmDialog>
    </article>
  );
}
