"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAuthSnapshot, useFoundationApiClient } from "@/components/auth/FoundationProvider";
import { ApiHttpError } from "@/lib/api/http";
import type { SubmissionStatus } from "@/lib/contracts/account";

const panelClass = "rounded-card border border-border bg-surface p-5 shadow-card";
const outlineLinkClass = "mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong";
const inputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function errorText(error: unknown): string {
  if (!(error instanceof ApiHttpError)) return "The request could not be completed. Please try again.";
  const messages: Record<string, string> = {
    ALREADY_APPLIED: "You already applied to this bounty.",
    BOUNTY_NOT_OPEN: "This bounty is no longer open.",
    APPLICATION_NOT_APPROVED: "Your application must be approved before submitting.",
    DEADLINE_PASSED: "The submission deadline has passed.",
    SUBMISSION_FINALIZED: "This submission has already been finalized.",
  };
  return messages[error.code] ?? error.code.replaceAll("_", " ").toLowerCase();
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
  const auth = useAuthSnapshot();
  const api = useFoundationApiClient();
  const applicationsQuery = useAccountQuery(api.getApplications);
  const submissionsQuery = useAccountQuery(api.getSubmissions);
  const application = applicationsQuery.data?.find((item) => item.bountySlug === bountyId);
  const submission = submissionsQuery.data?.find((item) => item.bountySlug === bountyId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submissionMode === "agent") {
    return (
      <section className={panelClass}>
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Agent submission</h2>
        <p className="mt-2 text-sm text-ink-muted">This bounty accepts authenticated agent API requests instead of the browser submission form.</p>
        <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary">
          <code className="break-all">POST /agent-api/v1/bounties/{bountyId}/{applicationRequired ? "applications" : "submissions"}</code>
        </div>
        <Link className={outlineLinkClass} href="/agents">Manage my agents</Link>
      </section>
    );
  }

  if (auth.status === "loading") {
    return <section className={panelClass}><p className="text-sm text-ink-muted">Checking your session…</p></section>;
  }

  if (auth.status !== "signed-in") {
    return (
      <section className={panelClass}>
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? "Apply for this bounty" : "Submit your work"}</h2>
        <p className="mt-2 text-sm text-ink-muted">Sign in to continue.</p>
        <Link className="mt-4 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">Sign in</Link>
      </section>
    );
  }

  if (submissionsQuery.loading || (applicationRequired && applicationsQuery.loading)) {
    return <section className={panelClass}><p className="text-sm text-ink-muted">Checking your bounty status…</p></section>;
  }
  if (submissionsQuery.unavailable || (applicationRequired && applicationsQuery.unavailable)) {
    return <section className={panelClass}><p className="text-sm text-danger">Your bounty status is temporarily unavailable. Please refresh and try again.</p></section>;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setFeedback(null);
    try {
      await api.submitBounty(bountyId, {
        submissionUrl: String(form.get("submissionUrl") ?? ""),
        description: String(form.get("description") ?? ""),
        ...(form.get("repositoryUrl") ? { repositoryUrl: String(form.get("repositoryUrl")) } : {}),
        ...(form.get("commitSha") ? { commitSha: String(form.get("commitSha")) } : {}),
      });
      setSubmitted(true);
      setFeedback({ kind: "success", text: "Your work was submitted successfully." });
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error) });
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
      await api.applyToBounty(bountyId, {
        message: String(form.get("message") ?? ""),
        ...(form.get("portfolioUrl") ? { portfolioUrl: String(form.get("portfolioUrl")) } : {}),
      });
      setApplied(true);
      setFeedback({ kind: "success", text: "Application received. You can track it from My applications." });
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  if (applicationRequired) {
    if (!application && !applied) {
      return (
        <section className={panelClass}>
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Apply for this bounty</h2>
          <form className="mt-4 space-y-3" onSubmit={apply}>
            <input className={inputClass} name="portfolioUrl" placeholder="Portfolio or relevant work URL (optional)" type="url" />
            <textarea className="min-h-28 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="message" placeholder="Describe your approach and relevant experience" required />
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? "Applying…" : "Apply"}</button>
          </form>
          {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
        </section>
      );
    }
    if (application?.status === "rejected") {
      return <StatusPanel title="Application not selected" body="The sponsor did not select your application for this bounty." link={{ href: "/bounties", label: "Browse other bounties" }} />;
    }
    if (applied || application?.status === "open" || application?.status === "under_review") {
      return <StatusPanel title="Application under review" body="Submission unlocks after sponsor approval." feedback={feedback?.kind === "success" ? feedback.text : null} link={{ href: "/applications", label: "View my applications" }} />;
    }
  }

  if (submitted || (submission && pendingSubmissionStatuses.includes(submission.status))) {
    return <StatusPanel title="Submission under review" body="The sponsor is reviewing your work. You will be able to resubmit if they request a revision." feedback={feedback?.kind === "success" ? feedback.text : null} link={applicationRequired ? { href: "/applications", label: "View my applications" } : undefined} />;
  }
  if (submission?.status === "approved") {
    return <StatusPanel title="Submission approved" body="The sponsor approved your work for this bounty." tone="success" />;
  }
  if (submission?.status === "rejected") {
    return <StatusPanel title="Submission not accepted" body="The sponsor reviewed your work and did not accept it. This submission is final." tone="danger" link={{ href: "/bounties", label: "Browse other bounties" }} />;
  }

  const revising = submission?.status === "revision_requested";
  return (
    <section className={panelClass}>
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{revising ? "Resubmit your work" : "Submit your work"}</h2>
      {revising ? <p className="mt-2 text-sm text-warning">The sponsor requested a revision. Update your work and submit again.</p> : null}
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className={inputClass} name="submissionUrl" placeholder="Completed-work URL" required type="url" />
        <input className={inputClass} name="repositoryUrl" placeholder="Repository URL (optional)" type="url" />
        <input className={inputClass} name="commitSha" placeholder="Commit SHA (optional)" type="text" />
        <textarea className="min-h-24 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="description" placeholder="Describe what you completed" required />
        <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? "Submitting…" : revising ? "Resubmit" : "Submit"}</button>
      </form>
      {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
    </section>
  );
}
