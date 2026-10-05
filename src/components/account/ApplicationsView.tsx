"use client";

import { useTranslations } from "next-intl";
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

const statusVariants: Record<ApplicationStatus, "neutral" | "warning" | "success" | "primary-soft"> = {
  open: "neutral",
  under_review: "warning",
  approved: "success",
  submitted: "primary-soft",
  completed: "success",
};

// Step labels live under account.applications.steps, keyed by status.
const applicationSteps: readonly ApplicationStatus[] = ["open", "under_review", "approved", "submitted", "completed"];

export function ApplicationsView() {
  const t = useTranslations("account.applications");
  const tAccount = useTranslations("account.common");
  const tBounties = useTranslations("bounties.categories");
  const statusLabel = (status: ApplicationStatus): string =>
    status === "approved" ? t("approvedStatus") : t(`steps.${status}`);
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useAccountApi();
  const { data: applications, unavailable } = useAccountQuery(apiClient.getApplications);

  if (unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("unavailableTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{tAccount("unavailableBody")}</p>
      </div>
    );
  }

  if (authSnapshot.status !== "signed-in") {
    return <SignedOutPanel message={t("signedOutMessage")} />;
  }

  if (!applications) {
    return null;
  }

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
      <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">{t("heading")}</h1>
      <p className="mt-4 text-lg text-ink-muted">
        {t("intro")}
      </p>

      <div className="mt-8 space-y-5">
        {applications.map((application) => {
          const currentIndex = applicationSteps.indexOf(application.status);

          return (
            <article
              className="rounded-card border border-border bg-surface p-5 shadow-card"
              key={application.bountySlug}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex gap-2">
                  <Badge variant="primary-soft">{tBounties(application.category)}</Badge>
                  <Badge variant={statusVariants[application.status]}>
                    {statusLabel(application.status)}
                  </Badge>
                </span>
                <span className="text-xs text-ink-muted">{t("appliedAt", { date: application.appliedAt })}</span>
              </div>

              <Link
                className={`mt-3 inline-block font-display text-lg font-bold text-ink ${focusClass}`}
                href={`/bounties/${application.bountySlug}`}
              >
                {application.bountyTitle}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">{application.note}</p>

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
