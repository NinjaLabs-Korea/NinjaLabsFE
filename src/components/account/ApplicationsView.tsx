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
import { ApiHttpError } from "@/lib/api/http";
import type { AccountApplication, ApplicationStatus } from "@/lib/contracts/account";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const statusVariants: Record<ApplicationStatus, "neutral" | "warning" | "success" | "primary-soft" | "danger"> = {
  open: "neutral",
  approved: "success",
  submitted: "primary-soft",
  completed: "success",
  rejected: "danger",
};

const outlineDangerClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

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
  const bountyApi = useBountyApi();
  const { data: applications, unavailable, reason, refresh } = useAccountQuery(apiClient.getApplications);
  const tErrors = useTranslations("account.applications.withdrawErrors");
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
      refresh();
    } catch (error) {
      const code = error instanceof ApiHttpError ? error.code : "";
      setErrors((current) => ({
        ...current,
        [application.id]: code === "APPLICATION_NOT_FOUND_OR_NOT_PENDING" ? tErrors(code) : tErrors("generic"),
      }));
      // A stale row (already reviewed elsewhere) should refresh so the card reflects the real state.
      if (code === "APPLICATION_NOT_FOUND_OR_NOT_PENDING") refresh();
    } finally {
      pendingRef.current.delete(application.id);
      setBusyId(null);
    }
  };

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
      <p className="sr-only" role="status">{notice}</p>
      <div className="space-y-5" ref={listRef} tabIndex={-1}>
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
              {application.status === "open" ? (
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
