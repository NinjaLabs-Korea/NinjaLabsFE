"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAuthSnapshot, useFoundationApiClient } from "@/components/auth/FoundationProvider";
import { ApiHttpError } from "@/lib/api/http";

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

export function BountyActionPanel({ bountyId, applicationRequired, submissionMode }: { bountyId: string; applicationRequired: boolean; submissionMode: "direct" | "agent" }) {
  const auth = useAuthSnapshot();
  const api = useFoundationApiClient();
  const { data: applications, loading, unavailable } = useAccountQuery(api.getApplications);
  const application = applications?.find((item) => item.bountySlug === bountyId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);

  if (submissionMode === "agent") {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Agent submission</h2>
        <p className="mt-2 text-sm text-ink-muted">This bounty accepts authenticated agent API requests instead of the browser submission form.</p>
        <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary">
          <code className="break-all">POST /agent-api/v1/bounties/{bountyId}/{applicationRequired ? "applications" : "submissions"}</code>
        </div>
        <Link className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong" href="/agents">Manage my agents</Link>
      </section>
    );
  }

  if (auth.status !== "signed-in") {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? "Apply for this bounty" : "Submit your work"}</h2>
        <p className="mt-2 text-sm text-ink-muted">Sign in to continue.</p>
        <Link className="mt-4 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">Sign in</Link>
      </section>
    );
  }

  if (applicationRequired && loading) {
    return <section className="rounded-card border border-border bg-surface p-5 shadow-card"><p className="text-sm text-ink-muted">Checking your application status…</p></section>;
  }
  if (applicationRequired && unavailable) {
    return <section className="rounded-card border border-border bg-surface p-5 shadow-card"><p className="text-sm text-danger">Your application status is temporarily unavailable. Please refresh and try again.</p></section>;
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
      setFeedback({ kind: "success", text: "Your work was submitted successfully." });
      formElement.reset();
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
      formElement.reset();
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !applicationRequired || application?.status === "approved";
  if (applicationRequired && (applied || application?.status === "open")) {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">Application under review</h2>
        <p className="mt-2 text-sm text-ink-muted">Submission unlocks after sponsor approval.</p>
        <Link className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong" href="/applications">View my applications</Link>
        {feedback ? <p className="mt-3 text-sm text-success">{feedback.text}</p> : null}
      </section>
    );
  }

  if (canSubmit) {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Submit your work</h2>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <input className={inputClass} name="submissionUrl" placeholder="Completed-work URL" required type="url" />
          <input className={inputClass} name="repositoryUrl" placeholder="Repository URL (optional)" type="url" />
          <input className={inputClass} name="commitSha" placeholder="Commit SHA (optional)" type="text" />
          <textarea className="min-h-24 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="description" placeholder="Describe what you completed" required />
          <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? "Submitting…" : "Submit"}</button>
        </form>
        {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
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
