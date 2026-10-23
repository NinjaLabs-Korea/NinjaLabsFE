"use client";

import { useFormatter, useTranslations } from "next-intl";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import type { ApplicationStatus } from "@/lib/contracts/account";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const statusVariants: Record<ApplicationStatus, "neutral" | "warning" | "success" | "primary-soft" | "danger"> = {
  open: "neutral",
  approved: "success",
  submitted: "primary-soft",
  completed: "success",
  rejected: "danger",
};

// Step labels live under account.applications.steps, keyed by status.
const applicationSteps: readonly ApplicationStatus[] = ["open", "approved", "submitted", "completed"];

export function ApplicationsView() {
  const t = useTranslations("account.applications");
  const tAccount = useTranslations("account.common");
  const tBounties = useTranslations("bounties.categories");
  const format = useFormatter();
  const statusLabel = (status: ApplicationStatus): string =>
    status === "approved" ? t("approvedStatus") : status === "rejected" ? t("rejectedStatus") : t(`steps.${status}`);
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useAccountApi();
  const { data: applications, unavailable, reason } = useAccountQuery(apiClient.getApplications);

  // The BE rejected the session (401/403 after refresh): ask to sign in again instead of blaming the server.
  if (unavailable && reason === "unauthorized") {
    return <SignedOutPanel message={tAccount("sessionExpired")} />;
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
    return <SignedOutPanel message={t("signedOutMessage")} />;
  }

  if (authSnapshot.status === "loading" || !applications) {
    return <p className="text-sm text-ink-muted" role="status">{tAccount("loading")}</p>;
  }

  return (
    <>
      <div className="space-y-5">
        {applications.map((application) => {
          const currentIndex = applicationSteps.indexOf(application.status);

          return (
            <article
              className="rounded-card border border-border bg-surface p-5 shadow-card"
              key={application.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap gap-2">
                  <Badge variant="primary-soft">{tBounties(application.category)}</Badge>
                  <Badge variant={statusVariants[application.status]}>
                    {statusLabel(application.status)}
                  </Badge>
                  {application.agent ? (
                    <Badge variant="neutral">{t("viaAgent", { name: application.agent.name })}</Badge>
                  ) : null}
                </span>
                <span className="text-xs text-ink-muted">{t("appliedAt", { date: format.dateTime(new Date(application.appliedAt), { dateStyle: "medium" }) })}</span>
              </div>

              <Link
                className={`mt-3 inline-block font-display text-lg font-bold text-ink ${focusClass}`}
                href={`/bounties/${application.bountySlug}`}
              >
                {application.bountyTitle}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">{application.note}</p>

              {application.status === "rejected" ? (
                <p className="mt-4 text-sm text-ink-muted">{t("rejectedNote")}</p>
              ) : (
                <ol
                  aria-label={t("progressLabel")}
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
                >
                  {applicationSteps.map((step, index) => (
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
                      {index < applicationSteps.length - 1 ? (
                        <span aria-hidden="true" className="hidden h-px w-5 bg-primary-outline sm:block" />
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}

              {application.status === "approved" ? (
                <Link
                  className={`mt-4 inline-block rounded-control bg-primary px-4 py-2 text-sm font-semibold text-on-inverse ${focusClass}`}
                  href={`/bounties/${application.bountySlug}`}
                >
                  {t("submitWork")}
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">{tAccount("mockNote")}</p>
      ) : null}
    </>
  );
}
