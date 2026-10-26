import type { AdminCohortApi, ApiResult, CohortApi } from "@/lib/contracts/api";
import type { ApiHttp } from "@/lib/api/http";
import { unavailableReason } from "@/lib/api/api-client";
import {
  ACTIVITY_TYPES,
  COHORT_APPLICATION_STATUSES,
  COHORT_STATUSES,
  INTEREST_AREAS,
  WEB3_EXPERIENCES,
  cohortApplicationQuery,
  type ActivityType,
  type AdminCohort,
  type AdminCohortApplication,
  type AdminCohortCounts,
  type CohortApplicationStatus,
  type CohortApplicationValues,
  type CohortStatus,
  type InterestArea,
  type MyCohortApplication,
  type PublicCohort,
  type Web3Experience,
} from "@/lib/cohorts";

// ── BE rows (camelCase, ISO dates; docs/api-contract.md "기수 모집") ──

type ApplicationFieldsRow = {
  id: string;
  cohortId: string;
  status: string;
  displayName: string;
  telegram: string;
  twitter: string;
  web3Experience: string;
  activityType: string;
  activityTypeOther: string | null;
  interestAreas: string[];
  interestOther: string | null;
  intro: string;
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
  createdAt: string;
  updatedAt: string;
};

// A value outside the known sets (a newer BE) keeps its safest reading instead of failing the whole list:
// an unknown application status reads as SUBMITTED-less "WITHDRAWN" (no action offered), an unknown cohort status as CLOSED.
const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

function toValues(row: ApplicationFieldsRow): CohortApplicationValues {
  return {
    displayName: row.displayName,
    telegram: row.telegram,
    twitter: row.twitter,
    web3Experience: pick<Web3Experience>(WEB3_EXPERIENCES, row.web3Experience, "LT_1Y"),
    activityType: pick<ActivityType>(ACTIVITY_TYPES, row.activityType, "OTHER"),
    activityTypeOther: row.activityTypeOther ?? null,
    interestAreas: (row.interestAreas ?? []).filter((area): area is InterestArea => (INTEREST_AREAS as readonly string[]).includes(area)),
    interestOther: row.interestOther ?? null,
    intro: row.intro,
  };
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

export function toPublicCohort(row: PublicCohort | null | undefined): PublicCohort | null {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    opensAt: row.opensAt ?? null,
    closesAt: row.closesAt ?? null,
    acceptingApplications: row.acceptingApplications === true,
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

/** An empty "other" detail is sent as `null` so the BE drops it; the BE ignores it unless "other" is chosen anyway. */
const body = (values: CohortApplicationValues) => ({ ...values });

export function createCohortApi(http: ApiHttp): CohortApi {
  return {
    getCurrentCohort: async () => toPublicCohort(await http.fetchJson<PublicCohort | null | undefined>("/cohorts/current")),

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
