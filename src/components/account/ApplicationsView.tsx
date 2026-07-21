"use client";

import Link from "next/link";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useFoundationApiClient,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
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

const applicationSteps: readonly { status: ApplicationStatus; label: string }[] = [
  { status: "open", label: "Applied" },
  { status: "under_review", label: "Under review" },
  { status: "approved", label: "Approved" },
  { status: "submitted", label: "Submitted" },
  { status: "completed", label: "Completed" },
];

const stepLabel = (status: ApplicationStatus): string =>
  applicationSteps.find((step) => step.status === status)?.label ?? status;

const statusLabel = (status: ApplicationStatus): string =>
  status === "approved" ? "Approved — submit unlocked" : stepLabel(status);

export function ApplicationsView() {
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useFoundationApiClient();
  const { data: applications, unavailable } = useAccountQuery(apiClient.getApplications);

  if (mode === "api" || unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">Applications are unavailable in API mode.</p>
        <p className="mt-1 text-sm text-ink-muted">Connect an account service to view your applications.</p>
      </div>
    );
  }

  if (authSnapshot.status !== "signed-in") {
    return <SignedOutPanel message="Sign in to see your applications" />;
  }

  if (!applications) {
    return null;
  }

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Account</p>
      <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">My applications</h1>
      <p className="mt-4 text-lg text-ink-muted">
        Track every apply-type bounty you applied to — submitting unlocks after sponsor approval.
      </p>

      <div className="mt-8 space-y-5">
        {applications.map((application) => {
          const currentIndex = applicationSteps.findIndex((step) => step.status === application.status);

          return (
            <article
              className="rounded-card border border-border bg-surface p-5 shadow-card"
              key={application.bountySlug}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex gap-2">
                  <Badge variant="primary-soft">{application.category}</Badge>
                  <Badge variant={statusVariants[application.status]}>
                    {statusLabel(application.status)}
                  </Badge>
                </span>
                <span className="text-xs text-ink-muted">Applied {application.appliedAt}</span>
              </div>

              <Link
                className={`mt-3 inline-block font-display text-lg font-bold text-ink ${focusClass}`}
                href={`/bounties/${application.bountySlug}`}
              >
                {application.bountyTitle}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">{application.note}</p>

              <ol
                aria-label="Application progress"
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
              >
                {applicationSteps.map((step, index) => (
                  <li
                    aria-current={index === currentIndex ? "step" : undefined}
                    className="flex items-center gap-2"
                    key={step.status}
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
                      {step.label}
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
                  Submit work
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">Session preview — demo data, resets on reload.</p>
      ) : null}
    </>
  );
}
