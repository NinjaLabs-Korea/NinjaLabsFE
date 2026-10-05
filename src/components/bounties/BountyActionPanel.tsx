"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAccountApi, useAuthSnapshot, useBountyApi } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { ApiHttpError } from "@/lib/api/http";

const inputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// API error codes with localized copy under bounties.action.errors; others fall back to the raw code.
const knownErrorCodes = ["ALREADY_APPLIED", "BOUNTY_NOT_OPEN", "APPLICATION_NOT_APPROVED", "DEADLINE_PASSED", "SUBMISSION_FINALIZED"] as const;
type KnownErrorCode = (typeof knownErrorCodes)[number];

function errorText(error: unknown, t: (key: "generic" | KnownErrorCode) => string): string {
  if (!(error instanceof ApiHttpError)) return t("generic");
  return (knownErrorCodes as readonly string[]).includes(error.code)
    ? t(error.code as KnownErrorCode)
    : error.code.replaceAll("_", " ").toLowerCase();
}

export function BountyActionPanel({ bountyId, applicationRequired, submissionMode }: { bountyId: string; applicationRequired: boolean; submissionMode: "direct" | "agent" }) {
  const t = useTranslations("bounties.action");
  const tError = useTranslations("bounties.action.errors");
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const bountyApi = useBountyApi();
  const { data: applications, loading, unavailable } = useAccountQuery(accountApi.getApplications);
  const application = applications?.find((item) => item.bountySlug === bountyId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);

  if (submissionMode === "agent") {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("agentHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("agentBody")}</p>
        <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary">
          <code className="break-all">POST /agent-api/v1/bounties/{bountyId}/{applicationRequired ? "applications" : "submissions"}</code>
        </div>
        <Link className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong" href="/agents">{t("manageAgents")}</Link>
      </section>
    );
  }

  if (auth.status !== "signed-in") {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? t("applyHeading") : t("submitHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("signInPrompt")}</p>
        <Link className="mt-4 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">{t("signIn")}</Link>
      </section>
    );
  }

  if (applicationRequired && loading) {
    return <section className="rounded-card border border-border bg-surface p-5 shadow-card"><p className="text-sm text-ink-muted">{t("checkingStatus")}</p></section>;
  }
  if (applicationRequired && unavailable) {
    return <section className="rounded-card border border-border bg-surface p-5 shadow-card"><p className="text-sm text-danger">{t("statusUnavailable")}</p></section>;
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
      formElement.reset();
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error, tError) });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !applicationRequired || application?.status === "approved";
  if (applicationRequired && (applied || application?.status === "open")) {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">{t("underReviewHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("underReviewBody")}</p>
        <Link className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong" href="/applications">{t("viewApplications")}</Link>
        {feedback ? <p className="mt-3 text-sm text-success">{feedback.text}</p> : null}
      </section>
    );
  }

  if (canSubmit) {
    return (
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("submitHeading")}</h2>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <input className={inputClass} name="submissionUrl" placeholder={t("submissionUrl")} required type="url" />
          <input className={inputClass} name="repositoryUrl" placeholder={t("repositoryUrl")} type="url" />
          <input className={inputClass} name="commitSha" placeholder={t("commitSha")} type="text" />
          <textarea className="min-h-24 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink" name="description" placeholder={t("submissionDescription")} required />
          <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("submitting") : t("submit")}</button>
        </form>
        {feedback ? <p className={`mt-3 text-sm ${feedback.kind === "success" ? "text-success" : "text-danger"}`}>{feedback.text}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
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
