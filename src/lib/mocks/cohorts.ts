import type { AdminCohortApi, CohortApi } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { MockApiError } from "@/lib/mocks/mock-error";
import {
  isChoiceType,
  validateAnswers,
  validateQuestionInputs,
  type AdminCohort,
  type AdminCohortApplication,
  type AdminCohortApplicationFilter,
  type AdminCohortCounts,
  type AnswerInput,
  type ApplicationAnswer,
  type CohortQuestion,
  type CohortQuestionInput,
  type CohortStatus,
  type LocalizedText,
  type MyCohortApplication,
  type PublicCohort,
} from "@/lib/cohorts";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 30;

type StoredApplication = AdminCohortApplication & { ownerId: string };

const text = (ko: string, en: string, zh: string): LocalizedText => ({ ko, en, zh });
const option = (id: string, ko: string, en: string, zh: string, withDetail = false) => ({ id, label: text(ko, en, zh), withDetail });

/** The questions a new cohort starts with (BE `DEFAULT_COHORT_QUESTIONS`; ids equal the old column names / enum codes). */
export const DEFAULT_COHORT_QUESTIONS: CohortQuestion[] = [
  {
    id: "web3_experience", type: "SINGLE_CHOICE", required: true, label: text("Web3 경력", "Web3 experience", "Web3 经验"), help: null,
    options: [option("LT_1Y", "1년 미만", "Under 1 year", "不足 1 年"), option("Y1_3", "1~3년", "1-3 years", "1-3 年"), option("GT_3Y", "3년 이상", "Over 3 years", "3 年以上")],
  },
  {
    id: "interest_areas", type: "MULTI_CHOICE", required: true, label: text("참여하고 싶은 분야", "Areas you want to join", "想参与的领域"),
    help: text("해당하는 분야를 모두 골라 주세요.", "Choose all that apply.", "可多选。"),
    options: [
      option("DEVELOPER", "개발자", "Developer", "开发者"),
      option("CONTENT_CREATOR", "콘텐츠 크리에이터", "Content creator", "内容创作者"),
      option("KOL", "KOL(인플루언서)", "KOL (influencer)", "KOL（意见领袖）"),
      option("COMMUNITY_MARKETING", "커뮤니티·마케팅", "Community / marketing", "社区 / 营销"),
      option("RESEARCHER", "리서처", "Researcher", "研究员"),
      option("BIZDEV", "사업개발", "Business development", "商务拓展"),
      option("OTHER", "기타", "Other", "其他", true),
    ],
  },
];

type SampleAnswers = { web3?: string; areas?: string[]; other?: string };

/** The answers of a default-shaped application, as the BE snapshots them (labels copied from the question). */
function sampleAnswers({ web3 = "Y1_3", areas = ["DEVELOPER", "RESEARCHER"], other }: SampleAnswers = {}): ApplicationAnswer[] {
  const [experience, interests] = DEFAULT_COHORT_QUESTIONS;
  const choice = (question: CohortQuestion, id: string) => ({ id, label: question.options!.find((item) => item.id === id)!.label });
  return [
    { questionId: experience.id, type: experience.type, label: experience.label, text: null, choices: [choice(experience, web3)], other: null },
    { questionId: interests.id, type: interests.type, label: interests.label, text: null, choices: areas.map((id) => choice(interests, id)), other: other ?? null },
  ];
}

type SampleFields = Partial<Pick<AdminCohortApplication, "displayName" | "telegram" | "twitter" | "intro" | "answers">>;

const sampleValues = (overrides: SampleFields) => ({
  displayName: "Mina",
  telegram: "@mina_builds",
  twitter: "@mina_builds",
  intro: "Smart contract developer who wants to ship tools for Injective builders.",
  answers: sampleAnswers(),
  ...overrides,
});

const accepting = (cohort: { status: CohortStatus; opensAt: string | null; closesAt: string | null }, now = Date.now()): boolean =>
  cohort.status === "OPEN" &&
  (cohort.opensAt === null || Date.parse(cohort.opensAt) <= now) &&
  (cohort.closesAt === null || Date.parse(cohort.closesAt) >= now);

const TRANSITIONS: Record<CohortStatus, Array<"OPEN" | "CLOSED">> = { DRAFT: ["OPEN"], OPEN: ["CLOSED"], CLOSED: ["OPEN"] };

/**
 * The BE `validateAnswers` + snapshot: a body that does not fit the cohort's current questions is `400 COHORT_ANSWERS_INVALID`
 * (a missing "other" detail keeps its own code), otherwise the answers are copied with their labels, in question order.
 */
function snapshotAnswers(questions: readonly CohortQuestion[], input: readonly AnswerInput[]): ApplicationAnswer[] {
  const errors = validateAnswers(questions, input);
  if (Object.values(errors).includes("otherRequired")) throw new MockApiError(400, "COHORT_OTHER_DETAIL_REQUIRED");
  if (Object.keys(errors).length > 0) throw new MockApiError(400, "COHORT_ANSWERS_INVALID");
  const answers: ApplicationAnswer[] = [];
  for (const question of questions) {
    const given = input.find((item) => item.questionId === question.id);
    if (!given) continue;
    if (!isChoiceType(question.type)) {
      const value = given.text?.trim();
      if (value) answers.push({ questionId: question.id, type: question.type, label: question.label, text: value, choices: null, other: null });
      continue;
    }
    const chosen = (question.options ?? []).filter((item) => given.choices?.includes(item.id));
    if (chosen.length === 0) continue;
    const other = chosen.some((item) => item.withDetail) ? given.other?.trim() || null : null;
    answers.push({ questionId: question.id, type: question.type, label: question.label, text: null, choices: chosen.map((item) => ({ id: item.id, label: item.label })), other });
  }
  return answers;
}

const randomId = (prefix: string, length: number) => `${prefix}${Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

/** The BE rules for `PUT /admin/cohorts/:id/questions` against the stored list: shape limits, only known ids, no duplicates; new ids are generated. */
function applyQuestionInputs(stored: readonly CohortQuestion[], inputs: readonly CohortQuestionInput[]): CohortQuestion[] {
  if (validateQuestionInputs(inputs).length > 0) throw new MockApiError(400, "COHORT_QUESTIONS_INVALID");
  const seenQuestions = new Set<string>();
  const label = (value: { ko: string; en?: string | null; zh?: string | null }): LocalizedText => ({ ko: value.ko.trim(), en: value.en?.trim() || null, zh: value.zh?.trim() || null });
  return inputs.map((input) => {
    const before = input.id === undefined ? null : stored.find((question) => question.id === input.id);
    if (input.id !== undefined && (!before || seenQuestions.has(input.id))) throw new MockApiError(400, "COHORT_QUESTIONS_INVALID");
    if (input.id !== undefined) seenQuestions.add(input.id);
    const seenOptions = new Set<string>();
    const options = isChoiceType(input.type)
      ? (input.options ?? []).map((item) => {
          if (item.id !== undefined && (!before?.options?.some((known) => known.id === item.id) || seenOptions.has(item.id))) throw new MockApiError(400, "COHORT_QUESTIONS_INVALID");
          if (item.id !== undefined) seenOptions.add(item.id);
          return { id: item.id ?? randomId("o_", 8), label: label(item.label), withDetail: item.withDetail === true };
        })
      : null;
    return { id: input.id ?? randomId("q_", 12), type: input.type, label: label(input.label), help: input.help && input.help.ko.trim() ? label(input.help) : null, required: input.required, options };
  });
}

const csvCell = (value: string): string => {
  const guarded = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
};

/**
 * Cohort recruitment twin of the BE (`NinjaLabsBE/src/cohorts`): one in-memory store behind both the applicant API and the
 * admin API, with the BE's rules (single OPEN cohort, accepting window, one application per user and cohort that a withdrawal
 * reopens, review notes never shown to the applicant, delete refused once any application exists). Resets on reload.
 */
export function createMockCohortApis(options: { nextId: (prefix: string) => string; isOwner: (auth: AuthSnapshot) => boolean; ownerId: string }) {
  const { nextId, isOwner, ownerId } = options;
  const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString();
  let cohorts: Array<Omit<AdminCohort, "applicationCounts" | "allowedTransitions" | "acceptingApplications">> = [
    { id: "cohort-2", name: "Ninja Labs 2nd cohort", description: "Ninja Labs builds on Injective together: developers, marketers, researchers and creators.\n\nApplications are reviewed by the operators; accepted members are added to the member list separately.", status: "OPEN", questions: structuredClone(DEFAULT_COHORT_QUESTIONS), opensAt: iso(-7), closesAt: iso(21), createdAt: iso(-10), updatedAt: iso(-7) },
    { id: "cohort-1", name: "Ninja Labs 1st cohort", description: null, status: "CLOSED", questions: structuredClone(DEFAULT_COHORT_QUESTIONS), opensAt: iso(-200), closesAt: iso(-150), createdAt: iso(-210), updatedAt: iso(-150) },
  ];
  const applicant = (id: string, nickname: string, status: StoredApplication["status"], values: SampleFields, daysAgo: number): StoredApplication => ({
    ...sampleValues(values), id, cohortId: "cohort-2", status, reviewNote: status === "ACCEPTED" ? "Strong portfolio." : null,
    reviewedAt: status === "SUBMITTED" ? null : iso(-1), createdAt: iso(-daysAgo), updatedAt: iso(-daysAgo),
    user: { id: `user-${nickname}`, nickname, email: `${nickname}@example.com` }, ownerId: `user-${nickname}`,
  });
  let applications: StoredApplication[] = [
    applicant("capp-1", "mina", "SUBMITTED", {}, 3),
    applicant("capp-2", "joon", "ACCEPTED", { displayName: "Joon", answers: sampleAnswers({ areas: ["CONTENT_CREATOR", "KOL"] }), telegram: "@joon_writes", twitter: "@joon_writes" }, 5),
    applicant("capp-3", "sora", "REJECTED", { displayName: "Sora", telegram: "@sora_study", twitter: "@sora_study", answers: sampleAnswers({ web3: "LT_1Y", areas: ["DEVELOPER"] }), intro: "Computer science student learning Solidity and CosmWasm." }, 6),
    applicant("capp-4", "haru", "WITHDRAWN", { displayName: "Haru", telegram: "@haru_ux", twitter: "@haru_ux", answers: sampleAnswers({ areas: ["OTHER"], other: "UX research" }) }, 8),
  ];
  const find = (id: string) => cohorts.find((cohort) => cohort.id === id);
  const requireCohort = (id: string) => {
    const cohort = find(id);
    if (!cohort) throw new MockApiError(404, "COHORT_NOT_FOUND");
    return cohort;
  };
  const counts = (cohortId: string): AdminCohortCounts => {
    const result = { SUBMITTED: 0, ACCEPTED: 0, REJECTED: 0, WITHDRAWN: 0, total: 0 } satisfies AdminCohortCounts;
    for (const application of applications) {
      if (application.cohortId !== cohortId) continue;
      result[application.status] += 1;
      result.total += 1;
    }
    return result;
  };
  const adminView = (cohort: (typeof cohorts)[number]): AdminCohort => ({
    ...cohort,
    acceptingApplications: accepting(cohort),
    applicationCounts: counts(cohort.id),
    allowedTransitions: [...TRANSITIONS[cohort.status]],
  });
  const myView = (application: StoredApplication): MyCohortApplication => {
    const cohort = requireCohort(application.cohortId);
    const { reviewNote: _note, user: _user, ownerId: _owner, ...fields } = application;
    void _note; void _user; void _owner;
    const open = application.status === "SUBMITTED";
    return {
      ...fields,
      status: application.status,
      cohort: { id: cohort.id, name: cohort.name, status: cohort.status, acceptingApplications: accepting(cohort) },
      editable: open && accepting(cohort),
      withdrawable: open,
    };
  };
  const mine = (id: string) => {
    const found = applications.find((application) => application.id === id && application.ownerId === ownerId);
    if (!found) throw new MockApiError(404, "COHORT_APPLICATION_NOT_FOUND");
    return found;
  };
  const replace = (next: StoredApplication) => {
    applications = applications.map((application) => (application.id === next.id ? next : application));
    return next;
  };
  const filtered = (cohortId: string, filter: AdminCohortApplicationFilter): AdminCohortApplication[] => {
    requireCohort(cohortId);
    const needle = filter.q?.trim().toLowerCase();
    return applications
      .filter((application) => application.cohortId === cohortId)
      .filter((application) => !filter.status || application.status === filter.status)
      .filter((application) => !filter.questionId || !filter.optionId || application.answers.some((answer) => answer.questionId === filter.questionId && answer.choices?.some((choice) => choice.id === filter.optionId)))
      .filter((application) => !needle || [application.displayName, application.telegram, application.twitter, application.user.nickname, application.user.email].some((field) => field.toLowerCase().includes(needle)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(({ ownerId: _owner, ...rest }) => (void _owner, rest));
  };

  const applicantApi: CohortApi = {
    getCurrentCohort: async () => {
      const open = cohorts.find((cohort) => cohort.status === "OPEN");
      if (!open) return null;
      const current: PublicCohort = { id: open.id, name: open.name, description: open.description, opensAt: open.opensAt, closesAt: open.closesAt, acceptingApplications: accepting(open), questions: structuredClone(open.questions) };
      return current;
    },
    getMyCohortApplications: async (auth) => ({ status: "available", data: isOwner(auth) ? applications.filter((item) => item.ownerId === ownerId).map(myView).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [] }),
    applyToCohort: async (cohortId, input) => {
      const cohort = find(cohortId);
      if (!cohort || cohort.status === "DRAFT") throw new MockApiError(404, "COHORT_NOT_FOUND");
      if (!accepting(cohort)) throw new MockApiError(409, "COHORT_NOT_ACCEPTING");
      const existing = applications.find((item) => item.cohortId === cohortId && item.ownerId === ownerId);
      if (existing && existing.status !== "WITHDRAWN") throw new MockApiError(409, "COHORT_ALREADY_APPLIED");
      const values = { displayName: input.displayName, telegram: input.telegram, twitter: input.twitter, intro: input.intro, answers: snapshotAnswers(cohort.questions, input.answers) };
      const now = new Date().toISOString();
      if (existing) return myView(replace({ ...existing, ...values, status: "SUBMITTED", reviewNote: null, reviewedAt: null, createdAt: now, updatedAt: now }));
      const created: StoredApplication = { ...values, id: nextId("preview-cohort-application"), cohortId, status: "SUBMITTED", reviewNote: null, reviewedAt: null, createdAt: now, updatedAt: now, user: { id: ownerId, nickname: "preview", email: "preview@example.com" }, ownerId };
      applications = [created, ...applications];
      return myView(created);
    },
    updateCohortApplication: async (applicationId, input) => {
      const current = mine(applicationId);
      if (current.status !== "SUBMITTED") throw new MockApiError(409, "COHORT_APPLICATION_NOT_SUBMITTED");
      const cohort = requireCohort(current.cohortId);
      if (!accepting(cohort)) throw new MockApiError(409, "COHORT_NOT_ACCEPTING");
      const values = { displayName: input.displayName, telegram: input.telegram, twitter: input.twitter, intro: input.intro, answers: snapshotAnswers(cohort.questions, input.answers) };
      return myView(replace({ ...current, ...values, updatedAt: new Date().toISOString() }));
    },
    withdrawCohortApplication: async (applicationId) => {
      const current = mine(applicationId);
      if (current.status !== "SUBMITTED") throw new MockApiError(409, "COHORT_APPLICATION_NOT_SUBMITTED");
      replace({ ...current, status: "WITHDRAWN", updatedAt: new Date().toISOString() });
    },
  };

  const adminApi: AdminCohortApi = {
    getAdminCohorts: async () => [...cohorts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(adminView),
    saveAdminCohort: async (cohortId, input) => {
      if (input.opensAt && input.closesAt && Date.parse(input.closesAt) <= Date.parse(input.opensAt)) throw new MockApiError(400, "COHORT_INVALID_WINDOW");
      const now = new Date().toISOString();
      if (!cohortId) {
        const created = { id: nextId("preview-cohort"), ...input, questions: structuredClone(DEFAULT_COHORT_QUESTIONS), status: "DRAFT" as const, createdAt: now, updatedAt: now };
        cohorts = [created, ...cohorts];
        return adminView(created);
      }
      const current = requireCohort(cohortId);
      const next = { ...current, ...input, updatedAt: now };
      cohorts = cohorts.map((cohort) => (cohort.id === cohortId ? next : cohort));
      return adminView(next);
    },
    saveAdminCohortQuestions: async (cohortId, inputs) => {
      const current = requireCohort(cohortId);
      const next = { ...current, questions: applyQuestionInputs(current.questions, inputs), updatedAt: new Date().toISOString() };
      cohorts = cohorts.map((cohort) => (cohort.id === cohortId ? next : cohort));
      return adminView(next);
    },
    transitionAdminCohort: async (cohortId, to) => {
      const current = requireCohort(cohortId);
      if (!TRANSITIONS[current.status].includes(to)) throw new MockApiError(400, "COHORT_INVALID_TRANSITION");
      if (to === "OPEN" && cohorts.some((cohort) => cohort.status === "OPEN" && cohort.id !== cohortId)) throw new MockApiError(409, "COHORT_ALREADY_OPEN");
      const next = { ...current, status: to, updatedAt: new Date().toISOString() };
      cohorts = cohorts.map((cohort) => (cohort.id === cohortId ? next : cohort));
      return adminView(next);
    },
    deleteAdminCohort: async (cohortId) => {
      requireCohort(cohortId);
      if (applications.some((application) => application.cohortId === cohortId)) throw new MockApiError(409, "COHORT_HAS_APPLICATIONS");
      cohorts = cohorts.filter((cohort) => cohort.id !== cohortId);
    },
    getAdminCohortApplications: async (cohortId, filter, page) => {
      const all = filtered(cohortId, filter);
      return { items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pageSize: PAGE_SIZE, total: all.length };
    },
    reviewAdminCohortApplication: async (applicationId, { decision, note }) => {
      const current = applications.find((application) => application.id === applicationId);
      if (!current) throw new MockApiError(404, "COHORT_APPLICATION_NOT_FOUND");
      if (current.status === "WITHDRAWN") throw new MockApiError(409, "COHORT_APPLICATION_WITHDRAWN");
      const { ownerId: _owner, ...view } = replace({ ...current, status: decision, reviewNote: note?.trim() || null, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      void _owner;
      return view;
    },
    exportAdminCohortApplications: async (cohortId, filter) => {
      const questions = requireCohort(cohortId).questions;
      const header = ["id", "applied_at", "status", "display_name", "nickname", "email", "telegram", "twitter", "intro", ...questions.map((question) => question.label.ko), "other_answers", "review_note", "reviewed_at"];
      const cell = (answer: ApplicationAnswer | undefined) =>
        answer ? (answer.text ?? (answer.choices ?? []).map((choice) => (answer.other && /other/i.test(choice.id) ? `${choice.label.ko} (${answer.other})` : choice.label.ko)).join(";")) : "";
      const rows = filtered(cohortId, filter).map((a) => [
        a.id, a.createdAt, a.status, a.displayName, a.user.nickname, a.user.email, a.telegram.replace(/^@/, ""), a.twitter.replace(/^@/, ""), a.intro,
        ...questions.map((question) => cell(a.answers.find((answer) => answer.questionId === question.id))),
        a.answers.filter((answer) => !questions.some((question) => question.id === answer.questionId)).map((answer) => `${answer.label.ko}: ${cell(answer)}`).join("\n"),
        a.reviewNote ?? "", a.reviewedAt ?? "",
      ]);
      return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    },
  };

  return { applicantApi, adminApi };
}
