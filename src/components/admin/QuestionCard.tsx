"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LocalizedTextFields } from "@/components/admin/LocalizedTextFields";
import { opsButton, opsDangerButton } from "@/components/admin/ops-ui";
import { Badge } from "@/components/ui/Badge";
import { move, type OptionDraft, type QuestionDraft } from "@/lib/cohort-question-drafts";
import { isChoiceType, type QuestionIssueCode } from "@/lib/cohorts";
import { COHORT_OPTIONS_MAX, COHORT_OPTIONS_MIN } from "@/lib/input-limits";

export const smallButton = `${opsButton} h-11 px-3`;
const checkboxLabel = "inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink max-sm:min-h-10";

type QuestionCardProps = {
  draft: QuestionDraft;
  index: number;
  count: number;
  /** The first issue of this question (or of option `optionIndex`) among `codes`. */
  issueAt: (codes: readonly QuestionIssueCode[], optionIndex?: number) => QuestionIssueCode | undefined;
  error: (code: QuestionIssueCode | undefined) => ReactNode;
  onPatch: (change: Partial<QuestionDraft>) => void;
  onPatchOptions: (change: (options: OptionDraft[]) => OptionDraft[]) => void;
  onPatchOption: (optionIndex: number, change: Partial<OptionDraft>) => void;
  onAddOption: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
};

/** One question of the editor: its type, localized label and help, required flag and (for choice types) the option rows. */
export function QuestionCard({ draft, index, count, issueAt, error, onPatch, onPatchOptions, onPatchOption, onAddOption, onMove, onRemove }: QuestionCardProps) {
  const t = useTranslations("admin.recruitment.questions");
  const tCommon = useTranslations("admin.common");
  const number = index + 1;
  const labelIssue = issueAt(["labelRequired", "labelTooLong", "labelInvalid"]);
  const helpIssue = issueAt(["helpKoRequired", "helpTooLong", "helpInvalid"]);
  const optionsIssue = issueAt(["optionsCount"]);
  const detailIssue = issueAt(["withDetailMax"]);
  const choice = isChoiceType(draft.type);
  const detailChosen = (draft.options ?? []).some((option) => option.withDetail);
  return (
    <li className="rounded-tile border border-border bg-surface-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-bold text-ink">{t("question", { number })}</h3>
          <Badge variant="neutral">{t(`types.${draft.type}`)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <button aria-label={t("moveUp", { number })} className={smallButton} disabled={index === 0} onClick={() => onMove(index - 1)} type="button">↑</button>
          <button aria-label={t("moveDown", { number })} className={smallButton} disabled={index === count - 1} onClick={() => onMove(index + 1)} type="button">↓</button>
          <button aria-label={t("remove", { number })} className={`${opsDangerButton} h-11 px-3`} onClick={() => onRemove()} type="button">{tCommon("delete")}</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <LocalizedTextFields
          issue={error(labelIssue)}
          labels={{ ko: t("labelKo"), en: t("labelEn"), zh: t("labelZh") }}
          onChange={(lang, next) => onPatch({ [lang]: next })}
          value={draft}
        />
        <p className="text-xs text-ink-muted md:col-span-2">{t("translationHint")}</p>
        <LocalizedTextFields
          issue={error(helpIssue)}
          labels={{ ko: t("helpKo"), en: t("helpEn"), zh: t("helpZh") }}
          multiline
          onChange={(lang, next) => onPatch({ [`help${lang[0].toUpperCase()}${lang.slice(1)}`]: next })}
          value={{ ko: draft.helpKo, en: draft.helpEn, zh: draft.helpZh }}
        />
        <label className={checkboxLabel}>
          <input checked={draft.required} className="size-4 accent-primary" onChange={(event) => onPatch({ required: event.target.checked })} type="checkbox" />
          {t("required")}
        </label>
      </div>

      {choice ? (
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink">{t("options")}</legend>
          <p className="mt-1 text-xs text-ink-muted">{t("withDetailHint")}</p>
          {error(optionsIssue)}
          {error(detailIssue)}
          <ol className="mt-3 space-y-3">
            {(draft.options ?? []).map((option, optionIndex) => {
              const optionNumber = optionIndex + 1;
              const optionIssue = issueAt(["optionLabelRequired", "optionLabelTooLong", "optionLabelInvalid"], optionIndex);
              return (
                <li className="rounded-control border border-border bg-surface p-3" key={option.key}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <LocalizedTextFields
                      issue={error(optionIssue)}
                      labels={{ ko: t("optionKo", { number: optionNumber }), en: t("optionEn", { number: optionNumber }), zh: t("optionZh", { number: optionNumber }) }}
                      onChange={(lang, next) => onPatchOption(optionIndex, { [lang]: next })}
                      value={option}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className={checkboxLabel}>
                      <input
                        checked={option.withDetail}
                        className="size-4 accent-primary"
                        disabled={detailChosen && !option.withDetail}
                        onChange={(event) => onPatchOption(optionIndex, { withDetail: event.target.checked })}
                        type="checkbox"
                      />
                      {t("withDetail")}
                    </label>
                    <button aria-label={t("moveOptionUp", { number: optionNumber })} className={smallButton} disabled={optionIndex === 0} onClick={() => onPatchOptions((options) => move(options, optionIndex, optionIndex - 1))} type="button">↑</button>
                    <button aria-label={t("moveOptionDown", { number: optionNumber })} className={smallButton} disabled={optionIndex === (draft.options ?? []).length - 1} onClick={() => onPatchOptions((options) => move(options, optionIndex, optionIndex + 1))} type="button">↓</button>
                    <button
                      aria-label={t("removeOption", { number: optionNumber })}
                      className={`${opsDangerButton} h-11 px-3`}
                      disabled={(draft.options ?? []).length <= COHORT_OPTIONS_MIN}
                      onClick={() => onPatchOptions((options) => options.filter((_, at) => at !== optionIndex))}
                      type="button"
                    >
                      {tCommon("delete")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button className={`${smallButton} mt-3`} disabled={(draft.options ?? []).length >= COHORT_OPTIONS_MAX} onClick={onAddOption} type="button">{t("addOption")}</button>
        </fieldset>
      ) : null}
    </li>
  );
}
