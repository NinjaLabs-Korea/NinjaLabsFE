import { isChoiceType, type CohortQuestion, type CohortQuestionInput, type CohortQuestionType, type LocalizedText } from "@/lib/cohorts";

export type OptionDraft = { key: string; id?: string; ko: string; en: string; zh: string; withDetail: boolean };
export type QuestionDraft = {
  key: string;
  id?: string;
  type: CohortQuestionType;
  ko: string; en: string; zh: string;
  helpKo: string; helpEn: string; helpZh: string;
  required: boolean;
  options: OptionDraft[] | null;
};

const text = (value: LocalizedText | null) => ({ ko: value?.ko ?? "", en: value?.en ?? "", zh: value?.zh ?? "" });

/** Stored questions -> editable rows (the ids ride along so the PUT keeps them; a row without an id is new). */
export function toDrafts(questions: readonly CohortQuestion[]): QuestionDraft[] {
  return questions.map((question) => {
    const label = text(question.label);
    const help = text(question.help);
    return {
      key: question.id, id: question.id, type: question.type, ...label, helpKo: help.ko, helpEn: help.en, helpZh: help.zh, required: question.required,
      options: question.options ? question.options.map((option) => ({ key: option.id, id: option.id, ...text(option.label), withDetail: option.withDetail })) : null,
    };
  });
}

const optional = (value: string) => value.trim() || null;

/** Editable rows -> the PUT body: ids kept for existing questions/options and omitted for new ones, blank translations as `null`. */
export function draftsToInputs(drafts: readonly QuestionDraft[]): CohortQuestionInput[] {
  return drafts.map((draft) => ({
    ...(draft.id ? { id: draft.id } : {}),
    type: draft.type,
    label: { ko: draft.ko.trim(), en: optional(draft.en), zh: optional(draft.zh) },
    // A translation typed without Korean help still goes out (ko empty) so validation can ask for the Korean text instead of dropping it silently.
    help: [draft.helpKo, draft.helpEn, draft.helpZh].some((value) => value.trim()) ? { ko: draft.helpKo.trim(), en: optional(draft.helpEn), zh: optional(draft.helpZh) } : null,
    required: draft.required,
    options: isChoiceType(draft.type)
      ? (draft.options ?? []).map((option) => ({ ...(option.id ? { id: option.id } : {}), label: { ko: option.ko.trim(), en: optional(option.en), zh: optional(option.zh) }, withDetail: option.withDetail }))
      : null,
  }));
}

export const move = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

