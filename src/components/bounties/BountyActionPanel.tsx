"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAccountApi, useAuthSnapshot, useBountyApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { APPLICATION_MESSAGE_MAX, COMMIT_SHA_MAX, SUBMISSION_DESCRIPTION_MAX } from "@/lib/input-limits";
import { payoutBadge } from "@/lib/payout";
import { REVIEW_TEXT_CLASS } from "@/lib/review-comment";
import { bountyActionErrorCopy, deriveActionView, isStaleRowsError, type BountyActionErrorCopy } from "@/lib/bounty-action-state";
import type { AccountApplication } from "@/lib/contracts/account";
import type { ApiResult } from "@/lib/contracts/api";
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

function StatusPanel({ title, body, note, tone = "muted", feedback, link, headingRef, badge }: {
  title: string;
  body: string;
  /** Reviewer comment shown under the body. */
  note?: string;
  tone?: "muted" | "danger" | "success";
  feedback?: string | null;
  link?: { href: string; label: string };
  /** Focus target after a successful action (the panel replaces the form, so focus would otherwise fall to <body>). */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Small status badge under the body (payout status). */
  badge?: { variant: "warning" | "success"; label: string } | null;
}) {
  const bodyClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink-muted";
  return (
    <section className={panelClass}>
      <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{title}</h2>
      <p className={`mt-2 text-sm ${bodyClass} ${REVIEW_TEXT_CLASS}`}>{body}</p>
      {note ? <p className={`mt-2 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{note}</p> : null}
      {badge ? <div className="mt-3"><Badge variant={badge.variant}>{badge.label}</Badge></div> : null}
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

// A direct-submission bounty has no applications. `getApplications` also joins /submissions/me, so asking it anyway would
// cost two extra authenticated requests on every detail view (the BE rate-limits per IP); this stub keeps the hook order.
const noApplications = async (): Promise<ApiResult<readonly AccountApplication[]>> => ({ status: "available", data: [] });

type BountyActionPanelProps = {
  bountyId: string;
  applicationRequired: boolean;
  /** `reviewing` and `closed` stop new applications/submissions; a requested revision can still be resubmitted (BE allows it). */
  status: Bounty["status"];
  submissionMode: "direct" | "agent";
  /** Application deadline passed (`Bounty.applicationClosed`): no apply form for a first application. */
  applicationClosed?: boolean;
  /** `Bounty.deadlinePassed`: closed only by the deadline, so a requested revision can still be resubmitted. */
  deadlinePassed?: boolean;
};

export function BountyActionPanel(props: BountyActionPanelProps) {
  // Persistent polite live region: it exists before any feedback arrives, so success copy is announced reliably even
  // though the panel below swaps whole sections (form → status panel). Errors use role="alert" inline instead.
  const [announcement, setAnnouncement] = useState("");
  // The body keeps "I just applied/submitted" flags and feedback in state. They describe one account, so the body is
  // keyed by user id: a different account on this page (switched in another tab) starts from the server rows only.
  const accountKey = useAuthSnapshot().user?.id ?? "";
  return (
    <>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <BountyActionPanelBody key={accountKey} {...props} announce={setAnnouncement} />
    </>
  );
}

function BountyActionPanelBody({ bountyId, applicationRequired, applicationClosed, deadlinePassed, status, submissionMode, announce }: BountyActionPanelProps & {
  announce: (text: string) => void;
}) {
  const t = useTranslations("bounties.action");
  const tError = useTranslations("bounties.action.errors");
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const bountyApi = useBountyApi();
  const applicationsQuery = useAccountQuery(applicationRequired ? accountApi.getApplications : noApplications);
  const submissionsQuery = useAccountQuery(accountApi.getSubmissions);
  const [busy, setBusy] = useState(false);
  // Synchronous in-flight guard: several submit events can land in one tick (automation, assistive tools) before React re-renders `busy`.
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasError = feedback?.kind === "error";
  // Shared by every input of the active form: the API error is form-level (e.g. VALIDATION_FAILED).
  const invalidProps = { "aria-invalid": hasError || undefined, "aria-describedby": hasError ? errorId : undefined };
  const errorLine = hasError ? <p className="mt-3 text-sm text-danger" id={errorId} role="alert">{feedback.text}</p> : null;

  // A stale form (the BE says the row already moved on): re-read both lists so the matching section replaces it.
  const refreshRows = () => {
    applicationsQuery.refresh();
    submissionsQuery.refresh();
  };

  useEffect(() => {
    if (feedback?.kind !== "success") return;
    announce(feedback.text);
    headingRef.current?.focus();
  }, [feedback, announce]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
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
      if (isStaleRowsError(error)) refreshRows();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
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
      if (isStaleRowsError(error)) refreshRows();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // The rule for which section to show lives in lib/bounty-action-state.ts (documented by src/test/bounty-action-state.test.ts).
  const view = deriveActionView({
    bountyId, applicationRequired, applicationClosed, deadlinePassed, status, submissionMode,
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
              <textarea className={`min-h-28 ${textareaClass}`} maxLength={APPLICATION_MESSAGE_MAX} name="message" placeholder={t("applyMessage")} required {...invalidProps} />
            </Field>
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("applying") : t("apply")}</button>
          </form>
          {errorLine}
        </section>
      );
    case "applicationRejected":
      return <StatusPanel title={t("applicationRejectedHeading")} body={t("applicationRejectedBody")} note={view.note ? t("reviewerComment", { comment: view.note }) : undefined} link={{ href: "/bounties", label: t("browseOther") }} />;
    case "applicationUnderReview":
      return <StatusPanel title={t("underReviewHeading")} body={t("underReviewBody")} feedback={feedback?.kind === "success" ? feedback.text : null} headingRef={headingRef} link={{ href: "/applications", label: t("viewApplications") }} />;
    case "submissionApproved": {
      const payout = view.payout ? payoutBadge(view.payout, { showPaid: true }) : null;
      return <StatusPanel title={t("submissionApprovedHeading")} body={t("submissionApprovedBody")} tone="success" badge={payout ? { variant: payout.variant, label: t(payout.key) } : null} />;
    }
    case "submissionRejected": {
      const link = { href: "/bounties", label: t("browseOther") };
      if (view.review?.forfeited) {
        return <StatusPanel title={t("submissionForfeitedHeading")} body={t("submissionForfeitedBody", { reason: view.review.text })} tone="danger" link={link} />;
      }
      return <StatusPanel title={t("submissionRejectedHeading")} body={t("submissionRejectedBody")} note={view.review ? t("reviewerComment", { comment: view.review.text }) : undefined} tone="danger" link={link} />;
    }
    case "inReviewLocked":
      return <StatusPanel title={t("inReviewHeading")} body={t("inReviewLockedNote")} link={applicationRequired ? { href: "/applications", label: t("viewApplications") } : undefined} />;
    case "submitForm": {
      const { revising, inReview, revisionComment } = view;
      const heading = revising ? t("resubmitHeading") : inReview ? t("inReviewHeading") : t("submitHeading");
      const actionLabel = revising ? t("resubmit") : inReview ? t("updateSubmission") : t("submit");
      return (
        <section className={panelClass}>
          <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{heading}</h2>
          {revising ? <p className="mt-2 text-sm text-warning">{t("revisionNote")}</p> : null}
          {revising && revisionComment ? <p className={`mt-2 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{t("reviewerComment", { comment: revisionComment })}</p> : null}
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
              <input className={inputClass} maxLength={COMMIT_SHA_MAX} name="commitSha" placeholder={t("commitSha")} type="text" {...invalidProps} />
            </Field>
            <Field label={t("submissionDescription")}>
              <textarea className={`min-h-24 ${textareaClass}`} maxLength={SUBMISSION_DESCRIPTION_MAX} name="description" placeholder={t("submissionDescription")} required {...invalidProps} />
            </Field>
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60" disabled={busy} type="submit">{busy ? t("submitting") : actionLabel}</button>
          </form>
          {feedback?.kind === "success" ? <p className="mt-3 text-sm text-success">{feedback.text}</p> : errorLine}
        </section>
      );
    }
  }
}
