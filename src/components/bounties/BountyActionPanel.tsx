"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAccountApi, useAuthSnapshot, useBountyApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { bountyActionErrorCopy, deriveActionView, type BountyActionErrorCopy } from "@/lib/bounty-action-state";
import type { Bounty } from "@/lib/types";

const panelClass = "rounded-card border border-border bg-surface p-5 shadow-card";
const outlineButtonClass = "inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong";
const outlineLinkClass = `mt-4 ${outlineButtonClass}`;
const inputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
const textareaClass = "w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
const labelTextClass = "mb-1.5 block text-sm font-semibold text-ink";
// Headings that receive focus after a successful apply/submit (tabIndex={-1}); the ring matches the focus recipe.
const headingClass = "font-display text-2xl -tracking-[0.24px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Which section renders is decided by `deriveActionView` (lib/bounty-action-state.ts); this file only draws each `view.kind`.
// Error copy keys come from `bountyActionErrorCopy` (codes listed in lib/api/error-copy.ts `ERROR_COPY.bountyAction`).
type ErrorTranslator = (key: BountyActionErrorCopy["key"], values?: { code: string }) => string;

function errorText(error: unknown, t: ErrorTranslator): string {
  const copy = bountyActionErrorCopy(error);
  return copy.key === "unknown" ? t("unknown", { code: copy.code }) : t(copy.key);
}

/** Visible label above a form control (Figma 15/15v draw placeholders only; see docs/figma/design-gaps.md). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelTextClass}>{label}</span>
      {children}
    </label>
  );
}

function StatusPanel({ title, body, tone = "muted", feedback, link, headingRef }: {
  title: string;
  body: string;
  tone?: "muted" | "danger" | "success";
  feedback?: string | null;
  link?: { href: string; label: string };
  /** Focus target after a successful action (the panel replaces the form, so focus would otherwise fall to <body>). */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const bodyClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink-muted";
  return (
    <section className={panelClass}>
      <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{title}</h2>
      <p className={`mt-2 text-sm ${bodyClass}`}>{body}</p>
      {link ? <Link className={outlineLinkClass} href={link.href}>{link.label}</Link> : null}
      {feedback ? <p className="mt-3 text-sm text-success">{feedback}</p> : null}
    </section>
  );
}

/** Figma 15/15v public (signed-out) state: heading + LOGIN REQUIRED badge, "Sign in first", and a disabled preview of the form. */
function SignedOutPanel({ applicationRequired }: { applicationRequired: boolean }) {
  const t = useTranslations("bounties.action");
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? t("applyHeading") : t("submitHeading")}</h2>
            <Badge variant="danger">{t("loginRequired")}</Badge>
          </div>
          <p className="mt-2 text-sm text-ink-muted">{applicationRequired ? t("applySignedOutBody") : t("submitSignedOutBody")}</p>
        </div>
        {applicationRequired ? (
          <Link className={outlineButtonClass} href="/bounties/apply">{t("viewIntakeRules")}</Link>
        ) : (
          <Link className={outlineButtonClass} href="/signup">{t("signInFirst")}</Link>
        )}
      </div>
      {applicationRequired ? (
        <fieldset className="mt-4 space-y-3" disabled>
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label={t("portfolioUrl")} className={inputClass} placeholder={t("portfolioUrl")} type="url" />
            <input aria-label={t("availability")} className={inputClass} placeholder={t("availability")} type="text" />
          </div>
          <textarea aria-label={t("applyMessage")} className="min-h-28 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink placeholder:text-ink-placeholder" placeholder={t("applyMessage")} />
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">{t("apply")}</Link>
            <span className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong opacity-60">{t("submitDisabled")}</span>
          </div>
        </fieldset>
      ) : (
        <fieldset className="mt-4 flex flex-col gap-3 sm:flex-row" disabled>
          <input aria-label={t("submissionUrl")} className={inputClass} placeholder={t("submissionUrl")} type="url" />
          <Link className="shrink-0 rounded-control bg-primary px-5 py-3 text-center text-sm font-semibold text-on-inverse" href="/signup">{t("submit")}</Link>
        </fieldset>
      )}
    </section>
  );
}

type BountyActionPanelProps = {
  bountyId: string;
  applicationRequired: boolean;
  /** `reviewing` and `closed` stop new applications/submissions; a requested revision can still be resubmitted (BE allows it). */
  status: Bounty["status"];
  submissionMode: "direct" | "agent";
};

export function BountyActionPanel(props: BountyActionPanelProps) {
  // Persistent polite live region: it exists before any feedback arrives, so success copy is announced reliably even
  // though the panel below swaps whole sections (form → status panel). Errors use role="alert" inline instead.
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <BountyActionPanelBody {...props} announce={setAnnouncement} />
    </>
  );
}

function BountyActionPanelBody({ bountyId, applicationRequired, status, submissionMode, announce }: BountyActionPanelProps & {
  announce: (text: string) => void;
}) {
  const t = useTranslations("bounties.action");
  const tError = useTranslations("bounties.action.errors");
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const bountyApi = useBountyApi();
  const applicationsQuery = useAccountQuery(accountApi.getApplications);
  const submissionsQuery = useAccountQuery(accountApi.getSubmissions);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasError = feedback?.kind === "error";
  // Shared by every input of the active form: the API error is form-level (e.g. VALIDATION_FAILED).
  const invalidProps = { "aria-invalid": hasError || undefined, "aria-describedby": hasError ? errorId : undefined };
  const errorLine = hasError ? <p className="mt-3 text-sm text-danger" id={errorId} role="alert">{feedback.text}</p> : null;

  useEffect(() => {
    if (feedback?.kind !== "success") return;
    announce(feedback.text);
    headingRef.current?.focus();
  }, [feedback, announce]);

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
      // Re-read /submissions/me (and the application join) so the panel reflects the server rows, not only the local flag.
      submissionsQuery.refresh();
      if (applicationRequired) applicationsQuery.refresh();
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
      // Re-read /applications/me so the panel reflects the server row (status, agent) rather than only the local flag.
      applicationsQuery.refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: errorText(error, tError) });
    } finally {
      setBusy(false);
    }
  };

  // The rule for which section to show lives in lib/bounty-action-state.ts (documented by src/test/bounty-action-state.test.ts).
  const view = deriveActionView({
    bountyId, applicationRequired, status, submissionMode,
    auth: auth.status,
    applications: applicationsQuery,
    submissions: submissionsQuery,
    applied, submitted,
  });

  switch (view.kind) {
    case "closed":
      return (
        <StatusPanel
          body={view.reason === "reviewing" ? t("reviewingBody") : t("closedBody")}
          link={{ href: "/bounties", label: t("browseOther") }}
          title={t("closedHeading")}
        />
      );
    case "agentMode":
      return (
        <section className={panelClass}>
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("agentHeading")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("agentBody")}</p>
          <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary">
            <code className="break-all">POST /agent-api/v1/bounties/{bountyId}/{view.endpoint}</code>
          </div>
          <Link className={outlineLinkClass} href="/agents">{t("manageAgents")}</Link>
        </section>
      );
    case "checkingSession":
      return <section className={panelClass}><p className="text-sm text-ink-muted">{t("checkingSession")}</p></section>;
    case "signedOut":
      return <SignedOutPanel applicationRequired={applicationRequired} />;
    case "checkingStatus":
      return <section className={panelClass}><p className="text-sm text-ink-muted">{t("checkingStatus")}</p></section>;
    case "statusUnavailable":
      return <section className={panelClass}><p className="text-sm text-danger">{t("statusUnavailable")}</p></section>;
    case "agentRow":
      return (
        <StatusPanel
          body={view.row === "submission" ? t("agentSubmittedBody", { name: view.agentName }) : t("agentAppliedBody", { name: view.agentName })}
          link={{ href: "/agents", label: t("manageAgents") }}
          title={t("agentRowHeading")}
        />
      );
    case "applyForm":
      return (
        <section className={panelClass}>
          <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{t("applyHeading")}</h2>
          <form className="mt-4 space-y-3" onSubmit={apply}>
            <Field label={t("portfolioUrl")}>
              <input className={inputClass} name="portfolioUrl" placeholder={t("portfolioUrl")} type="url" {...invalidProps} />
            </Field>
            <Field label={t("applyMessage")}>
              <textarea className={`min-h-28 ${textareaClass}`} name="message" placeholder={t("applyMessage")} required {...invalidProps} />
            </Field>
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("applying") : t("apply")}</button>
          </form>
          {errorLine}
        </section>
      );
    case "applicationRejected":
      return <StatusPanel title={t("applicationRejectedHeading")} body={t("applicationRejectedBody")} link={{ href: "/bounties", label: t("browseOther") }} />;
    case "applicationUnderReview":
      return <StatusPanel title={t("underReviewHeading")} body={t("underReviewBody")} feedback={feedback?.kind === "success" ? feedback.text : null} headingRef={headingRef} link={{ href: "/applications", label: t("viewApplications") }} />;
    case "submissionApproved":
      return <StatusPanel title={t("submissionApprovedHeading")} body={t("submissionApprovedBody")} tone="success" />;
    case "submissionRejected":
      return <StatusPanel title={t("submissionRejectedHeading")} body={t("submissionRejectedBody")} tone="danger" link={{ href: "/bounties", label: t("browseOther") }} />;
    case "inReviewLocked":
      return <StatusPanel title={t("inReviewHeading")} body={t("inReviewLockedNote")} link={applicationRequired ? { href: "/applications", label: t("viewApplications") } : undefined} />;
    case "submitForm": {
      const { revising, inReview } = view;
      const heading = revising ? t("resubmitHeading") : inReview ? t("inReviewHeading") : t("submitHeading");
      const actionLabel = revising ? t("resubmit") : inReview ? t("updateSubmission") : t("submit");
      return (
        <section className={panelClass}>
          <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{heading}</h2>
          {revising ? <p className="mt-2 text-sm text-warning">{t("revisionNote")}</p> : null}
          {inReview ? <p className="mt-2 text-sm text-ink-muted">{t("inReviewNote")}</p> : null}
          {inReview && applicationRequired ? <Link className={outlineLinkClass} href="/applications">{t("viewApplications")}</Link> : null}
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <Field label={t("submissionUrl")}>
              <input className={inputClass} name="submissionUrl" placeholder={t("submissionUrl")} required type="url" {...invalidProps} />
            </Field>
            <Field label={t("repositoryUrl")}>
              <input className={inputClass} name="repositoryUrl" placeholder={t("repositoryUrl")} type="url" {...invalidProps} />
            </Field>
            <Field label={t("commitSha")}>
              <input className={inputClass} name="commitSha" placeholder={t("commitSha")} type="text" {...invalidProps} />
            </Field>
            <Field label={t("submissionDescription")}>
              <textarea className={`min-h-24 ${textareaClass}`} name="description" placeholder={t("submissionDescription")} required {...invalidProps} />
            </Field>
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("submitting") : actionLabel}</button>
          </form>
          {feedback?.kind === "success" ? <p className="mt-3 text-sm text-success">{feedback.text}</p> : errorLine}
        </section>
      );
    }
  }
}
