"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthSnapshot, useCohortApi } from "@/components/auth/FoundationProvider";
import { QuestionField, hintClass, labelClass, questionInputClass } from "@/components/recruit/QuestionField";
import { useCurrentCohort } from "@/components/hooks/useCurrentCohort";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { focusFirstInvalid } from "@/lib/form-focus";
import { clearCohortDraft, readCohortDraft, writeCohortDraft } from "@/lib/cohort-application-draft";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { cohortApplyErrorKey, cohortFieldErrorsFromBe, isQuestionsChangedError, isStaleCohortError, type CohortApplyErrorKey } from "@/lib/cohort-errors";
import {
  applicationToDraft,
  draftToValues,
  emptyCohortDraft,
  emptyDraftAnswer,
  validateAnswers,
  validateCohortDraft,
  type CohortAnswerErrors,
  type CohortDraftAnswer,
  type CohortFieldError,
  type CohortFixedField,
  type CohortFormDraft,
  type CohortFormErrors,
  type CohortQuestion,
  type MyCohortApplication,
} from "@/lib/cohorts";
import {
  COHORT_DISPLAY_NAME_MAX,
  COHORT_HANDLE_INPUT_MAX,
  COHORT_INTRO_MAX,
  COHORT_INTRO_RECOMMENDED_MAX,
  COHORT_INTRO_RECOMMENDED_MIN,
} from "@/lib/input-limits";

/** Message key under `recruit.form.errors`: the two handles say what shape they take. */
function errorMessageKey(field: CohortFixedField, kind: CohortFieldError): string {
  if (kind === "invalid") return field === "telegram" ? "telegramInvalid" : field === "twitter" ? "twitterInvalid" : "invalid";
  return kind;
}

const NO_QUESTIONS: readonly CohortQuestion[] = [];

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
 * The cohort application form: the four fixed fields, then the questions the operator configured for this cohort, in order.
 * Validation mirrors the BE (`lib/cohorts.ts validateCohortDraft` / `validateAnswers`); the BE stays the judge and its 400 hints mark the same fields.
 */
export function CohortApplicationForm({ cohortId, application, onSaved, onCancel, onStale }: CohortApplicationFormProps) {
  const t = useTranslations("recruit.form");
  const tForm = useTranslations("common.form");
  const formRef = useRef<HTMLFormElement>(null);
  // Set by a failed submit, cleared once no field is flagged: drives the "N fields need attention" line.
  const [submitFailed, setSubmitFailed] = useState(false);
  const tSaveErrors = useTranslations(ERROR_COPY.cohortApply.messages);
  const api = useCohortApi();
  const current = useCurrentCohort();
  // The form is only shown for the current cohort, so its questions are the page's own read of it; a stale-form answer from the BE re-reads it (`current.reload`).
  const questions = current.cohort?.questions ?? NO_QUESTIONS;
  const editing = application !== undefined;
  const auth = useAuthSnapshot();
  const userId = auth.status === "signed-in" ? auth.user.id : null;
  // Only a NEW application keeps a per-tab draft (an edit starts from the saved values). `sent` stops late writes after success.
  const draftScope = !editing && userId ? userId : null;
  const [draft, setDraft] = useState<CohortFormDraft>(() =>
    application ? applicationToDraft(application) : ((draftScope && typeof window !== "undefined" ? readCohortDraft(draftScope, cohortId, questions) : null) ?? emptyCohortDraft));
  // The session can resolve after the first render (locale remount): restore the stored draft once the scope becomes known, never over typed input.
  const [restoredScope, setRestoredScope] = useState(draftScope);
  if (draftScope && draftScope !== restoredScope) {
    setRestoredScope(draftScope);
    const stored = typeof window !== "undefined" ? readCohortDraft(draftScope, cohortId, questions) : null;
    if (stored && draft === emptyCohortDraft) setDraft(stored);
  }
  // Answers of a stored draft can only be matched to questions once the cohort is read: restore them then, never over what was typed meanwhile.
  const questionsKnown = current.status === "ready";
  const [answersRestored, setAnswersRestored] = useState(questionsKnown);
  if (questionsKnown && !answersRestored) {
    setAnswersRestored(true);
    const stored = draftScope && typeof window !== "undefined" ? readCohortDraft(draftScope, cohortId, questions) : null;
    if (stored) setDraft((previous) => ({ ...previous, answers: { ...stored.answers, ...previous.answers } }));
  }
  const [errors, setErrors] = useState<CohortFormErrors>({});
  const [answerErrors, setAnswerErrors] = useState<CohortAnswerErrors>({});
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [saveError, setSaveError] = useState<CohortApplyErrorKey>("generic");
  // Synchronous in-flight guard: several submit events can land in one tick before React re-renders the disabled button.
  const inFlight = useRef(false);

  const sent = useRef(false);
  useEffect(() => {
    // The untouched initial object is never written, so an empty form cannot overwrite a stored draft.
    // Not before the questions are known: a draft written without them would erase the stored answers.
    if (!draftScope || sent.current || draft === emptyCohortDraft || !questionsKnown) return;
    writeCohortDraft(draftScope, cohortId, draft);
  }, [draft, draftScope, cohortId, questionsKnown]);

  const update = <K extends CohortFixedField>(key: K, value: CohortFormDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  const updateAnswer = (questionId: string, next: CohortDraftAnswer) => {
    setDraft((previous) => ({ ...previous, answers: { ...previous.answers, [questionId]: next } }));
    setAnswerErrors(({ [questionId]: _cleared, ...rest }) => (void _cleared, rest));
  };

  const answerProblems = (from: CohortFormDraft) => validateAnswers(questions, draftToValues(from, questions).answers);

  /** Shows a field's problem once the user leaves it (a pristine form shows nothing; submit validates everything). */
  const blurField = (field: CohortFixedField) => setErrors((previous) => ({ ...previous, [field]: validateCohortDraft(draft)[field] }));
  const blurAnswer = (questionId: string) =>
    setAnswerErrors(({ [questionId]: _old, ...rest }) => {
      void _old;
      const next = answerProblems(draft)[questionId];
      return next ? { ...rest, [questionId]: next } : rest;
    });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateCohortDraft(draft);
    const values = draftToValues(draft, questions);
    const nextAnswerErrors = validateAnswers(questions, values.answers);
    setErrors(nextErrors);
    setAnswerErrors(nextAnswerErrors);
    if (Object.keys(nextErrors).length > 0 || Object.keys(nextAnswerErrors).length > 0) {
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
      // The operator changed the questions while this was being filled in: read them again, keep what was typed (the draft stays in storage and state).
      if (isQuestionsChangedError(error)) current.reload();
      if (isStaleCohortError(error)) onStale?.();
    } finally {
      inFlight.current = false;
    }
  };

  const fieldError = (field: CohortFixedField, id: string) => {
    const kind: CohortFieldError | undefined = errors[field];
    return kind ? (
      <p className="mt-2 text-xs text-danger" id={id} role="alert">
        {t(`errors.${errorMessageKey(field, kind)}`, { max: field === "intro" ? COHORT_INTRO_MAX : COHORT_DISPLAY_NAME_MAX })}
      </p>
    ) : null;
  };
  const described = (field: CohortFixedField, id: string, hintId?: string) =>
    ({
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": [errors[field] ? id : null, hintId ?? null].filter(Boolean).join(" ") || undefined,
    }) as const;

  const invalidCount = Object.values(errors).filter(Boolean).length + Object.keys(answerErrors).length;
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
          className={questionInputClass}
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
            className={questionInputClass}
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
            className={questionInputClass}
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

      <div>
        <label className={labelClass} htmlFor="cohort-intro">{t("intro.label")}</label><RequiredMark />
        <textarea
          {...described("intro", "cohort-intro-error", "cohort-intro-hint")}
          className={`${questionInputClass} min-h-[160px]`}
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

      {questions.map((question) => (
        <QuestionField
          error={answerErrors[question.id]}
          key={question.id}
          onBlur={() => blurAnswer(question.id)}
          onChange={(next) => updateAnswer(question.id, next)}
          question={question}
          value={draft.answers[question.id] ?? emptyDraftAnswer}
        />
      ))}

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
