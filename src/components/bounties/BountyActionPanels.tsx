"use client";

import { useTranslations } from "next-intl";
import { useState, type FocusEvent, type ReactNode, type Ref } from "react";
import { Badge } from "@/components/ui/Badge";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import { bountyActionErrorCopy, type BountyActionErrorCopy } from "@/lib/bounty-action-state";
import { fieldProblem, validateFields, type FieldErrors, type FormFieldRule } from "@/lib/form-field-rules";
import { REVIEW_TEXT_CLASS } from "@/lib/review-comment";
import { signInHref } from "@/lib/return-path";

// Panels fade in when they replace the loading placeholder (or another panel), instead of popping in.
export const panelClass = "rounded-card border border-border bg-surface p-5 shadow-card animate-fade-in motion-reduce:animate-none";
export const submitButtonClass = "motion-control motion-press rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse disabled:opacity-60";
// The `docs/design.md` "Secondary (outline) action" size (px-5 py-3), matching `submitButtonClass` beside it. `account/AgentsView`
// keeps its own smaller row-action outline (px-4 py-2); the two are different sizes on purpose, not copies.
const outlineButtonClass = "inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong";
export const outlineLinkClass = `mt-4 ${outlineButtonClass}`;
// Bounty apply/submit fields: one-line 46px inputs, the height of the admin fields. Not the cohort form's `questionInputClass`
// (`recruit/QuestionField`: taller padded fields that also serve as textareas); the two forms look different on purpose.
export const bountyInputClass = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
// Headings that receive focus after a successful apply/submit (tabIndex={-1}); the ring matches the focus recipe.
export const headingClass = "font-display text-2xl -tracking-[0.24px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function StatusPanel({ title, body, note, tone = "muted", feedback, link, headingRef, badge, code }: {
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
/**
 * The bounty detail's signed-out state: the apply/submit panel shape with a disabled preview of the form and a sign-in link back
 * to this bounty. Not `account/SignedOutPanel` (the owner pages' dashed "sign in to see this" tile with a session-retry state).
 */
export function BountySignedOutPanel({ applicationRequired, bountyId }: { applicationRequired: boolean; bountyId: string }) {
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
            <input aria-label={t("portfolioUrl")} className={bountyInputClass} placeholder="https://" type="url" />
            <input aria-label={t("availability")} className={bountyInputClass} placeholder={t("availability")} type="text" />
          </div>
          <textarea aria-label={t("applyMessage")} className="min-h-28 w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" placeholder={t("applyMessage")} />
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href={signIn}>{t("apply")}</Link>
            <span className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong opacity-60">{t("submitDisabled")}</span>
          </div>
        </fieldset>
      ) : (
        <fieldset className="mt-4 flex flex-col gap-3 sm:flex-row" disabled>
          <input aria-label={t("submissionUrl")} className={bountyInputClass} placeholder="https://" type="url" />
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
export function CheckingPanel({ applicationRequired, label }: { applicationRequired: boolean; label: string }) {
  const height = applicationRequired ? "min-h-[26rem] sm:min-h-[22rem]" : "min-h-[15rem] sm:min-h-[12rem]";
  return (
    <PageLoading label={label} variant="list">
      <Skeleton className={height} />
    </PageLoading>
  );
}

const labelTextClass = "mb-1.5 block text-sm font-semibold text-ink";

// Which section renders is decided by `deriveActionView` (lib/bounty-action-state.ts); this file only draws each `view.kind`.
// Error copy keys come from `bountyActionErrorCopy` (codes listed in lib/api/error-copy.ts `ERROR_COPY.bountyAction`).
export type ErrorTranslator = (key: BountyActionErrorCopy["key"], values?: { code: string }) => string;

export function errorText(error: unknown, t: ErrorTranslator): string {
  const copy = bountyActionErrorCopy(error);
  return copy.key === "unknown" ? t("unknown", { code: copy.code }) : t(copy.key);
}

/** Visible label above a form control (Figma 15/15v draw placeholders only; see docs/figma/design-gaps.md). */
export function Field({ label, children, error }: { label: string; children: ReactNode; error?: ReactNode }) {
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

/** State and helpers for the form's own per-field problems (before any request); `invalidProps` is the form-level API error fallback. */
export function useFieldErrors(errorId: string, invalidProps: Record<string, unknown>, tError: (key: "VALIDATION_URL" | "VALIDATION_TEXT_REQUIRED") => string) {
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
    const { errors, first } = validateFields(new FormData(formElement), rules);
    setFieldErrors(errors);
    if (first) (formElement.elements.namedItem(first.name) as HTMLElement | null)?.focus();
    return !first;
  };
  return { setFieldErrors, fieldProps, fieldErrorLine, checkUrlOnBlur, formIsValid };
}
