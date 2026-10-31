// Fixture-free cohort (recruitment) types, option lists and the applicant-form rules. Client islands (`components/recruit/*`,
// `components/admin/Recruitment*`) and the api/mock clients import from here. The BE source of truth is
// `NinjaLabsBE/src/cohorts/{cohort-status,cohort-fields}.ts`; keep the lists below in step with it.
import {
  COHORT_DISPLAY_NAME_MAX,
  COHORT_HELP_MAX,
  COHORT_INTRO_MAX,
  COHORT_LONG_TEXT_MAX,
  COHORT_OPTIONS_MAX,
  COHORT_OPTIONS_MIN,
  COHORT_OPTION_LABEL_MAX,
  COHORT_OTHER_DETAIL_MAX,
  COHORT_QUESTIONS_MAX,
  COHORT_QUESTION_LABEL_MAX,
  COHORT_SHORT_TEXT_MAX,
} from "./input-limits";
import { hasVisibleText, isPlainDisplayText } from "./visible-text";

export const COHORT_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export const COHORT_APPLICATION_STATUSES = ["SUBMITTED", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
export type CohortApplicationStatus = (typeof COHORT_APPLICATION_STATUSES)[number];

/** Operator decisions; the decision is also the status afterwards (and an operator may change a decision later). */
export const COHORT_REVIEW_DECISIONS = ["ACCEPTED", "REJECTED"] as const;
export type CohortReviewDecision = (typeof COHORT_REVIEW_DECISIONS)[number];

// ── Configurable questions (BE `src/cohorts/cohort-questions.ts`; docs/api-contract.md "기수 모집") ──

/** Display text: `text[locale] ?? text.ko` (an empty `en`/`zh` is stored as `null`). */
export type LocalizedText = { ko: string; en: string | null; zh: string | null };

export const COHORT_QUESTION_TYPES = ["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"] as const;
export type CohortQuestionType = (typeof COHORT_QUESTION_TYPES)[number];

export const isChoiceType = (type: CohortQuestionType): boolean => type === "SINGLE_CHOICE" || type === "MULTI_CHOICE";

export type CohortQuestionOption = { id: string; label: LocalizedText; withDetail: boolean };

export type CohortQuestion = {
  id: string;
  type: CohortQuestionType;
  label: LocalizedText;
  help: LocalizedText | null;
  required: boolean;
  /** `null` for the two text types. */
  options: CohortQuestionOption[] | null;
};

/** One stored answer: a snapshot the server copied from the question at write time (labels included), so old answers stay readable after the form changes. */
export type ApplicationAnswer = {
  questionId: string;
  type: CohortQuestionType;
  label: LocalizedText;
  text: string | null;
  choices: { id: string; label: LocalizedText }[] | null;
  other: string | null;
};

/** One answer in the apply/update body. */
export type AnswerInput = { questionId: string; text?: string; choices?: string[]; other?: string | null };

/** The viewer's language first, Korean as the fallback every question has. */
export function localized(text: LocalizedText, locale: string): string {
  const value = locale === "en" ? text.en : locale === "zh" ? text.zh : null;
  return value && value.trim() ? value : text.ko;
}

/** `PUT /admin/cohorts/:id/questions` element: an omitted `id` is a new question/option. */
export type LocalizedTextInput = { ko: string; en?: string | null; zh?: string | null };
export type CohortQuestionInput = {
  id?: string;
  type: CohortQuestionType;
  label: LocalizedTextInput;
  help: LocalizedTextInput | null;
  required: boolean;
  options: { id?: string; label: LocalizedTextInput; withDetail: boolean }[] | null;
};

export const isCohortApplicationStatus = (value: unknown): value is CohortApplicationStatus => COHORT_APPLICATION_STATUSES.includes(value as CohortApplicationStatus);

/** `GET /cohorts/current` (a JSON `null` when no cohort is open). */
export type PublicCohort = {
  id: string;
  name: string;
  description: string | null;
  opensAt: string | null;
  closesAt: string | null;
  acceptingApplications: boolean;
  questions: CohortQuestion[];
};

/** The four fixed fields every application carries (the review flow, search and contact depend on them). */
export type CohortFixedValues = {
  displayName: string;
  telegram: string;
  twitter: string;
  intro: string;
};

/** The apply/update request body. */
export type CohortApplicationValues = CohortFixedValues & { answers: AnswerInput[] };

/** The answers of an application as read back (the BE synthesizes them for applications sent before the questions were configurable). */
export type CohortApplicationRead = CohortFixedValues & { answers: ApplicationAnswer[] };

/** `GET /cohorts/applications/me` row: no review note, no reviewer (the BE never sends them to the applicant). */
export type MyCohortApplication = CohortApplicationRead & {
  id: string;
  cohortId: string;
  cohort: { id: string; name: string; status: CohortStatus; acceptingApplications: boolean };
  status: CohortApplicationStatus;
  reviewedAt: string | null;
  /** SUBMITTED and the cohort still accepts: the PATCH is allowed. */
  editable: boolean;
  /** SUBMITTED: the withdraw is allowed (also after the cohort closed). */
  withdrawable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCohortCounts = Record<CohortApplicationStatus | "total", number>;

/** `GET /admin/cohorts` row. */
export type AdminCohort = {
  id: string;
  name: string;
  description: string | null;
  status: CohortStatus;
  opensAt: string | null;
  closesAt: string | null;
  acceptingApplications: boolean;
  applicationCounts: AdminCohortCounts;
  /** Next states the BE allows from here (`OPEN` can still answer 409 `COHORT_ALREADY_OPEN`). */
  allowedTransitions: Array<Exclude<CohortStatus, "DRAFT">>;
  questions: CohortQuestion[];
  createdAt: string;
  updatedAt: string;
};

/** Create/edit body: an empty description or window side is `null` (the BE clears the column). */
export type AdminCohortInput = {
  name: string;
  description: string | null;
  opensAt: string | null;
  closesAt: string | null;
};

export type AdminCohortApplication = CohortApplicationRead & {
  id: string;
  cohortId: string;
  status: CohortApplicationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; nickname: string; email: string };
};

export type AdminCohortApplicationFilter = {
  status?: CohortApplicationStatus;
  /** Both or neither: the BE applies the choice filter only when the pair is complete. */
  questionId?: string;
  optionId?: string;
  q?: string;
};

export type AdminCohortApplicationPage = {
  items: AdminCohortApplication[];
  page: number;
  pageSize: number;
  total: number;
};

/** The `GET /admin/cohorts/:id/applications(.csv)` query string; the same filter feeds the table and the export. */
export function cohortApplicationQuery(filter: AdminCohortApplicationFilter, page?: number): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.questionId && filter.optionId) {
    params.set("questionId", filter.questionId);
    params.set("optionId", filter.optionId);
  }
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  if (page !== undefined) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ── Applicant form ────────────────────────────────────────────────────

const TELEGRAM_URL = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.*)$/i;
const TWITTER_URL = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/(.*)$/i;
const TELEGRAM_HANDLE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;
const TWITTER_HANDLE = /^@[A-Za-z0-9_]{1,15}$/;

/**
 * Service paths that are not profiles (first segment, compared lowercased). Must match the BE
 * `RESERVED_PATHS` in `NinjaLabsBE/src/cohorts/cohort-fields.ts`; change both together.
 */
const RESERVED_PATHS: Record<"telegram" | "twitter", ReadonlySet<string>> = {
  telegram: new Set(["joinchat", "share", "addstickers", "addemoji", "addtheme", "addlist", "proxy", "socks", "c", "s", "iv", "login", "setlanguage", "confirmphone", "invoice", "boost", "m", "msg", "msg_url"]),
  twitter: new Set(["i", "intent", "home", "share", "search", "hashtag"]),
};

/**
 * Mirror of BE `normalizeHandle`: `name`, `@name`, `https://t.me/name`, `https://x.com/name?s=20` all become `@name`; blank stays blank.
 * A URL that is not a profile link (invite/share/post: more than one path segment, or a reserved first segment) is returned unchanged,
 * so the handle check fails on it instead of turning `t.me/joinchat/..` into `@joinchat`.
 */
export function normalizeHandle(raw: string, kind: "telegram" | "twitter"): string {
  let value = raw.trim();
  const url = (kind === "telegram" ? TELEGRAM_URL : TWITTER_URL).exec(value);
  if (url) {
    const segments = url[1].split(/[?#]/)[0].split("/").filter((segment) => segment !== "");
    if (segments.length > 1 || (segments.length === 1 && RESERVED_PATHS[kind].has(segments[0].toLowerCase()))) return value;
    value = segments[0] ?? "";
  }
  value = value.replace(/^@+/, "");
  return value === "" ? "" : `@${value}`;
}

/** Code points, like the BE `MaxChars` (Postgres length). */
const length = (value: string) => [...value].length;

/** Bidi embeddings, overrides and isolates: the BE `HasNoBidiOverride` (long text may hold line breaks but not these). */
const BIDI_OVERRIDE = /[‪-‮⁦-⁩]/u;

export type CohortFieldError = "required" | "tooLong" | "invalid";
export type CohortFixedField = keyof CohortFixedValues;
export type CohortFormErrors = Partial<Record<CohortFixedField, CohortFieldError>>;

/** What can be wrong with one answer; `otherRequired` is the "detail" box of an option that asks for one. */
export type CohortAnswerError = CohortFieldError | "otherRequired";
/** Per question id (an id that is not a current question is flagged `invalid`). */
export type CohortAnswerErrors = Record<string, CohortAnswerError>;

/** The form's state for one question: free text, the chosen option ids and the detail text. */
export type CohortDraftAnswer = { text: string; choices: string[]; other: string };
export const emptyDraftAnswer: CohortDraftAnswer = { text: "", choices: [], other: "" };

/** An empty form: nothing typed or chosen yet. */
export type CohortFormDraft = CohortFixedValues & { answers: Record<string, CohortDraftAnswer> };

export const emptyCohortDraft: CohortFormDraft = {
  displayName: "",
  telegram: "",
  twitter: "",
  intro: "",
  answers: {},
};

/** Pre-submit check of the four fixed fields (the mirror of the BE `cohort-fields.ts` rules). The BE stays the judge. */
export function validateCohortDraft(draft: CohortFixedValues): CohortFormErrors {
  const errors: CohortFormErrors = {};
  const name = draft.displayName.trim();
  if (!name || !hasVisibleText(name)) errors.displayName = "required";
  else if (length(name) > COHORT_DISPLAY_NAME_MAX) errors.displayName = "tooLong";

  const telegram = normalizeHandle(draft.telegram, "telegram");
  if (!telegram) errors.telegram = "required";
  else if (!TELEGRAM_HANDLE.test(telegram)) errors.telegram = "invalid";

  const twitter = normalizeHandle(draft.twitter, "twitter");
  if (!twitter) errors.twitter = "required";
  else if (!TWITTER_HANDLE.test(twitter)) errors.twitter = "invalid";

  const intro = draft.intro.trim();
  if (!intro || !hasVisibleText(intro)) errors.intro = "required";
  else if (length(intro) > COHORT_INTRO_MAX) errors.intro = "tooLong";
  return errors;
}

/**
 * Mirror of the BE `validateAnswers(questions, input)`: every id is a current question (no duplicates), text questions take only
 * `text`, choice questions only `choices` (+ `other`); blank text / empty choices are "unanswered" and only an error when the question
 * is required; limits 200 / 2000 / 60 code points; the detail text is needed exactly when a chosen option asks for it.
 * Returns one error per question id (empty object = valid).
 */
export function validateAnswers(questions: readonly CohortQuestion[], answers: readonly AnswerInput[]): CohortAnswerErrors {
  const errors: CohortAnswerErrors = {};
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const given = new Map<string, AnswerInput>();
  for (const answer of answers) {
    if (!byId.has(answer.questionId) || seen.has(answer.questionId)) errors[answer.questionId] = "invalid";
    seen.add(answer.questionId);
    given.set(answer.questionId, answer);
  }
  for (const question of questions) {
    if (errors[question.id]) continue;
    const error = answerError(question, given.get(question.id));
    if (error) errors[question.id] = error;
  }
  return errors;
}

function answerError(question: CohortQuestion, answer: AnswerInput | undefined): CohortAnswerError | null {
  const missing = question.required ? "required" : null;
  if (!isChoiceType(question.type)) {
    if (answer?.choices !== undefined || (answer?.other !== undefined && answer.other !== null)) return "invalid";
    const text = answer?.text?.trim() ?? "";
    if (!text || !hasVisibleText(text)) return missing;
    if (question.type === "SHORT_TEXT") {
      if (length(text) > COHORT_SHORT_TEXT_MAX) return "tooLong";
      return isPlainDisplayText(text) ? null : "invalid";
    }
    if (length(text) > COHORT_LONG_TEXT_MAX) return "tooLong";
    return BIDI_OVERRIDE.test(text) ? "invalid" : null;
  }
  if (answer?.text !== undefined) return "invalid";
  const choices = answer?.choices ?? [];
  if (choices.length === 0) return missing;
  if (new Set(choices).size !== choices.length) return "invalid";
  const options = question.options ?? [];
  if (choices.some((id) => !options.some((option) => option.id === id))) return "invalid";
  if (question.type === "SINGLE_CHOICE" && choices.length !== 1) return "invalid";
  if (options.some((option) => option.withDetail && choices.includes(option.id))) {
    const other = answer?.other?.trim() ?? "";
    if (!other || !hasVisibleText(other)) return "otherRequired";
    if (length(other) > COHORT_OTHER_DETAIL_MAX) return "tooLong";
    return isPlainDisplayText(other) ? null : "invalid";
  }
  return null;
}

/** Whether the question is a text type with a hard length limit, and which one. */
export const answerTextLimit = (type: CohortQuestionType): number => (type === "SHORT_TEXT" ? COHORT_SHORT_TEXT_MAX : COHORT_LONG_TEXT_MAX);

/**
 * The request body for a draft, in question order: trimmed text, handles normalized. Unanswered questions are left out; choices of an
 * option that no longer exists and an unused "other" detail are dropped (the BE drops the detail too).
 */
export function draftToValues(draft: CohortFormDraft, questions: readonly CohortQuestion[]): CohortApplicationValues {
  const answers: AnswerInput[] = [];
  for (const question of questions) {
    const value = draft.answers[question.id];
    if (!value) continue;
    if (!isChoiceType(question.type)) {
      const text = value.text.trim();
      if (text) answers.push({ questionId: question.id, text });
      continue;
    }
    const options = question.options ?? [];
    const choices = options.filter((option) => value.choices.includes(option.id));
    if (choices.length === 0) continue;
    const asksDetail = choices.some((option) => option.withDetail);
    const other = value.other.trim();
    answers.push({ questionId: question.id, choices: choices.map((option) => option.id), ...(asksDetail ? { other: other || null } : {}) });
  }
  return {
    displayName: draft.displayName.trim(),
    telegram: normalizeHandle(draft.telegram, "telegram"),
    twitter: normalizeHandle(draft.twitter, "twitter"),
    intro: draft.intro.trim(),
    answers,
  };
}

/**
 * An application's saved answers back into form state, keyed by question id. Nothing is filtered here: the form only renders the
 * cohort's current questions and `draftToValues` only sends answers to those (and to options that still exist), so an answer whose
 * question is gone is neither shown nor sent again, and the questions may arrive after the form mounted.
 */
export function applicationToDraft(application: CohortApplicationRead): CohortFormDraft {
  const answers: Record<string, CohortDraftAnswer> = {};
  for (const answer of application.answers) {
    answers[answer.questionId] = { text: answer.text ?? "", choices: (answer.choices ?? []).map((choice) => choice.id), other: answer.other ?? "" };
  }
  return { displayName: application.displayName, telegram: application.telegram, twitter: application.twitter, intro: application.intro, answers };
}

/**
 * Index of the chosen option the "other" detail belongs to, or -1 when there is no detail. A snapshot does not say which option asked
 * for it, so the cohort's current question decides (the chosen option that has `withDetail`). Only an answer whose question is gone
 * falls back to a guess: the option whose id mentions "other" (the default question's `OTHER`), else the last one.
 */
export function detailChoiceIndex(answer: ApplicationAnswer, question?: CohortQuestion | null): number {
  const choices = answer.choices ?? [];
  if (!answer.other || choices.length === 0) return -1;
  const asked = question?.options ? choices.findIndex((choice) => question.options?.some((option) => option.id === choice.id && option.withDetail)) : -1;
  if (asked !== -1) return asked;
  const named = choices.findIndex((choice) => /other/i.test(choice.id));
  return named === -1 ? choices.length - 1 : named;
}

/** One answer for display in the viewer's language: text as typed, choices joined by ", ", the "other" detail after the option that asked for it (`detailChoiceIndex`). */
export function answerDisplay(answer: ApplicationAnswer, locale: string, question?: CohortQuestion | null): string {
  if (answer.text !== null && answer.text !== undefined) return answer.text;
  const detailAt = detailChoiceIndex(answer, question);
  return (answer.choices ?? []).map((choice, index) => (index === detailAt ? `${localized(choice.label, locale)} (${answer.other})` : localized(choice.label, locale))).join(", ");
}

// ── Question editor (admin) ───────────────────────────────────────────

/** What is wrong with the question list the operator is about to save; `index`/`optionIndex` point into the list (`-1` = the list itself). */
export type QuestionIssueCode =
  | "tooManyQuestions"
  | "labelRequired" | "labelTooLong" | "labelInvalid"
  | "helpKoRequired" | "helpTooLong" | "helpInvalid"
  | "optionsCount" | "withDetailMax"
  | "optionLabelRequired" | "optionLabelTooLong" | "optionLabelInvalid";
export type QuestionIssue = { code: QuestionIssueCode; index: number; optionIndex?: number };

function labelIssue(text: LocalizedTextInput, max: number, required: QuestionIssueCode, tooLong: QuestionIssueCode, invalid: QuestionIssueCode): QuestionIssueCode | null {
  const ko = text.ko.trim();
  if (!ko || !hasVisibleText(ko)) return required;
  for (const value of [ko, text.en?.trim() ?? "", text.zh?.trim() ?? ""]) {
    if (length(value) > max) return tooLong;
    if (value && !isPlainDisplayText(value)) return invalid;
  }
  return null;
}

/**
 * Mirror of the BE rules for `PUT /admin/cohorts/:id/questions` that need no stored list (0..30 questions, label 1..200, help up to 500,
 * choice questions 2..20 options with a label up to 60, at most one `withDetail`). Unknown/duplicate ids stay the BE's call
 * (400 `COHORT_QUESTIONS_INVALID`).
 */
export function validateQuestionInputs(questions: readonly CohortQuestionInput[]): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  if (questions.length > COHORT_QUESTIONS_MAX) issues.push({ code: "tooManyQuestions", index: -1 });
  questions.forEach((question, index) => {
    const label = labelIssue(question.label, COHORT_QUESTION_LABEL_MAX, "labelRequired", "labelTooLong", "labelInvalid");
    if (label) issues.push({ code: label, index });
    if (question.help) {
      if (!question.help.ko.trim()) issues.push({ code: "helpKoRequired", index });
      for (const value of [question.help.ko, question.help.en ?? "", question.help.zh ?? ""]) {
        if (length(value.trim()) > COHORT_HELP_MAX) issues.push({ code: "helpTooLong", index });
        else if (BIDI_OVERRIDE.test(value)) issues.push({ code: "helpInvalid", index });
      }
    }
    if (!isChoiceType(question.type)) return;
    const options = question.options ?? [];
    if (options.length < COHORT_OPTIONS_MIN || options.length > COHORT_OPTIONS_MAX) issues.push({ code: "optionsCount", index });
    if (options.filter((option) => option.withDetail).length > 1) issues.push({ code: "withDetailMax", index });
    options.forEach((option, optionIndex) => {
      const issue = labelIssue(option.label, COHORT_OPTION_LABEL_MAX, "optionLabelRequired", "optionLabelTooLong", "optionLabelInvalid");
      if (issue) issues.push({ code: issue, index, optionIndex });
    });
  });
  return issues;
}

/**
 * "Have I applied to this cohort?": my application to `cohortId` unless I withdrew it. Single source for the hub CTA, the
 * recruitment banner, the home card and `/recruit`. The BE keeps one row per user and cohort (`uq_cohort_application_user`),
 * so a withdrawn row means "not applied" and nothing else can be found.
 */
export function activeCohortApplication(mine: readonly MyCohortApplication[] | null | undefined, cohortId: string): MyCohortApplication | undefined {
  return mine?.find((item) => item.cohortId === cohortId && item.status !== "WITHDRAWN");
}

/**
 * Whether the apply form is the right thing to show for the cohort and the viewer's own application.
 * `form`: no (or a withdrawn) application and the cohort accepts. `not-accepting`: no usable application and it does not. The rest follow the application.
 */
export type CohortApplyView =
  | { kind: "form"; reapply: boolean }
  | { kind: "not-accepting" }
  | { kind: "submitted"; application: MyCohortApplication }
  | { kind: "accepted"; application: MyCohortApplication }
  | { kind: "rejected"; application: MyCohortApplication };

export function resolveCohortApplyView(cohort: PublicCohort, mine: readonly MyCohortApplication[]): CohortApplyView {
  const application = activeCohortApplication(mine, cohort.id);
  if (!application) {
    // A withdrawn row is the only other row the BE can hold for this cohort: applying again is a re-application.
    const reapply = mine.some((item) => item.cohortId === cohort.id);
    return cohort.acceptingApplications ? { kind: "form", reapply } : { kind: "not-accepting" };
  }
  if (application.status === "ACCEPTED") return { kind: "accepted", application };
  if (application.status === "REJECTED") return { kind: "rejected", application };
  return { kind: "submitted", application };
}

/** How to describe an open cohort: `open` accepts applications, `upcoming` has an opening time in the future, `closed` is past its window. */
export function cohortPhase(cohort: Pick<PublicCohort, "acceptingApplications" | "opensAt">, now: number = Date.now()): "open" | "upcoming" | "closed" {
  if (cohort.acceptingApplications) return "open";
  return cohort.opensAt !== null && Date.parse(cohort.opensAt) > now ? "upcoming" : "closed";
}
