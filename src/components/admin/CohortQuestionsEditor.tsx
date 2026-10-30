"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { QuestionCard, smallButton } from "@/components/admin/QuestionCard";
import { opsInput, opsPanelEyebrow, opsPrimaryButton } from "@/components/admin/ops-ui";
import { useAdminCohortApi } from "@/components/auth/FoundationProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { cohortAdminErrorKey } from "@/lib/cohort-errors";
import { draftsToInputs, move, toDrafts, type OptionDraft, type QuestionDraft } from "@/lib/cohort-question-drafts";
import {
  COHORT_QUESTION_TYPES,
  isChoiceType,
  validateQuestionInputs,
  type AdminCohort,
  type CohortQuestionType,
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

const maxFor = (code: QuestionIssueCode): number =>
  code === "labelTooLong" ? COHORT_QUESTION_LABEL_MAX : code === "helpTooLong" ? COHORT_HELP_MAX : code === "optionLabelTooLong" ? COHORT_OPTION_LABEL_MAX : COHORT_QUESTIONS_MAX;

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
  const patchOption = (index: number, optionIndex: number, change: Partial<OptionDraft>) =>
    patchOptions(index, (options) => options.map((item, at) => (at === optionIndex ? { ...item, ...change } : item)));
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
        {drafts.map((draft, index) => (
          <QuestionCard
            count={drafts.length}
            draft={draft}
            error={error}
            index={index}
            issueAt={(codes, optionIndex) => issueAt(index, codes, optionIndex)}
            key={draft.key}
            onAddOption={() => patchOptions(index, (options) => [...options, blankOption()])}
            onMove={(to) => setDrafts((current) => move(current, index, to))}
            onPatch={(change) => patch(index, change)}
            onPatchOption={(optionIndex, change) => patchOption(index, optionIndex, change)}
            onPatchOptions={(change) => patchOptions(index, change)}
            onRemove={() => setRemoving(index)}
          />
        ))}
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
