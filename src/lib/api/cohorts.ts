import type { AdminCohortApi, ApiResult, CohortApi } from "@/lib/contracts/api";
import type { ApiHttp } from "@/lib/api/http";
import { unavailableReason } from "@/lib/api/unavailable";
import {
  COHORT_APPLICATION_STATUSES,
  COHORT_QUESTION_TYPES,
  COHORT_STATUSES,
  cohortApplicationQuery,
  isChoiceType,
  type AdminCohort,
  type AdminCohortApplication,
  type AdminCohortCounts,
  type ApplicationAnswer,
  type CohortApplicationRead,
  type CohortApplicationStatus,
  type CohortApplicationValues,
  type CohortQuestion,
  type CohortQuestionOption,
  type CohortQuestionType,
  type CohortStatus,
  type LocalizedText,
  type MyCohortApplication,
  type PublicCohort,
} from "@/lib/cohorts";

// ── BE rows (camelCase, ISO dates; docs/api-contract.md "기수 모집") ──

type ApplicationFieldsRow = {
  id: string;
  cohortId: string;
  status: string;
  displayName: string;
  telegram: string;
  twitter: string;
  intro: string;
  /** Absent from a BE older than the configurable questions. */
  answers?: unknown;
  createdAt: string;
  updatedAt: string;
};

type MyApplicationRow = ApplicationFieldsRow & {
  cohort: { id: string; name: string; status: string; acceptingApplications: boolean };
  reviewedAt: string | null;
  editable: boolean;
  withdrawable: boolean;
};

type AdminApplicationRow = ApplicationFieldsRow & {
  reviewNote: string | null;
  reviewedAt: string | null;
  user: { id: string; nickname: string; email: string };
};

type AdminCohortRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  acceptingApplications: boolean;
  applicationCounts: Partial<Record<string, number>>;
  allowedTransitions: string[];
  questions?: unknown;
  createdAt: string;
  updatedAt: string;
};

// A value outside the known sets (a newer BE) keeps its safest reading instead of failing the whole list:
// an unknown application status reads as SUBMITTED-less "WITHDRAWN" (no action offered), an unknown cohort status as CLOSED.
const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const optionalText = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

function toLocalized(value: unknown): LocalizedText | null {
  if (!isRecord(value) || typeof value.ko !== "string") return null;
  return { ko: value.ko, en: optionalText(value.en), zh: optionalText(value.zh) };
}

function toOption(value: unknown): CohortQuestionOption | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const label = toLocalized(value.label);
  return label ? { id: value.id, label, withDetail: value.withDetail === true } : null;
}

/** A question of a type this client does not know (a newer BE) is skipped instead of breaking the whole form. Missing list -> `[]`. */
export function parseQuestions(raw: unknown): CohortQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: CohortQuestion[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (!COHORT_QUESTION_TYPES.includes(item.type as CohortQuestionType)) continue;
    const type = item.type as CohortQuestionType;
    const label = toLocalized(item.label);
    if (!label) continue;
    const options = isChoiceType(type) && Array.isArray(item.options) ? item.options.map(toOption).filter((option): option is CohortQuestionOption => option !== null) : null;
    if (isChoiceType(type) && (!options || options.length === 0)) continue;
    questions.push({ id: item.id, type, label, help: toLocalized(item.help), required: item.required === true, options });
  }
  return questions;
}

export function parseAnswers(raw: unknown): ApplicationAnswer[] {
  if (!Array.isArray(raw)) return [];
  const answers: ApplicationAnswer[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.questionId !== "string") continue;
    if (!COHORT_QUESTION_TYPES.includes(item.type as CohortQuestionType)) continue;
    const label = toLocalized(item.label);
    if (!label) continue;
    const choices = Array.isArray(item.choices)
      ? item.choices.flatMap((choice) => {
          const choiceLabel = isRecord(choice) ? toLocalized(choice.label) : null;
          return isRecord(choice) && typeof choice.id === "string" && choiceLabel ? [{ id: choice.id, label: choiceLabel }] : [];
        })
      : null;
    answers.push({ questionId: item.questionId, type: item.type as CohortQuestionType, label, text: typeof item.text === "string" ? item.text : null, choices, other: optionalText(item.other) });
  }
  return answers;
}

function toValues(row: ApplicationFieldsRow): CohortApplicationRead {
  return { displayName: row.displayName, telegram: row.telegram, twitter: row.twitter, intro: row.intro, answers: parseAnswers(row.answers) };
}

export function toMyCohortApplication(row: MyApplicationRow): MyCohortApplication {
  return {
    ...toValues(row),
    id: row.id,
    cohortId: row.cohortId,
    cohort: {
      id: row.cohort.id,
      name: row.cohort.name,
      status: pick<CohortStatus>(COHORT_STATUSES, row.cohort.status, "CLOSED"),
      acceptingApplications: row.cohort.acceptingApplications === true,
    },
    status: pick<CohortApplicationStatus>(COHORT_APPLICATION_STATUSES, row.status, "WITHDRAWN"),
    reviewedAt: row.reviewedAt ?? null,
    editable: row.editable === true,
    withdrawable: row.withdrawable === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPublicCohort(row: (Omit<PublicCohort, "questions"> & { questions?: unknown }) | null | undefined): PublicCohort | null {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    opensAt: row.opensAt ?? null,
    closesAt: row.closesAt ?? null,
    acceptingApplications: row.acceptingApplications === true,
    questions: parseQuestions(row.questions),
  };
}

export function toAdminCohort(row: AdminCohortRow): AdminCohort {
  const counts = Object.fromEntries([...COHORT_APPLICATION_STATUSES, "total" as const].map((key) => [key, Number(row.applicationCounts?.[key]) || 0])) as AdminCohortCounts;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: pick<CohortStatus>(COHORT_STATUSES, row.status, "CLOSED"),
    opensAt: row.opensAt ?? null,
    closesAt: row.closesAt ?? null,
    acceptingApplications: row.acceptingApplications === true,
    applicationCounts: counts,
    allowedTransitions: (row.allowedTransitions ?? []).filter((to): to is "OPEN" | "CLOSED" => to === "OPEN" || to === "CLOSED"),
    questions: parseQuestions(row.questions),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAdminCohortApplication(row: AdminApplicationRow): AdminCohortApplication {
  return {
    ...toValues(row),
    id: row.id,
    cohortId: row.cohortId,
    status: pick<CohortApplicationStatus>(COHORT_APPLICATION_STATUSES, row.status, "WITHDRAWN"),
    reviewNote: row.reviewNote ?? null,
    reviewedAt: row.reviewedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user,
  };
}

/** The CONTRACT A5 body: the four fixed fields and the answers (no legacy fields: the BE rejects the two shapes mixed). */
const body = (values: CohortApplicationValues) => ({ displayName: values.displayName, telegram: values.telegram, twitter: values.twitter, intro: values.intro, answers: values.answers });

export function createCohortApi(http: ApiHttp): CohortApi {
  return {
    getCurrentCohort: async () => toPublicCohort(await http.fetchJson<Parameters<typeof toPublicCohort>[0]>("/cohorts/current")),

    getMyCohortApplications: async (auth): Promise<ApiResult<readonly MyCohortApplication[]>> => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await http.fetchJson<MyApplicationRow[]>("/cohorts/applications/me");
        return { status: "available", data: rows.map(toMyCohortApplication) };
      } catch (error) {
        return { status: "unavailable", reason: unavailableReason(error) };
      }
    },

    applyToCohort: async (cohortId, values) =>
      toMyCohortApplication(await http.fetchJson<MyApplicationRow>(`/cohorts/${encodeURIComponent(cohortId)}/applications`, { method: "POST", body: body(values) })),

    updateCohortApplication: async (applicationId, values) =>
      toMyCohortApplication(await http.fetchJson<MyApplicationRow>(`/cohorts/applications/${encodeURIComponent(applicationId)}`, { method: "PATCH", body: body(values) })),

    withdrawCohortApplication: async (applicationId) => {
      await http.fetchJson(`/cohorts/applications/${encodeURIComponent(applicationId)}/withdraw`, { method: "POST" });
    },
  };
}

export function createAdminCohortApi(http: ApiHttp): AdminCohortApi {
  return {
    getAdminCohorts: async () => (await http.fetchJson<AdminCohortRow[]>("/admin/cohorts")).map(toAdminCohort),

    saveAdminCohort: async (cohortId, input) =>
      toAdminCohort(await http.fetchJson<AdminCohortRow>(cohortId ? `/admin/cohorts/${encodeURIComponent(cohortId)}` : "/admin/cohorts", {
        method: cohortId ? "PATCH" : "POST",
        // Cleared optional fields go as null: an omitted key would keep the old value on PATCH.
        body: { name: input.name, description: input.description, opensAt: input.opensAt, closesAt: input.closesAt },
      })),

    transitionAdminCohort: async (cohortId, to) =>
      toAdminCohort(await http.fetchJson<AdminCohortRow>(`/admin/cohorts/${encodeURIComponent(cohortId)}/transition`, { method: "POST", body: { to } })),

    saveAdminCohortQuestions: async (cohortId, questions) =>
      toAdminCohort(await http.fetchJson<AdminCohortRow>(`/admin/cohorts/${encodeURIComponent(cohortId)}/questions`, { method: "PUT", body: { questions } })),

    deleteAdminCohort: async (cohortId) => {
      await http.fetchJson(`/admin/cohorts/${encodeURIComponent(cohortId)}`, { method: "DELETE" });
    },

    getAdminCohortApplications: async (cohortId, filter, page) => {
      const result = await http.fetchJson<{ items: AdminApplicationRow[]; page: number; pageSize: number; total: number }>(
        `/admin/cohorts/${encodeURIComponent(cohortId)}/applications${cohortApplicationQuery(filter, page)}`,
      );
      return { items: result.items.map(toAdminCohortApplication), page: result.page, pageSize: result.pageSize, total: result.total };
    },

    reviewAdminCohortApplication: async (applicationId, { decision, note }) => {
      const trimmed = note?.trim();
      return toAdminCohortApplication(await http.fetchJson<AdminApplicationRow>(`/admin/cohort-applications/${encodeURIComponent(applicationId)}/review`, {
        method: "POST",
        body: { decision, ...(trimmed ? { note: trimmed } : {}) },
      }));
    },

    exportAdminCohortApplications: (cohortId, filter) =>
      http.fetchText(`/admin/cohorts/${encodeURIComponent(cohortId)}/applications.csv${cohortApplicationQuery(filter)}`),
  };
}
