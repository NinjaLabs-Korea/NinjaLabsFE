"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FocusEvent } from "react";
import { ChoiceChip } from "@/components/recruit/ChoiceChip";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { answerTextLimit, isChoiceType, localized, type CohortAnswerError, type CohortDraftAnswer, type CohortQuestion } from "@/lib/cohorts";
import { COHORT_OTHER_DETAIL_MAX } from "@/lib/input-limits";

export const inputClass =
  "mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
export const labelClass = "text-sm font-semibold text-ink";
export const hintClass = "mt-1 text-xs text-ink-muted";

type QuestionFieldProps = {
  question: CohortQuestion;
  value: CohortDraftAnswer;
  error: CohortAnswerError | undefined;
  onChange: (next: CohortDraftAnswer) => void;
  /** Called when focus leaves the field (a choice group: the whole group), so the form can show this question's problem. */
  onBlur: () => void;
};

/**
 * One configured question of the cohort application: a short answer, a long answer, one choice or several. The label, help and
 * option texts come from the question in the viewer's language (Korean when a translation is missing). A chosen option that asks
 * for a detail reveals a 60-character input right below the choices.
 */
export function QuestionField({ question, value, error, onChange, onBlur }: QuestionFieldProps) {
  const t = useTranslations("recruit.form");
  const locale = useLocale();
  const id = `cohort-q-${question.id}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const label = localized(question.label, locale);
  const help = question.help ? localized(question.help, locale) : null;
  const asksDetail = (question.options ?? []).some((option) => option.withDetail && value.choices.includes(option.id));
  const detailError = error === "otherRequired" || (isChoiceType(question.type) && error === "tooLong") ? error : undefined;
  const groupError = detailError ? undefined : error;
  const max = isChoiceType(question.type) ? COHORT_OTHER_DETAIL_MAX : answerTextLimit(question.type);

  const message = (kind: CohortAnswerError, forId: string) => (
    <p className="mt-2 text-xs text-danger" id={forId} role="alert">
      {t(`errors.${kind === "required" && isChoiceType(question.type) ? "requiredChoice" : kind}`, { max })}
    </p>
  );
  const describedBy = (invalid: boolean, extra?: string) => [invalid ? errorId : null, extra ?? null].filter(Boolean).join(" ") || undefined;

  if (!isChoiceType(question.type)) {
    const long = question.type === "LONG_TEXT";
    const shared = {
      "aria-describedby": describedBy(groupError !== undefined, help || long ? hintId : undefined),
      "aria-invalid": groupError ? true : undefined,
      className: long ? `${inputClass} min-h-[160px]` : inputClass,
      id,
      maxLength: answerTextLimit(question.type),
      onBlur,
      required: question.required,
      value: value.text,
    } as const;
    return (
      <div>
        <label className={labelClass} htmlFor={id}>{label}</label>{question.required ? <RequiredMark /> : null}
        {long ? (
          <textarea {...shared} onChange={(event) => onChange({ ...value, text: event.target.value })} />
        ) : (
          <input {...shared} onChange={(event) => onChange({ ...value, text: event.target.value })} />
        )}
        {groupError ? message(groupError, errorId) : null}
        {help || long ? (
          <p className={hintClass} id={hintId}>
            {help}
            {help && long ? " " : null}
            {long ? <span aria-live="off">{t("question.counter", { count: [...value.text.trim()].length, limit: answerTextLimit(question.type) })}</span> : null}
          </p>
        ) : null}
      </div>
    );
  }

  const single = question.type === "SINGLE_CHOICE";
  const toggle = (optionId: string) =>
    onChange({ ...value, choices: single ? [optionId] : value.choices.includes(optionId) ? value.choices.filter((item) => item !== optionId) : [...value.choices, optionId] });
  const detailId = `${id}-other`;
  return (
    <fieldset
      aria-invalid={groupError ? true : undefined}
      aria-describedby={describedBy(groupError !== undefined, help ? hintId : undefined)}
      aria-required={single && question.required ? true : undefined}
      onBlur={(event: FocusEvent<HTMLFieldSetElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
      role={single ? "radiogroup" : undefined}
      tabIndex={-1}
    >
      <legend className={labelClass}>{label}{question.required ? <RequiredMark /> : null}</legend>
      {help ? <p className={hintClass} id={hintId}>{help}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {(question.options ?? []).map((option) => (
          <ChoiceChip
            checked={value.choices.includes(option.id)}
            describedBy={groupError ? errorId : undefined}
            key={option.id}
            label={localized(option.label, locale)}
            name={id}
            onChange={() => toggle(option.id)}
            type={single ? "radio" : "checkbox"}
            value={option.id}
          />
        ))}
      </div>
      {groupError ? message(groupError, errorId) : null}
      {asksDetail ? (
        <div className="mt-3">
          <label className={labelClass} htmlFor={detailId}>{t("question.detailLabel")}</label><RequiredMark />
          <input
            aria-describedby={detailError ? `${detailId}-error` : undefined}
            aria-invalid={detailError ? true : undefined}
            className={inputClass}
            id={detailId}
            maxLength={COHORT_OTHER_DETAIL_MAX}
            onChange={(event) => onChange({ ...value, other: event.target.value })}
            placeholder={t("question.detailPlaceholder")}
            required
            value={value.other}
          />
          {detailError ? message(detailError, `${detailId}-error`) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
