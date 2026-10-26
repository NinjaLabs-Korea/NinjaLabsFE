import type { AdminCohortApi, CohortApi } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { MockApiError } from "@/lib/mocks/mock-error";
import {
  type AdminCohort,
  type AdminCohortApplication,
  type AdminCohortApplicationFilter,
  type AdminCohortCounts,
  type CohortApplicationValues,
  type CohortStatus,
  type MyCohortApplication,
  type PublicCohort,
} from "@/lib/cohorts";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 30;

type StoredApplication = AdminCohortApplication & { ownerId: string };

const sampleValues = (overrides: Partial<CohortApplicationValues>): CohortApplicationValues => ({
  displayName: "Mina",
  telegram: "@mina_builds",
  twitter: "@mina_builds",
  web3Experience: "Y1_3",
  activityType: "DEVELOPER",
  activityTypeOther: null,
  interestAreas: ["DEVELOPER", "RESEARCHER"],
  interestOther: null,
  intro: "Smart contract developer who wants to ship tools for Injective builders.",
  ...overrides,
});

const accepting = (cohort: { status: CohortStatus; opensAt: string | null; closesAt: string | null }, now = Date.now()): boolean =>
  cohort.status === "OPEN" &&
  (cohort.opensAt === null || Date.parse(cohort.opensAt) <= now) &&
  (cohort.closesAt === null || Date.parse(cohort.closesAt) >= now);

const TRANSITIONS: Record<CohortStatus, Array<"OPEN" | "CLOSED">> = { DRAFT: ["OPEN"], OPEN: ["CLOSED"], CLOSED: ["OPEN"] };

function assertOtherDetails(values: CohortApplicationValues): CohortApplicationValues {
  const activityTypeOther = values.activityType === "OTHER" ? values.activityTypeOther?.trim() || null : null;
  const interestOther = values.interestAreas.includes("OTHER") ? values.interestOther?.trim() || null : null;
  if ((values.activityType === "OTHER" && !activityTypeOther) || (values.interestAreas.includes("OTHER") && !interestOther)) {
    throw new MockApiError(400, "COHORT_OTHER_DETAIL_REQUIRED");
  }
  return { ...values, activityTypeOther, interestOther };
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
    { id: "cohort-2", name: "Ninja Labs 2nd cohort", description: "Ninja Labs builds on Injective together: developers, marketers, researchers and creators.\n\nApplications are reviewed by the operators; accepted members are added to the member list separately.", status: "OPEN", opensAt: iso(-7), closesAt: iso(21), createdAt: iso(-10), updatedAt: iso(-7) },
    { id: "cohort-1", name: "Ninja Labs 1st cohort", description: null, status: "CLOSED", opensAt: iso(-200), closesAt: iso(-150), createdAt: iso(-210), updatedAt: iso(-150) },
  ];
  const applicant = (id: string, nickname: string, status: StoredApplication["status"], values: Partial<CohortApplicationValues>, daysAgo: number): StoredApplication => ({
    ...sampleValues(values), id, cohortId: "cohort-2", status, reviewNote: status === "ACCEPTED" ? "Strong portfolio." : null,
    reviewedAt: status === "SUBMITTED" ? null : iso(-1), createdAt: iso(-daysAgo), updatedAt: iso(-daysAgo),
    user: { id: `user-${nickname}`, nickname, email: `${nickname}@example.com` }, ownerId: `user-${nickname}`,
  });
  let applications: StoredApplication[] = [
    applicant("capp-1", "mina", "SUBMITTED", {}, 3),
    applicant("capp-2", "joon", "ACCEPTED", { displayName: "Joon", activityType: "CONTENT_CREATOR", interestAreas: ["CONTENT_CREATOR", "KOL"], telegram: "@joon_writes", twitter: "@joon_writes" }, 5),
    applicant("capp-3", "sora", "REJECTED", { displayName: "Sora", telegram: "@sora_study", twitter: "@sora_study", activityType: "STUDENT", web3Experience: "LT_1Y", interestAreas: ["DEVELOPER"], intro: "Computer science student learning Solidity and CosmWasm." }, 6),
    applicant("capp-4", "haru", "WITHDRAWN", { displayName: "Haru", telegram: "@haru_ux", twitter: "@haru_ux", activityType: "OTHER", activityTypeOther: "Designer", interestAreas: ["OTHER"], interestOther: "UX research" }, 8),
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
      .filter((application) => !filter.activityType || application.activityType === filter.activityType)
      .filter((application) => !filter.interestArea || application.interestAreas.includes(filter.interestArea))
      .filter((application) => !needle || [application.displayName, application.telegram, application.twitter, application.user.nickname, application.user.email].some((field) => field.toLowerCase().includes(needle)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map(({ ownerId: _owner, ...rest }) => (void _owner, rest));
  };

  const applicantApi: CohortApi = {
    getCurrentCohort: async () => {
      const open = cohorts.find((cohort) => cohort.status === "OPEN");
      if (!open) return null;
      const current: PublicCohort = { id: open.id, name: open.name, description: open.description, opensAt: open.opensAt, closesAt: open.closesAt, acceptingApplications: accepting(open) };
      return current;
    },
    getMyCohortApplications: async (auth) => ({ status: "available", data: isOwner(auth) ? applications.filter((item) => item.ownerId === ownerId).map(myView).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [] }),
    applyToCohort: async (cohortId, input) => {
      const cohort = find(cohortId);
      if (!cohort || cohort.status === "DRAFT") throw new MockApiError(404, "COHORT_NOT_FOUND");
      const values = assertOtherDetails(input);
      if (!accepting(cohort)) throw new MockApiError(409, "COHORT_NOT_ACCEPTING");
      const existing = applications.find((item) => item.cohortId === cohortId && item.ownerId === ownerId);
      if (existing && existing.status !== "WITHDRAWN") throw new MockApiError(409, "COHORT_ALREADY_APPLIED");
      const now = new Date().toISOString();
      if (existing) return myView(replace({ ...existing, ...values, status: "SUBMITTED", reviewNote: null, reviewedAt: null, createdAt: now, updatedAt: now }));
      const created: StoredApplication = { ...values, id: nextId("preview-cohort-application"), cohortId, status: "SUBMITTED", reviewNote: null, reviewedAt: null, createdAt: now, updatedAt: now, user: { id: ownerId, nickname: "preview", email: "preview@example.com" }, ownerId };
      applications = [created, ...applications];
      return myView(created);
    },
    updateCohortApplication: async (applicationId, input) => {
      const current = mine(applicationId);
      if (current.status !== "SUBMITTED") throw new MockApiError(409, "COHORT_APPLICATION_NOT_SUBMITTED");
      if (!accepting(requireCohort(current.cohortId))) throw new MockApiError(409, "COHORT_NOT_ACCEPTING");
      return myView(replace({ ...current, ...assertOtherDetails(input), updatedAt: new Date().toISOString() }));
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
        const created = { id: nextId("preview-cohort"), ...input, status: "DRAFT" as const, createdAt: now, updatedAt: now };
        cohorts = [created, ...cohorts];
        return adminView(created);
      }
      const current = requireCohort(cohortId);
      const next = { ...current, ...input, updatedAt: now };
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
      const header = ["id", "applied_at", "status", "display_name", "nickname", "email", "telegram", "twitter", "web3_experience", "activity_type", "activity_type_other", "interest_areas", "interest_other", "intro", "review_note", "reviewed_at"];
      const rows = filtered(cohortId, filter).map((a) => [
        a.id, a.createdAt, a.status, a.displayName, a.user.nickname, a.user.email, a.telegram.replace(/^@/, ""), a.twitter.replace(/^@/, ""), a.web3Experience,
        a.activityType, a.activityTypeOther ?? "", a.interestAreas.join(";"), a.interestOther ?? "", a.intro, a.reviewNote ?? "", a.reviewedAt ?? "",
      ]);
      return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    },
  };

  return { applicantApi, adminApi };
}
