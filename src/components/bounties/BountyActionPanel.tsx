"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAccountApi, useAuthSnapshot, useBountyApi } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { ApiHttpError } from "@/lib/api/http";
import type { SubmissionStatus } from "@/lib/contracts/account";

const panelClass = "rounded-card border border-border bg-surface p-5 shadow-card";
const outlineLinkClass = "mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong";
const inputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// API error codes with localized copy under bounties.action.errors; others fall back to the raw code.
const knownErrorCodes = ["ALREADY_APPLIED", "BOUNTY_NOT_OPEN", "APPLICATION_NOT_APPROVED", "DEADLINE_PASSED", "SUBMISSION_FINALIZED", "VALIDATION_FAILED"] as const;
type KnownErrorCode = (typeof knownErrorCodes)[number];

function errorText(error: unknown, t: (key: "generic" | KnownErrorCode) => string): string {
  if (!(error instanceof ApiHttpError)) return t("generic");
  return (knownErrorCodes as readonly string[]).includes(error.code)
    ? t(error.code as KnownErrorCode)
    : error.code.replaceAll("_", " ").toLowerCase();
}

function StatusPanel({ title, body, tone = "muted", feedback, link }: {
  title: string;
  body: string;
  tone?: "muted" | "danger" | "success";
  feedback?: string | null;
  link?: { href: string; label: string };
}) {
  const bodyClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink-muted";
  return (
    <section className={panelClass}>
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{title}</h2>
      <p className={`mt-2 text-sm ${bodyClass}`}>{body}</p>
      {link ? <Link className={outlineLinkClass} href={link.href}>{link.label}</Link> : null}
      {feedback ? <p className="mt-3 text-sm text-success" role="status">{feedback}</p> : null}
    </section>
  );
}

const pendingSubmissionStatuses: readonly SubmissionStatus[] = ["submitted", "resubmitted", "in_review"];

export function BountyActionPanel({ bountyId, applicationRequired, submissionMode }: { bountyId: string; applicationRequired: boolean; submissionMode: "direct" | "agent" }) {
  const t = useTranslations("bounties.action");
  const tError = useTranslations("bounties.action.errors");
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const bountyApi = useBountyApi();
  const applicationsQuery = useAccountQuery(accountApi.getApplications);
  const submissionsQuery = useAccountQuery(accountApi.getSubmissions);
  const application = applicationsQuery.data?.find((item) => item.bountySlug === bountyId);
  const submission = submissionsQuery.data?.find((item) => item.bountySlug === bountyId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submissionMode === "agent") {
    return (
      <section className={panelClass}>
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("agentHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("agentBody")}</p>
        <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary">
          <code className="break-all">POST /agent-api/v1/bounties/{bountyId}/{applicationRequired ? "applications" : "submissions"}</code>
        </div>
        <Link className={outlineLinkClass} href="/agents">{t("manageAgents")}</Link>
      </section>
    );
  }

  if (auth.status === "loading") {
    return <section className={panelClass}><p className="text-sm text-ink-muted">{t("checkingSession")}</p></section>;
  }

  if (auth.status !== "signed-in") {
    return (
      <section className={panelClass}>
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? t("applyHeading") : t("submitHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("signInPrompt")}</p>
        <Link className="mt-4 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">{t("signIn")}</Link>
      </section>
    );
  }

  if (submissionsQuery.loading || (applicationRequired && applicationsQuery.loading)) {
    return <section className={panelClass}><p className="text-sm text-ink-muted">{t("checkingStatus")}</p></section>;
  }
  if (submissionsQuery.unavailable || (applicationRequired && applicationsQuery.unavailable)) {
    return <section className={panelClass}><p className="text-sm text-danger">{t("statusUnavailable")}</p></section>;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setFeedback(null);
    try {
      await bountyApi.submitBounty(bountyId, {
        submissionUrl: String(form.get("submissionUrl") ?? ""),
        description: String(form.get("description") ?? ""),
        ...(form.get("repositoryUrl") ? { repositoryUrl: String(form.get("repositoryUrl")) } : {}),
        ...(form.get("commitSha") ? { commitSha: String(form.get("commitSha")) } : {}),
      });
      setSubmitted(true);
      setFeedback({ kind: "success", text: t("submitSuccess") });
      formElement.reset();
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error, tError) });
    } finally {
      setBusy(false);
    }
  };

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setFeedback(null);
    try {
      await bountyApi.applyToBounty(bountyId, {
        message: String(form.get("message") ?? ""),
        ...(form.get("portfolioUrl") ? { portfolioUrl: String(form.get("portfolioUrl")) } : {}),
      });
      setApplied(true);
      setFeedback({ kind: "success", text: t("applySuccess") });
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error, tError) });
    } finally {
      setBusy(false);
    }
  };

  if (applicationRequired) {
    if (!application && !applied) {
      return (
        <section className={panelClass}>
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("applyHeading")}</h2>
          <form className="mt-4 space-y-3" onSubmit={apply}>
            <input className={inputClass} name="portfolioUrl" placeholder={t("portfolioUrl")} type="url" />
            <textarea className="min-h-28 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="message" placeholder={t("applyMessage")} required />
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("applying") : t("apply")}</button>
          </form>
          {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
        </section>
      );
    }
    if (application?.status === "rejected") {
      return <StatusPanel title={t("applicationRejectedHeading")} body={t("applicationRejectedBody")} link={{ href: "/bounties", label: t("browseOther") }} />;
    }
    if (applied || application?.status === "open" || application?.status === "under_review") {
      return <StatusPanel title={t("underReviewHeading")} body={t("underReviewBody")} feedback={feedback?.kind === "success" ? feedback.text : null} link={{ href: "/applications", label: t("viewApplications") }} />;
    }
  }

  if (submission?.status === "approved") {
    return <StatusPanel title={t("submissionApprovedHeading")} body={t("submissionApprovedBody")} tone="success" />;
  }
  if (submission?.status === "rejected") {
    return <StatusPanel title={t("submissionRejectedHeading")} body={t("submissionRejectedBody")} tone="danger" link={{ href: "/bounties", label: t("browseOther") }} />;
  }

  // BE accepts resubmission until the submission is approved or rejected (after the deadline, only on revision request).
  const revising = submission?.status === "revision_requested";
  const inReview = submitted || (submission !== undefined && pendingSubmissionStatuses.includes(submission.status));
  const heading = revising ? t("resubmitHeading") : inReview ? t("inReviewHeading") : t("submitHeading");
  const actionLabel = revising ? t("resubmit") : inReview ? t("updateSubmission") : t("submit");
  return (
    <section className={panelClass}>
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{heading}</h2>
      {revising ? <p className="mt-2 text-sm text-warning">{t("revisionNote")}</p> : null}
      {inReview ? <p className="mt-2 text-sm text-ink-muted">{t("inReviewNote")}</p> : null}
      {inReview && applicationRequired ? <Link className={outlineLinkClass} href="/applications">{t("viewApplications")}</Link> : null}
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className={inputClass} name="submissionUrl" placeholder={t("submissionUrl")} required type="url" />
        <input className={inputClass} name="repositoryUrl" placeholder={t("repositoryUrl")} type="url" />
        <input className={inputClass} name="commitSha" placeholder={t("commitSha")} type="text" />
        <textarea className="min-h-24 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="description" placeholder={t("submissionDescription")} required />
        <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("submitting") : actionLabel}</button>
      </form>
      {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
    </section>
  );
}
