"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { useAuthSnapshot, useCohortApi } from "@/components/auth/FoundationProvider";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { focusFirstInvalid } from "@/lib/form-focus";
import { ChoiceChip } from "@/components/recruit/ChoiceChip";
import { clearCohortDraft, readCohortDraft, writeCohortDraft } from "@/lib/cohort-application-draft";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { cohortApplyErrorKey, cohortFieldErrorsFromBe, isStaleCohortError, type CohortApplyErrorKey } from "@/lib/cohort-errors";
import {
  ACTIVITY_TYPES,
  INTEREST_AREAS,
  WEB3_EXPERIENCES,
  draftToValues,
  emptyCohortDraft,
  validateCohortDraft,
  valuesToDraft,
  type CohortFieldError,
  type CohortFormDraft,
  type CohortFormErrors,
  type MyCohortApplication,
} from "@/lib/cohorts";
import {
  COHORT_DISPLAY_NAME_MAX,
  COHORT_HANDLE_INPUT_MAX,
  COHORT_INTRO_MAX,
  COHORT_INTRO_RECOMMENDED_MAX,
  COHORT_INTRO_RECOMMENDED_MIN,
  COHORT_OTHER_DETAIL_MAX,
} from "@/lib/input-limits";

const inputClass =
  "mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
const labelClass = "text-sm font-semibold text-ink";
const hintClass = "mt-1 text-xs text-ink-muted";

/** The form's fields in page order, for finding the first one with a problem. */

/** Message key under `recruit.form.errors`: the choice groups ask to pick, the two handles say what shape they take. */
function errorMessageKey(field: keyof CohortFormErrors, kind: CohortFieldError): string {
  if (kind === "required") return field === "web3Experience" || field === "activityType" || field === "interestAreas" ? "requiredChoice" : "required";
  if (kind === "invalid") return field === "telegram" ? "telegramInvalid" : field === "twitter" ? "twitterInvalid" : "invalid";
  return kind;
}

type CohortApplicationFormProps = {
  cohortId: string;
  /** Set when editing a SUBMITTED application (PATCH); otherwise the form creates one (a withdrawn one is reopened by the BE). */
  application?: MyCohortApplication;
  onSaved: (application: MyCohortApplication) => void;
  onCancel?: () => void;
  /** The BE says the page's picture is stale (cohort closed, already applied...): the parent re-reads the cohort and the applications. */
  onStale?: () => void;
};

/**
 * The cohort application form: the Tally questions, in the same order and with the same options. Validation mirrors the BE
 * (`lib/cohorts.ts validateCohortDraft`); the BE stays the judge and its 400 hints mark the same fields.
 */
export function CohortApplicationForm({ cohortId, application, onSaved, onCancel, onStale }: CohortApplicationFormProps) {
  const t = useTranslations("recruit.form");
  const tForm = useTranslations("common.form");
  const formRef = useRef<HTMLFormElement>(null);
  // Set by a failed submit, cleared once no field is flagged: drives the "N fields need attention" line.
  const [submitFailed, setSubmitFailed] = useState(false);
  const tSaveErrors = useTranslations(ERROR_COPY.cohortApply.messages);
  const api = useCohortApi();
  const editing = application !== undefined;
  const auth = useAuthSnapshot();
  const userId = auth.status === "signed-in" ? auth.user.id : null;
  // Only a NEW application keeps a per-tab draft (an edit starts from the saved values). `sent` stops late writes after success.
  const draftScope = !editing && userId ? userId : null;
  const [draft, setDraft] = useState<CohortFormDraft>(() =>
    application ? valuesToDraft(application) : ((draftScope && typeof window !== "undefined" ? readCohortDraft(draftScope, cohortId) : null) ?? emptyCohortDraft));
  // The session can resolve after the first render (locale remount): restore the stored draft once the scope becomes known, never over typed input.
  const [restoredScope, setRestoredScope] = useState(draftScope);
  if (draftScope && draftScope !== restoredScope) {
    setRestoredScope(draftScope);
    const stored = typeof window !== "undefined" ? readCohortDraft(draftScope, cohortId) : null;
    if (stored && draft === emptyCohortDraft) setDraft(stored);
  }
  const [errors, setErrors] = useState<CohortFormErrors>({});
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [saveError, setSaveError] = useState<CohortApplyErrorKey>("generic");
  // Synchronous in-flight guard: several submit events can land in one tick before React re-renders the disabled button.
  const inFlight = useRef(false);

  const sent = useRef(false);
  useEffect(() => {
    // The untouched initial object is never written, so an empty form cannot overwrite a stored draft.
    if (!draftScope || sent.current || draft === emptyCohortDraft) return;
    writeCohortDraft(draftScope, cohortId, draft);
  }, [draft, draftScope, cohortId]);

  const update = <K extends keyof CohortFormDraft>(key: K, value: CohortFormDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** Shows a field's problem once the user leaves it (a pristine form shows nothing; submit validates everything). */
  const blurField = (field: keyof CohortFormErrors) => setErrors((current) => ({ ...current, [field]: validateCohortDraft(draft)[field] }));
  const blurGroup = (field: keyof CohortFormErrors) => (event: FocusEvent<HTMLFieldSetElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) blurField(field);
  };

  const toggleInterest = (area: (typeof INTEREST_AREAS)[number]) =>
    update("interestAreas", draft.interestAreas.includes(area) ? draft.interestAreas.filter((item) => item !== area) : [...draft.interestAreas, area]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateCohortDraft(draft);
    setErrors(nextErrors);
    const values = draftToValues(draft);
    if (Object.keys(nextErrors).length > 0 || !values) {
      setState("idle");
      setSubmitFailed(true);
      focusFirstInvalid(formRef.current);
      return;
    }
    inFlight.current = true;
    setState("pending");
    try {
      const saved = application ? await api.updateCohortApplication(application.id, values) : await api.applyToCohort(cohortId, values);
      sent.current = true;
      if (draftScope) clearCohortDraft(draftScope, cohortId);
      onSaved(saved);
    } catch (error) {
      setErrors(cohortFieldErrorsFromBe(error));
      setSaveError(cohortApplyErrorKey(error));
      setState("error");
      if (isStaleCohortError(error)) onStale?.();
    } finally {
      inFlight.current = false;
    }
  };

  const fieldError = (field: keyof CohortFormErrors, id: string) => {
    const kind: CohortFieldError | undefined = errors[field];
    return kind ? (
      <p className="mt-2 text-xs text-danger" id={id} role="alert">
        {t(`errors.${errorMessageKey(field, kind)}`, { max: field === "intro" ? COHORT_INTRO_MAX : field === "displayName" ? COHORT_DISPLAY_NAME_MAX : COHORT_OTHER_DETAIL_MAX })}
      </p>
    ) : null;
  };
  const described = (field: keyof CohortFormErrors, id: string, hintId?: string) =>
    ({
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": [errors[field] ? id : null, hintId ?? null].filter(Boolean).join(" ") || undefined,
    }) as const;

  const invalidCount = Object.values(errors).filter(Boolean).length;
  if (invalidCount === 0 && submitFailed) setSubmitFailed(false);
  const introLength = [...draft.intro.trim()].length;

  return (
    <form className="space-y-6" noValidate onSubmit={(event) => void submit(event)} ref={formRef}>
      <p className="text-xs text-ink-muted">{tForm("requiredHint")}</p>
      <div>
        <label className={labelClass} htmlFor="cohort-displayName">{t("displayName.label")}</label><RequiredMark />
        <input
          {...described("displayName", "cohort-displayName-error", "cohort-displayName-hint")}
          autoComplete="name"
          className={inputClass}
          id="cohort-displayName"
          onBlur={() => blurField("displayName")}
          maxLength={COHORT_DISPLAY_NAME_MAX}
          onChange={(event) => update("displayName", event.target.value)}
          placeholder={t("displayName.placeholder")}
          required
          value={draft.displayName}
        />
        {fieldError("displayName", "cohort-displayName-error")}
        <p className={hintClass} id="cohort-displayName-hint">{t("displayName.hint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="cohort-telegram">{t("telegram.label")}</label><RequiredMark />
          <input
            {...described("telegram", "cohort-telegram-error", "cohort-telegram-hint")}
            autoCapitalize="off"
            autoComplete="off"
            className={inputClass}
            id="cohort-telegram"
          onBlur={() => blurField("telegram")}
            maxLength={COHORT_HANDLE_INPUT_MAX}
            onChange={(event) => update("telegram", event.target.value)}
            placeholder={t("telegram.placeholder")}
            required
            spellCheck={false}
            value={draft.telegram}
          />
          {fieldError("telegram", "cohort-telegram-error")}
          <p className={hintClass} id="cohort-telegram-hint">{t("telegram.hint")}</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="cohort-twitter">{t("twitter.label")}</label><RequiredMark />
          <input
            {...described("twitter", "cohort-twitter-error", "cohort-twitter-hint")}
            autoCapitalize="off"
            autoComplete="off"
            className={inputClass}
            id="cohort-twitter"
          onBlur={() => blurField("twitter")}
            maxLength={COHORT_HANDLE_INPUT_MAX}
            onChange={(event) => update("twitter", event.target.value)}
            placeholder={t("twitter.placeholder")}
            required
            spellCheck={false}
            value={draft.twitter}
          />
          {fieldError("twitter", "cohort-twitter-error")}
          <p className={hintClass} id="cohort-twitter-hint">{t("twitter.hint")}</p>
        </div>
      </div>

      <fieldset tabIndex={-1} {...described("web3Experience", "cohort-web3Experience-error")} onBlur={blurGroup("web3Experience")}>
        <legend className={labelClass}>{t("web3Experience.label")}<RequiredMark /></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEB3_EXPERIENCES.map((option) => (
            <ChoiceChip
              checked={draft.web3Experience === option}
              describedBy={errors.web3Experience ? "cohort-web3Experience-error" : undefined}
              key={option}
              label={t(`web3Experience.options.${option}`)}
              name="web3Experience"
              onChange={() => update("web3Experience", option)}
              type="radio"
              value={option}
            />
          ))}
        </div>
        {fieldError("web3Experience", "cohort-web3Experience-error")}
      </fieldset>

      <fieldset tabIndex={-1} {...described("activityType", "cohort-activityType-error")} onBlur={blurGroup("activityType")}>
        <legend className={labelClass}>{t("activityType.label")}<RequiredMark /></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((option) => (
            <ChoiceChip
              checked={draft.activityType === option}
              describedBy={errors.activityType ? "cohort-activityType-error" : undefined}
              key={option}
              label={t(`activityType.options.${option}`)}
              name="activityType"
              onChange={() => update("activityType", option)}
              type="radio"
              value={option}
            />
          ))}
        </div>
        {fieldError("activityType", "cohort-activityType-error")}
        {draft.activityType === "OTHER" ? (
          <div className="mt-3">
            <label className={labelClass} htmlFor="cohort-activityTypeOther">{t("activityType.otherLabel")}</label><RequiredMark />
            <input
              {...described("activityTypeOther", "cohort-activityTypeOther-error")}
              className={inputClass}
              id="cohort-activityTypeOther"
          onBlur={() => blurField("activityTypeOther")}
              maxLength={COHORT_OTHER_DETAIL_MAX}
              onChange={(event) => update("activityTypeOther", event.target.value)}
              placeholder={t("activityType.otherPlaceholder")}
              required
              value={draft.activityTypeOther ?? ""}
            />
            {fieldError("activityTypeOther", "cohort-activityTypeOther-error")}
          </div>
        ) : null}
      </fieldset>

      <fieldset tabIndex={-1} {...described("interestAreas", "cohort-interestAreas-error")} onBlur={blurGroup("interestAreas")}>
        <legend className={labelClass}>{t("interestAreas.label")}<RequiredMark /></legend>
        <p className={hintClass}>{t("interestAreas.hint")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_AREAS.map((option) => (
            <ChoiceChip
              checked={draft.interestAreas.includes(option)}
              describedBy={errors.interestAreas ? "cohort-interestAreas-error" : undefined}
              key={option}
              label={t(`interestAreas.options.${option}`)}
              name="interestAreas"
              onChange={() => toggleInterest(option)}
              type="checkbox"
              value={option}
            />
          ))}
        </div>
        {fieldError("interestAreas", "cohort-interestAreas-error")}
        {draft.interestAreas.includes("OTHER") ? (
          <div className="mt-3">
            <label className={labelClass} htmlFor="cohort-interestOther">{t("interestAreas.otherLabel")}</label><RequiredMark />
            <input
              {...described("interestOther", "cohort-interestOther-error")}
              className={inputClass}
              id="cohort-interestOther"
          onBlur={() => blurField("interestOther")}
              maxLength={COHORT_OTHER_DETAIL_MAX}
              onChange={(event) => update("interestOther", event.target.value)}
              placeholder={t("interestAreas.otherPlaceholder")}
              required
              value={draft.interestOther ?? ""}
            />
            {fieldError("interestOther", "cohort-interestOther-error")}
          </div>
        ) : null}
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="cohort-intro">{t("intro.label")}</label><RequiredMark />
        <textarea
          {...described("intro", "cohort-intro-error", "cohort-intro-hint")}
          className={`${inputClass} min-h-[160px]`}
          id="cohort-intro"
          onBlur={() => blurField("intro")}
          maxLength={COHORT_INTRO_MAX}
          onChange={(event) => update("intro", event.target.value)}
          placeholder={t("intro.placeholder")}
          required
          value={draft.intro}
        />
        {fieldError("intro", "cohort-intro-error")}
        <p className={hintClass} id="cohort-intro-hint">
          {t("intro.hint", { min: COHORT_INTRO_RECOMMENDED_MIN, max: COHORT_INTRO_RECOMMENDED_MAX, limit: COHORT_INTRO_MAX })}
          {" "}
          <span aria-live="off">{t("intro.counter", { count: introLength, limit: COHORT_INTRO_MAX })}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          className="block w-full rounded-control bg-primary px-5 py-3 text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[200px]"
          disabled={state === "pending"}
          type="submit"
        >
          {state === "pending" ? (editing ? t("updating") : t("submitting")) : editing ? t("update") : t("submit")}
        </button>
        {onCancel ? (
          <button
            className="block w-full rounded-control border border-primary-outline px-5 py-3 text-center text-base font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 sm:w-auto"
            disabled={state === "pending"}
            onClick={onCancel}
            type="button"
          >
            {t("cancel")}
          </button>
        ) : null}
      </div>
      {submitFailed && invalidCount > 0 ? (
        <p className="text-sm text-danger" role="status">{tForm("invalidSummary", { count: invalidCount })}</p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {tSaveErrors(saveError)}
        </p>
      ) : null}
    </form>
  );
}
