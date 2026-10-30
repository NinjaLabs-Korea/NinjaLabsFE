"use client";

import { useTranslations } from "next-intl";
import { FocusEvent, FormEvent, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAccountApi, useAuthSnapshot, useBountyApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import { signInHref } from "@/lib/return-path";
import { APPLICATION_MESSAGE_MAX, COMMIT_SHA_MAX, SUBMISSION_DESCRIPTION_MAX } from "@/lib/input-limits";
import { payoutBadge } from "@/lib/payout";
import { isHttpUrl } from "@/lib/url-rules";
import { hasVisibleText } from "@/lib/visible-text";
import { REVIEW_TEXT_CLASS } from "@/lib/review-comment";
import { bountyActionErrorCopy, deriveActionView, isSessionEndedError, isStaleRowsError, type BountyActionErrorCopy } from "@/lib/bounty-action-state";
import type { AccountApplication } from "@/lib/contracts/account";
import type { ApiResult } from "@/lib/contracts/api";
import type { ClosedReason } from "@/lib/bounty-status";
import type { Bounty } from "@/lib/types";

// Panels fade in when they replace the loading placeholder (or another panel), instead of popping in.
const panelClass = "rounded-card border border-border bg-surface p-5 shadow-card animate-fade-in motion-reduce:animate-none";
const submitButtonClass = "motion-control motion-press rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60";
const outlineButtonClass = "inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong";
const outlineLinkClass = `mt-4 ${outlineButtonClass}`;
const inputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
const textareaClass = "w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
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
function Field({ label, children, error }: { label: string; children: ReactNode; error?: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className={labelTextClass}>{label}</span>
        {children}
      </label>
      {error}
    </div>
  );
}

/** Per-field problems the form finds itself (before any request): a link that is not http(s), or a required text left empty. */
type FieldError = "url" | "required";
type FieldErrors = Partial<Record<string, FieldError>>;
type FormFieldRule = { name: string; kind: "url" | "text"; required?: boolean };

const APPLY_FIELDS: FormFieldRule[] = [
  { name: "portfolioUrl", kind: "url" },
  { name: "message", kind: "text", required: true },
];
const SUBMIT_FIELDS: FormFieldRule[] = [
  { name: "submissionUrl", kind: "url", required: true },
  { name: "repositoryUrl", kind: "url" },
  { name: "description", kind: "text", required: true },
];

/** A rule looked up by field name, so reordering or inserting rules cannot hand an input another field's rule. */
function ruleFor(rules: FormFieldRule[], name: string): FormFieldRule {
  const rule = rules.find((candidate) => candidate.name === name);
  if (!rule) throw new Error(`No form rule for field ${name}`);
  return rule;
}

/** The same rule the API applies (`isHttpUrl`, mirror of the BE), so the person sees the locale message instead of the browser's tooltip. */
function fieldProblem(rule: FormFieldRule, raw: string): FieldError | undefined {
  // Text is empty when it has no visible character (the BE rule, `lib/visible-text.ts`); only a URL is trimmed.
  if (rule.kind === "text") return rule.required && !hasVisibleText(raw) ? "required" : undefined;
  const value = raw.trim();
  if (!value) return rule.required ? "required" : undefined;
  return !isHttpUrl(value) ? "url" : undefined;
}

function StatusPanel({ title, body, note, tone = "muted", feedback, link, headingRef, badge, code }: {
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
  /** Agent API endpoint the next step goes through (agent revision requests). */
  code?: string;
}) {
  const bodyClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink-muted";
  return (
    <section className={panelClass}>
      <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{title}</h2>
      <p className={`mt-2 text-sm ${bodyClass} ${REVIEW_TEXT_CLASS}`}>{body}</p>
      {note ? <p className={`mt-2 text-sm text-ink-muted ${REVIEW_TEXT_CLASS}`}>{note}</p> : null}
      {badge ? <div className="mt-3"><Badge variant={badge.variant}>{badge.label}</Badge></div> : null}
      {code ? <div className="mt-4 rounded-tile bg-surface-subtle p-4 text-sm text-ink-secondary"><code className="break-all">{code}</code></div> : null}
      {link ? <Link className={outlineLinkClass} href={link.href}>{link.label}</Link> : null}
      {feedback ? <p className="mt-3 text-sm text-success">{feedback}</p> : null}
    </section>
  );
}

/** Figma 15/15v public (signed-out) state: heading + LOGIN REQUIRED badge, "Sign in first", and a disabled preview of the form. */
function SignedOutPanel({ applicationRequired, bountyId }: { applicationRequired: boolean; bountyId: string }) {
  const t = useTranslations("bounties.action");
  // After Google sign-in and onboarding the visitor comes back to this bounty (`lib/return-path.ts`).
  const signIn = signInHref(`/bounties/${bountyId}`);
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
          <Link className={outlineButtonClass} href={signIn}>{t("signInFirst")}</Link>
        )}
      </div>
      {applicationRequired ? (
        <fieldset className="mt-4 space-y-3" disabled>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input aria-label={t("portfolioUrl")} className={inputClass} placeholder="https://" type="url" />
            <input aria-label={t("availability")} className={inputClass} placeholder={t("availability")} type="text" />
          </div>
          <textarea aria-label={t("applyMessage")} className="min-h-28 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" placeholder={t("applyMessage")} />
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href={signIn}>{t("apply")}</Link>
            <span className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong opacity-60">{t("submitDisabled")}</span>
          </div>
        </fieldset>
      ) : (
        <fieldset className="mt-4 flex flex-col gap-3 sm:flex-row" disabled>
          <input aria-label={t("submissionUrl")} className={inputClass} placeholder="https://" type="url" />
          <Link className="shrink-0 rounded-control bg-primary px-5 py-3 text-center text-sm font-semibold text-on-inverse" href={signIn}>{t("submit")}</Link>
        </fieldset>
      )}
    </section>
  );
}

/**
 * Placeholder while the session or the application/submission rows load. It reserves the height of the settled signed-out
 * panel (measured at 375 and 1280 px, apply form vs. direct submit) so the real panel replacing it does not push the page
 * down (the CLS this removes). Built from the shared `PageLoading`/`Skeleton` (status label for screen readers, pulse block is decoration).
 */
function CheckingPanel({ applicationRequired, label }: { applicationRequired: boolean; label: string }) {
  const height = applicationRequired ? "min-h-[26rem] sm:min-h-[22rem]" : "min-h-[15rem] sm:min-h-[12rem]";
  return (
    <PageLoading label={label} variant="list">
      <Skeleton className={height} />
    </PageLoading>
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
  /** `Bounty.closedReason`: why a `closed` bounty is closed; `deadline` means closed only by the deadline, so a requested revision can still be resubmitted. */
  closedReason?: ClosedReason;
};

export function BountyActionPanel(props: BountyActionPanelProps) {
  // Persistent polite live region: it exists before any feedback arrives, so success copy is announced reliably even
  // though the panel below swaps whole sections (form → status panel). Errors use role="alert" inline instead.
  const [announcement, setAnnouncement] = useState("");
  // The body keeps "I just applied/submitted" flags and feedback in state. They describe one account, so the body is
  // keyed by user id: a different account on this page (switched in another tab) starts from the server rows only.
  const auth = useAuthSnapshot();
  // The user this page last saw signed in. When the session ends under an open form (refresh rejected), the key must not
  // change to "": that would remount the body and wipe what the person typed.
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  if (auth.user && auth.user.id !== lastUserId) setLastUserId(auth.user.id);
  const sessionEnded = auth.status === "signed-out" && lastUserId !== null;
  const accountKey = auth.user?.id ?? lastUserId ?? "";
  return (
    <>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <BountyActionPanelBody key={accountKey} {...props} announce={setAnnouncement} sessionEnded={sessionEnded} />
    </>
  );
}

function BountyActionPanelBody({ bountyId, applicationRequired, applicationClosed, closedReason, status, submissionMode, announce, sessionEnded }: BountyActionPanelProps & {
  announce: (text: string) => void;
  /** The session ended after this page saw a signed-in user: keep an open form (and its text) and say so. */
  sessionEnded: boolean;
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
  // A 401 that survived the refresh: the session is gone even before the auth snapshot says so. The banner says it; no second alert.
  const [sessionLost, setSessionLost] = useState(false);
  const [applied, setApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasError = feedback?.kind === "error";
  // Shared by every input of the active form: the API error is form-level (e.g. VALIDATION_FAILED).
  const invalidProps = { "aria-invalid": hasError || undefined, "aria-describedby": hasError ? errorId : undefined };
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fieldErrorId = (name: string) => `${errorId}-${name}`;
  // A field the form flagged points at its own message; otherwise the form-level API error (if any) is the description.
  const fieldProps = (name: string) => (fieldErrors[name]
    ? { "aria-invalid": true, "aria-describedby": fieldErrorId(name) }
    : invalidProps);
  const fieldErrorLine = (name: string) => {
    const problem = fieldErrors[name];
    return problem
      ? <p className="mt-1 text-sm text-danger" id={fieldErrorId(name)} role="alert">{tError(problem === "url" ? "VALIDATION_URL" : "VALIDATION_TEXT_REQUIRED")}</p>
      : null;
  };
  // URL fields check on blur (an empty optional link is fine); required text is only checked on submit.
  const checkUrlOnBlur = (rule: FormFieldRule) => (event: FocusEvent<HTMLInputElement>) => {
    const problem = event.currentTarget.value.trim() ? fieldProblem({ ...rule, required: false }, event.currentTarget.value) : undefined;
    setFieldErrors((current) => (current[rule.name] === problem ? current : { ...current, [rule.name]: problem }));
  };
  /** Checks every field before a request; flags the problems, focuses the first and returns false when any. */
  const formIsValid = (formElement: HTMLFormElement, rules: FormFieldRule[]) => {
    const form = new FormData(formElement);
    const next: FieldErrors = {};
    for (const rule of rules) next[rule.name] = fieldProblem(rule, String(form.get(rule.name) ?? ""));
    setFieldErrors(next);
    const first = rules.find((rule) => next[rule.name]);
    if (first) (formElement.elements.namedItem(first.name) as HTMLElement | null)?.focus();
    return !first;
  };
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
    if (!formIsValid(event.currentTarget, SUBMIT_FIELDS)) return;
    inFlight.current = true;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setFeedback(null);
    setSessionLost(false);
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
      setFieldErrors({});
      // Re-read /submissions/me (and the application join) so the panel reflects the server rows, not only the local flag.
      submissionsQuery.refresh();
      if (applicationRequired) applicationsQuery.refresh();
    } catch (error) {
      if (isSessionEndedError(error)) setSessionLost(true);
      else setFeedback({ kind: "error", text: errorText(error, tError) });
      if (isStaleRowsError(error)) refreshRows();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!formIsValid(event.currentTarget, APPLY_FIELDS)) return;
    inFlight.current = true;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setFeedback(null);
    setSessionLost(false);
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
      if (isSessionEndedError(error)) setSessionLost(true);
      else setFeedback({ kind: "error", text: errorText(error, tError) });
      if (isStaleRowsError(error)) refreshRows();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // The rule for which section to show lives in lib/bounty-action-state.ts (documented by src/test/bounty-action-state.test.ts).
  const derivedView = deriveActionView({
    bountyId, applicationRequired, applicationClosed, closedReason, status, submissionMode,
    auth: auth.status,
    ...(auth.status === "signed-out" && auth.reason ? { authReason: auth.reason } : {}),
    applications: applicationsQuery,
    submissions: submissionsQuery,
    applied, submitted,
  });

  // Remember the last form on screen so a session that ends under it does not swap the form (and its typed text) for the
  // signed-out panel without a word.
  const formSignature = derivedView.kind === "applyForm" || derivedView.kind === "submitForm" ? JSON.stringify(derivedView) : null;
  const [heldForm, setHeldForm] = useState<{ signature: string; view: typeof derivedView } | null>(null);
  if (formSignature) {
    if (heldForm?.signature !== formSignature) setHeldForm({ signature: formSignature, view: derivedView });
  } else if (heldForm && derivedView.kind !== "signedOut" && derivedView.kind !== "sessionUnavailable" && derivedView.kind !== "checkingSession") {
    setHeldForm(null);
  }
  const view = sessionEnded && (derivedView.kind === "signedOut" || derivedView.kind === "sessionUnavailable") && heldForm ? heldForm.view : derivedView;
  const sessionEndedLine = sessionEnded || sessionLost ? (
    <p className="mt-3 text-sm text-danger" role="alert">
      {t("sessionEnded")}{" "}
      <Link className="font-semibold underline" href={signInHref(`/bounties/${bountyId}`)} rel="noopener" target="_blank">{t("signInAgain")}</Link>
    </p>
  ) : null;

  switch (view.kind) {
    case "closed":
      return (
        <StatusPanel
          body={view.reason === "reviewing" ? t("reviewingBody") : view.reason === "applications" ? t("applicationsClosedBody") : view.reason === "cancelled" ? t("cancelledBody") : t("closedBody")}
          link={{ href: "/bounties", label: t("browseOther") }}
          title={view.reason === "applications" ? t("applicationsClosedHeading") : t("closedHeading")}
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
      return <CheckingPanel applicationRequired={applicationRequired} label={t("checkingSession")} />;
    case "sessionUnavailable":
      return (
        <section className={panelClass} role="status">
          <h2 className={headingClass}>{t("sessionUnavailable.title")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t("sessionUnavailable.body")}</p>
          <button className="mt-4 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => window.location.reload()} type="button">{t("sessionUnavailable.retry")}</button>
        </section>
      );
    case "signedOut":
      return <SignedOutPanel applicationRequired={applicationRequired} bountyId={bountyId} />;
    case "checkingStatus":
      return <CheckingPanel applicationRequired={applicationRequired} label={t("checkingStatus")} />;
    case "statusUnavailable":
      return <section className={panelClass}><p className="text-sm text-danger">{t("statusUnavailable")}</p></section>;
    case "agentRow": {
      const { agentName, state } = view;
      const payout = view.payout ? payoutBadge(view.payout, { showPaid: true }) : null;
      const review = view.review;
      const link = { href: "/agents", label: t("manageAgents") };
      const submissionsEndpoint = `POST /agent-api/v1/bounties/${bountyId}/submissions`;
      switch (state) {
        case "applied":
          return <StatusPanel body={t("agentAppliedBody", { name: agentName })} link={link} title={t("agentRowHeading")} />;
        case "applicationRejected":
          return <StatusPanel body={t("agentApplicationRejectedBody", { name: agentName })} link={link} title={t("agentRowHeading")} tone="danger" />;
        case "applicationApproved":
          return <StatusPanel body={t("agentApplicationApprovedBody", { name: agentName })} code={submissionsEndpoint} link={link} title={t("agentRowHeading")} />;
        case "revisionRequested":
          return <StatusPanel body={t("agentRevisionBody", { name: agentName })} code={submissionsEndpoint} link={link} note={review ? t("reviewerComment", { comment: review.text }) : undefined} title={t("agentRevisionHeading")} tone="danger" />;
        case "approved":
          return <StatusPanel badge={payout ? { variant: payout.variant, label: t(payout.key) } : null} body={t("agentApprovedBody", { name: agentName })} link={link} title={t("agentApprovedHeading")} tone="success" />;
        case "rejected":
          return review?.forfeited
            ? <StatusPanel body={t("agentForfeitedBody", { name: agentName, reason: review.text })} link={link} title={t("submissionForfeitedHeading")} tone="danger" />
            : <StatusPanel body={t("agentRejectedBody", { name: agentName })} link={link} note={review ? t("reviewerComment", { comment: review.text }) : undefined} title={t("submissionRejectedHeading")} tone="danger" />;
        default:
          return <StatusPanel body={t("agentSubmittedBody", { name: agentName })} link={link} title={t("agentRowHeading")} />;
      }
    }
    case "applyForm":
      return (
        <section className={panelClass}>
          <h2 className={headingClass} ref={headingRef} tabIndex={-1}>{t("applyHeading")}</h2>
          <form className="mt-4 space-y-3" noValidate onSubmit={apply}>
            <Field label={t("portfolioUrl")} error={fieldErrorLine("portfolioUrl")}>
              <input className={inputClass} name="portfolioUrl" onBlur={checkUrlOnBlur(ruleFor(APPLY_FIELDS, "portfolioUrl"))} placeholder="https://" type="url" {...fieldProps("portfolioUrl")} />
            </Field>
            <Field label={t("applyMessage")} error={fieldErrorLine("message")}>
              <textarea className={`min-h-28 ${textareaClass}`} maxLength={APPLICATION_MESSAGE_MAX} name="message" required {...fieldProps("message")} />
            </Field>
            <button aria-busy={busy || undefined} className={submitButtonClass} disabled={busy || sessionEnded} type="submit">{busy ? <><span aria-hidden="true" className="spinner mr-2" />{t("applying")}</> : t("apply")}</button>
          </form>
          {sessionEndedLine}
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
          <form className="mt-4 space-y-3" noValidate onSubmit={submit}>
            <Field label={t("submissionUrl")} error={fieldErrorLine("submissionUrl")}>
              <input className={inputClass} name="submissionUrl" onBlur={checkUrlOnBlur(ruleFor(SUBMIT_FIELDS, "submissionUrl"))} placeholder="https://" required type="url" {...fieldProps("submissionUrl")} />
            </Field>
            <Field label={t("repositoryUrl")} error={fieldErrorLine("repositoryUrl")}>
              <input className={inputClass} name="repositoryUrl" onBlur={checkUrlOnBlur(ruleFor(SUBMIT_FIELDS, "repositoryUrl"))} placeholder="https://" type="url" {...fieldProps("repositoryUrl")} />
            </Field>
            <Field label={t("commitSha")}>
              <input className={inputClass} maxLength={COMMIT_SHA_MAX} name="commitSha" placeholder="3f2a9c1" type="text" {...invalidProps} />
            </Field>
            <Field label={t("submissionDescription")} error={fieldErrorLine("description")}>
              <textarea className={`min-h-24 ${textareaClass}`} maxLength={SUBMISSION_DESCRIPTION_MAX} name="description" required {...fieldProps("description")} />
            </Field>
            <button aria-busy={busy || undefined} className={submitButtonClass} disabled={busy || sessionEnded} type="submit">{busy ? <><span aria-hidden="true" className="spinner mr-2" />{t("submitting")}</> : actionLabel}</button>
          </form>
          {sessionEndedLine}
          {feedback?.kind === "success" ? <p className="mt-3 text-sm text-success">{feedback.text}</p> : errorLine}
        </section>
      );
    }
  }
}
