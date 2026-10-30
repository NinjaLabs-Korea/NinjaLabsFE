"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { opsButton, opsDangerButton, opsInput, opsPanelEyebrow, opsPrimaryButton, opsTextarea } from "@/components/admin/ops-ui";
import { useAdminCohortApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { cohortAdminErrorKey } from "@/lib/cohort-errors";
import {
  COHORT_QUESTION_TYPES,
  isChoiceType,
  validateQuestionInputs,
  type AdminCohort,
  type CohortQuestion,
  type CohortQuestionInput,
  type CohortQuestionType,
  type LocalizedText,
  type QuestionIssue,
  type QuestionIssueCode,
} from "@/lib/cohorts";
import {
  COHORT_HELP_MAX,
  COHORT_OPTIONS_MAX,
  COHORT_OPTIONS_MIN,
  COHORT_OPTION_LABEL_MAX,
  COHORT_QUESTIONS_MAX,
  COHORT_QUESTION_LABEL_MAX,
} from "@/lib/input-limits";

type OptionDraft = { key: string; id?: string; ko: string; en: string; zh: string; withDetail: boolean };
type QuestionDraft = {
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
function toDrafts(questions: readonly CohortQuestion[]): QuestionDraft[] {
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
    help: draft.helpKo.trim() ? { ko: draft.helpKo.trim(), en: optional(draft.helpEn), zh: optional(draft.helpZh) } : null,
    required: draft.required,
    options: isChoiceType(draft.type)
      ? (draft.options ?? []).map((option) => ({ ...(option.id ? { id: option.id } : {}), label: { ko: option.ko.trim(), en: optional(option.en), zh: optional(option.zh) }, withDetail: option.withDetail }))
      : null,
  }));
}

const move = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

const maxFor = (code: QuestionIssueCode): number =>
  code === "labelTooLong" ? COHORT_QUESTION_LABEL_MAX : code === "helpTooLong" ? COHORT_HELP_MAX : code === "optionLabelTooLong" ? COHORT_OPTION_LABEL_MAX : COHORT_QUESTIONS_MAX;

const smallButton = `${opsButton} h-11 px-3`;
const checkboxLabel = "inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink max-sm:min-h-10";

type CohortQuestionsEditorProps = {
  cohort: AdminCohort;
  /** Reports whether the editor holds unsaved changes (the page asks before closing it). */
  onDirtyChange: (dirty: boolean) => void;
  /** The BE accepted the list: the page re-reads the cohorts. */
  onSaved: (cohort: AdminCohort) => void;
  onClose: () => void;
};

/**
 * `/admin/recruitment` > one cohort > "지원서 질문": the questions asked in the application besides the four fixed fields. One Save sends the
 * whole list (`PUT /admin/cohorts/:id/questions`); editing never touches applications already received (their answers are snapshots).
 */
export function CohortQuestionsEditor({ cohort, onDirtyChange, onSaved, onClose }: CohortQuestionsEditorProps) {
  const api = useAdminCohortApi();
  const t = useTranslations("admin.recruitment.questions");
  const tCommon = useTranslations("admin.common");
  const tErrors = useTranslations(ERROR_COPY.adminCohort.messages);
  const nextKey = useRef(0);
  const newKey = () => `new-${++nextKey.current}`;
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftsToInputs(toDrafts(cohort.questions))));
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() => toDrafts(cohort.questions));
  const [newType, setNewType] = useState<CohortQuestionType>("SHORT_TEXT");
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const inputs = draftsToInputs(drafts);
  const dirty = JSON.stringify(inputs) !== baseline;
  const issues: QuestionIssue[] = showIssues ? validateQuestionInputs(inputs) : [];
  const issueAt = (index: number, codes: readonly QuestionIssueCode[], optionIndex?: number) =>
    issues.find((issue) => issue.index === index && issue.optionIndex === optionIndex && codes.includes(issue.code))?.code;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (index: number, change: Partial<QuestionDraft>) => setDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, ...change } : draft)));
  const patchOptions = (index: number, change: (options: OptionDraft[]) => OptionDraft[]) =>
    setDrafts((current) => current.map((draft, at) => (at === index ? { ...draft, options: change(draft.options ?? []) } : draft)));
  const blankOption = (): OptionDraft => ({ key: newKey(), ko: "", en: "", zh: "", withDetail: false });

  const addQuestion = () =>
    setDrafts((current) =>
      current.length >= COHORT_QUESTIONS_MAX
        ? current
        : [...current, { key: newKey(), type: newType, ko: "", en: "", zh: "", helpKo: "", helpEn: "", helpZh: "", required: false, options: isChoiceType(newType) ? [blankOption(), blankOption()] : null }],
    );

  const error = (code: QuestionIssueCode | undefined) =>
    code ? <span className="mt-1 block text-xs font-normal text-danger" role="alert">{t(`errors.${code}`, { max: maxFor(code), min: COHORT_OPTIONS_MIN })}</span> : null;

  const save = async () => {
    if (saving) return;
    const problems = validateQuestionInputs(inputs);
    if (problems.length > 0) {
      setShowIssues(true);
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("fix") });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.saveAdminCohortQuestions(cohort.id, inputs);
      const next = toDrafts(saved.questions);
      setDrafts(next);
      setBaseline(JSON.stringify(draftsToInputs(next)));
      setShowIssues(false);
      pushAdminToast({ variant: "success", title: t("savedTitle"), description: t("savedDescription", { name: saved.name }) });
      onSaved(saved);
    } catch (caught) {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: tErrors(cohortAdminErrorKey(caught)) });
    } finally {
      setSaving(false);
    }
  };

  const removedDraft = removing === null ? null : drafts[removing];

  return (
    <section aria-labelledby={`questions-${cohort.id}`} className="rounded-card border border-border bg-surface p-[21px] shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={opsPanelEyebrow}>{t("eyebrow")}</p>
          <h2 className="mt-2 break-words font-display text-2xl tracking-[-0.24px] text-ink" id={`questions-${cohort.id}`}>{t("heading", { name: cohort.name })}</h2>
        </div>
        <button className={smallButton} onClick={onClose} type="button">{t("close")}</button>
      </div>
      <p className="mt-3 text-sm text-ink-muted">{t("intro")}</p>
      <p className="mt-1 text-xs text-ink-muted">{t("note")}</p>
      <p className="mt-1 text-xs text-ink-muted">{t("limits", { questions: COHORT_QUESTIONS_MAX, min: COHORT_OPTIONS_MIN, max: COHORT_OPTIONS_MAX })}</p>
      {error(issueAt(-1, ["tooManyQuestions"]))}

      {drafts.length === 0 ? <p className="mt-5 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-4 text-sm text-ink-muted">{t("empty")}</p> : null}

      <ol className="mt-5 space-y-5">
        {drafts.map((draft, index) => {
          const number = index + 1;
          const labelIssue = issueAt(index, ["labelRequired", "labelTooLong", "labelInvalid"]);
          const helpIssue = issueAt(index, ["helpTooLong", "helpInvalid"]);
          const optionsIssue = issueAt(index, ["optionsCount"]);
          const detailIssue = issueAt(index, ["withDetailMax"]);
          const choice = isChoiceType(draft.type);
          const detailChosen = (draft.options ?? []).some((option) => option.withDetail);
          return (
            <li className="rounded-tile border border-border bg-surface-subtle p-4" key={draft.key}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">{t("question", { number })}</h3>
                  <Badge variant="neutral">{t(`types.${draft.type}`)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button aria-label={t("moveUp", { number })} className={smallButton} disabled={index === 0} onClick={() => setDrafts((current) => move(current, index, index - 1))} type="button">↑</button>
                  <button aria-label={t("moveDown", { number })} className={smallButton} disabled={index === drafts.length - 1} onClick={() => setDrafts((current) => move(current, index, index + 1))} type="button">↓</button>
                  <button aria-label={t("remove", { number })} className={`${opsDangerButton} h-11 px-3`} onClick={() => setRemoving(index)} type="button">{tCommon("delete")}</button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-ink md:col-span-2">{t("labelKo")}
                  <input aria-invalid={labelIssue ? true : undefined} className={opsInput} onChange={(event) => patch(index, { ko: event.target.value })} value={draft.ko} />
                  {error(labelIssue)}
                </label>
                <label className="text-sm font-semibold text-ink">{t("labelEn")}
                  <input className={opsInput} onChange={(event) => patch(index, { en: event.target.value })} value={draft.en} />
                </label>
                <label className="text-sm font-semibold text-ink">{t("labelZh")}
                  <input className={opsInput} onChange={(event) => patch(index, { zh: event.target.value })} value={draft.zh} />
                </label>
                <p className="text-xs text-ink-muted md:col-span-2">{t("translationHint")}</p>
                <label className="text-sm font-semibold text-ink md:col-span-2">{t("helpKo")}
                  <textarea aria-invalid={helpIssue ? true : undefined} className={opsTextarea} onChange={(event) => patch(index, { helpKo: event.target.value })} value={draft.helpKo} />
                  {error(helpIssue)}
                </label>
                <label className="text-sm font-semibold text-ink">{t("helpEn")}
                  <input className={opsInput} onChange={(event) => patch(index, { helpEn: event.target.value })} value={draft.helpEn} />
                </label>
                <label className="text-sm font-semibold text-ink">{t("helpZh")}
                  <input className={opsInput} onChange={(event) => patch(index, { helpZh: event.target.value })} value={draft.helpZh} />
                </label>
                <label className={checkboxLabel}>
                  <input checked={draft.required} className="size-4 accent-primary" onChange={(event) => patch(index, { required: event.target.checked })} type="checkbox" />
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
                      const optionIssue = issueAt(index, ["optionLabelRequired", "optionLabelTooLong", "optionLabelInvalid"], optionIndex);
                      return (
                        <li className="rounded-control border border-border bg-surface p-3" key={option.key}>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="text-sm font-semibold text-ink md:col-span-2">{t("optionKo", { number: optionNumber })}
                              <input aria-invalid={optionIssue ? true : undefined} className={opsInput} onChange={(event) => patchOptions(index, (options) => options.map((item, at) => (at === optionIndex ? { ...item, ko: event.target.value } : item)))} value={option.ko} />
                              {error(optionIssue)}
                            </label>
                            <label className="text-sm font-semibold text-ink">{t("optionEn", { number: optionNumber })}
                              <input className={opsInput} onChange={(event) => patchOptions(index, (options) => options.map((item, at) => (at === optionIndex ? { ...item, en: event.target.value } : item)))} value={option.en} />
                            </label>
                            <label className="text-sm font-semibold text-ink">{t("optionZh", { number: optionNumber })}
                              <input className={opsInput} onChange={(event) => patchOptions(index, (options) => options.map((item, at) => (at === optionIndex ? { ...item, zh: event.target.value } : item)))} value={option.zh} />
                            </label>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <label className={checkboxLabel}>
                              <input
                                checked={option.withDetail}
                                className="size-4 accent-primary"
                                disabled={detailChosen && !option.withDetail}
                                onChange={(event) => patchOptions(index, (options) => options.map((item, at) => (at === optionIndex ? { ...item, withDetail: event.target.checked } : item)))}
                                type="checkbox"
                              />
                              {t("withDetail")}
                            </label>
                            <button aria-label={t("moveOptionUp", { number: optionNumber })} className={smallButton} disabled={optionIndex === 0} onClick={() => patchOptions(index, (options) => move(options, optionIndex, optionIndex - 1))} type="button">↑</button>
                            <button aria-label={t("moveOptionDown", { number: optionNumber })} className={smallButton} disabled={optionIndex === (draft.options ?? []).length - 1} onClick={() => patchOptions(index, (options) => move(options, optionIndex, optionIndex + 1))} type="button">↓</button>
                            <button
                              aria-label={t("removeOption", { number: optionNumber })}
                              className={`${opsDangerButton} h-11 px-3`}
                              disabled={(draft.options ?? []).length <= COHORT_OPTIONS_MIN}
                              onClick={() => patchOptions(index, (options) => options.filter((_, at) => at !== optionIndex))}
                              type="button"
                            >
                              {tCommon("delete")}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <button className={`${smallButton} mt-3`} disabled={(draft.options ?? []).length >= COHORT_OPTIONS_MAX} onClick={() => patchOptions(index, (options) => [...options, blankOption()])} type="button">{t("addOption")}</button>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-ink">{t("addType")}
          <select className={`${opsInput} w-auto min-w-[180px]`} onChange={(event) => setNewType(event.target.value as CohortQuestionType)} value={newType}>
            {COHORT_QUESTION_TYPES.map((type) => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
          </select>
        </label>
        <button className={`${smallButton} mb-0`} disabled={drafts.length >= COHORT_QUESTIONS_MAX} onClick={addQuestion} type="button">{t("add")}</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className={`${opsPrimaryButton} h-11 px-4`} disabled={saving || !dirty} onClick={() => void save()} type="button">{saving ? t("saving") : t("save")}</button>
        {dirty ? <span className="text-xs text-ink-muted" role="status">{t("dirty")}</span> : null}
      </div>

      <ConfirmDialog
        confirmLabel={t("removeDialog.confirm")}
        description={t("removeDialog.description")}
        destructive
        eyebrow={t("removeDialog.eyebrow")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) setDrafts((current) => current.filter((_, at) => at !== removing));
          setRemoving(null);
        }}
        open={removedDraft !== null}
        title={t("removeDialog.title")}
      />
    </section>
  );
}
