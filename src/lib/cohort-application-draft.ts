import { emptyCohortDraft, emptyDraftAnswer, type CohortDraftAnswer, type CohortFormDraft, type CohortQuestion } from "@/lib/cohorts";
import { readStorage, removeStorage, writeStorage } from "@/lib/safe-storage";

/**
 * Per tab (sessionStorage) copy of an unsent cohort application, so a reload, back navigation or an expired session does not
 * lose the longest form in the product. Scoped to the user AND the cohort: another account in the same tab, or the next
 * cohort, never sees it. Answers are keyed by question id; the `v2` key keeps the old fixed-question drafts from being misread.
 * Every access is guarded: blocked storage just means no draft.
 */
const keyFor = (userId: string, cohortId: string) => `ninja.cohortDraft.v2:${userId}:${cohortId}`;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** Keeps only what the cohort's questions can still take: unknown questions are dropped, unknown option ids filtered out. */
function readAnswers(raw: unknown, questions: readonly CohortQuestion[]): Record<string, CohortDraftAnswer> {
  const answers: Record<string, CohortDraftAnswer> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return answers;
  const stored = raw as Record<string, unknown>;
  for (const question of questions) {
    const value = stored[question.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const optionIds = new Set((question.options ?? []).map((option) => option.id));
    const choices = Array.isArray(v.choices) ? v.choices.filter((id): id is string => typeof id === "string" && optionIds.has(id)) : [];
    answers[question.id] = { ...emptyDraftAnswer, text: text(v.text) ?? "", choices, other: text(v.other) ?? "" };
  }
  return answers;
}

export function readCohortDraft(userId: string, cohortId: string, questions: readonly CohortQuestion[]): CohortFormDraft | null {
  try {
    const raw = readStorage("session", keyFor(userId, cohortId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    const displayName = text(v.displayName);
    const telegram = text(v.telegram);
    const twitter = text(v.twitter);
    const intro = text(v.intro);
    if (displayName === null || telegram === null || twitter === null || intro === null) return null;
    return { ...emptyCohortDraft, displayName, telegram, twitter, intro, answers: readAnswers(v.answers, questions) };
  } catch {
    return null;
  }
}

export function writeCohortDraft(userId: string, cohortId: string, draft: CohortFormDraft): void {
  // storage blocked: the form on screen still keeps what was typed
  writeStorage("session", keyFor(userId, cohortId), JSON.stringify(draft));
}

export function clearCohortDraft(userId: string, cohortId: string): void {
  removeStorage("session", keyFor(userId, cohortId));
}
