import { describe, expect, it, vi } from "vitest";
import { createAdminCohortApi, createCohortApi, parseQuestions, toAdminCohort, toMyCohortApplication } from "@/lib/api/cohorts";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { createApiApiClient } from "@/lib/api/api-client";
import { cohortAdminErrorKey, cohortApplyErrorKey, cohortFieldErrorsFromBe, isQuestionsChangedError, isStaleCohortError } from "@/lib/cohort-errors";
import { signedIn, signedOut } from "@/test/support/auth";

const values = {
  displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "hello",
  answers: [{ questionId: "web3_experience", choices: ["Y1_3"] }, { questionId: "interest_areas", choices: ["OTHER"], other: "UX" }],
};
const lt = (ko: string) => ({ ko, en: null, zh: null });
const rowAnswers = [
  { questionId: "web3_experience", type: "SINGLE_CHOICE", label: lt("Web3 경력"), text: null, choices: [{ id: "Y1_3", label: lt("1~3년") }], other: null },
  { questionId: "why", type: "LONG_TEXT", label: lt("왜?"), text: "because", choices: null, other: null },
];
const questionRows = [
  { id: "why", type: "LONG_TEXT", label: lt("왜?"), help: { ko: "도움", en: "help", zh: null }, required: true, options: null },
  { id: "pick", type: "MULTI_CHOICE", label: lt("고르기"), help: null, required: false, options: [{ id: "a", label: lt("가"), withDetail: false }, { id: "b", label: lt("기타"), withDetail: true }] },
];
const myRow = {
  displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "hello", answers: rowAnswers, id: "a1", cohortId: "c1", status: "SUBMITTED", reviewedAt: null, editable: true, withdrawable: true,
  createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z", cohort: { id: "c1", name: "2nd", status: "OPEN", acceptingApplications: true },
};
const adminRow = { displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "hello", answers: rowAnswers, id: "a1", cohortId: "c1", status: "ACCEPTED", reviewNote: "great", reviewedBy: "u9", reviewedAt: "2026-10-27T00:00:00.000Z", createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z", user: { id: "u1", nickname: "mina", email: "m@x.y" } };

function createHttp(answer?: unknown) {
  const fetchJson = vi.fn(async (): Promise<unknown> => answer);
  const fetchText = vi.fn(async () => "﻿\"id\"\r\n");
  const http = { fetchJson, fetchText, fetchForm: vi.fn(), hasSession: () => true, signOutRemote: vi.fn() } as unknown as ApiHttp;
  return { http, fetchJson, fetchText };
}
const call = (mock: ReturnType<typeof vi.fn>, index = 0) => mock.mock.calls[index] as unknown as [string, { method?: string; body?: Record<string, unknown> } | undefined];

describe("GET /cohorts/current", () => {
  it("returns the open cohort", async () => {
    const { http, fetchJson } = createHttp({ id: "c1", name: "2nd", description: null, opensAt: null, closesAt: "2026-12-01T00:00:00.000Z", acceptingApplications: true, questions: questionRows });
    expect(await createCohortApi(http).getCurrentCohort()).toEqual({
      id: "c1", name: "2nd", description: null, opensAt: null, closesAt: "2026-12-01T00:00:00.000Z", acceptingApplications: true,
      questions: [
        { ...questionRows[0], help: { ko: "도움", en: "help", zh: null } },
        questionRows[1],
      ],
    });
    expect(call(fetchJson)[0]).toBe("/cohorts/current");
  });

  it.each([["a JSON null body", null], ["an empty body (http reads it as undefined)", undefined]])("reads %s as no open cohort", async (_label, body) => {
    expect(await createCohortApi(createHttp(body).http).getCurrentCohort()).toBeNull();
  });
});

describe("question parsing", () => {
  it("reads a BE without questions as an empty list and skips what it cannot show", () => {
    expect(parseQuestions(undefined)).toEqual([]);
    expect(parseQuestions("nope")).toEqual([]);
    expect(parseQuestions([
      { id: "x", type: "DATE_PICKER", label: lt("날짜"), help: null, required: true, options: null },
      { id: "y", type: "SINGLE_CHOICE", label: lt("선택"), help: null, required: true, options: [] },
      { id: "z", type: "SHORT_TEXT", label: { en: "no ko" }, help: null, required: true, options: null },
      questionRows[0],
    ]).map((question) => question.id)).toEqual(["why"]);
  });

  it("keeps blank translations as null and a missing required flag as optional", () => {
    const [question] = parseQuestions([{ id: "q", type: "SHORT_TEXT", label: { ko: "질문", en: " ", zh: 3 }, options: null }]);
    expect(question).toMatchObject({ label: { ko: "질문", en: null, zh: null }, help: null, required: false });
  });
});

describe("applicant calls", () => {
  it("posts the application to the cohort and maps the applicant view", async () => {
    const { http, fetchJson } = createHttp(myRow);
    const saved = await createCohortApi(http).applyToCohort("c1", values);
    expect(call(fetchJson)).toEqual(["/cohorts/c1/applications", { method: "POST", body: values }]);
    expect(Object.keys(call(fetchJson)[1]?.body ?? {}).sort()).toEqual(["answers", "displayName", "intro", "telegram", "twitter"]);
    expect(saved.answers.map((answer) => answer.questionId)).toEqual(["web3_experience", "why"]);
    expect(saved).toMatchObject({ id: "a1", status: "SUBMITTED", editable: true, withdrawable: true, cohort: { id: "c1", status: "OPEN", acceptingApplications: true } });
    expect(saved).not.toHaveProperty("reviewNote");
  });

  it("patches, withdraws and encodes ids", async () => {
    const { http, fetchJson } = createHttp(myRow);
    const api = createCohortApi(http);
    await api.updateCohortApplication("a/1", values);
    await api.withdrawCohortApplication("a/1");
    expect(call(fetchJson, 0)).toEqual(["/cohorts/applications/a%2F1", { method: "PATCH", body: values }]);
    expect(call(fetchJson, 1)).toEqual(["/cohorts/applications/a%2F1/withdraw", { method: "POST" }]);
  });

  it("lists my applications only when signed in, and classifies a failure", async () => {
    const { http, fetchJson } = createHttp([myRow]);
    const api = createCohortApi(http);
    expect(await api.getMyCohortApplications(signedOut)).toEqual({ status: "available", data: [] });
    expect(fetchJson).not.toHaveBeenCalled();
    const result = await api.getMyCohortApplications(signedIn);
    expect(result.status === "available" && result.data[0].status).toBe("SUBMITTED");
    fetchJson.mockRejectedValueOnce(new ApiHttpError(401, "INVALID_REFRESH_TOKEN"));
    expect(await api.getMyCohortApplications(signedIn)).toEqual({ status: "unavailable", reason: "unauthorized" });
    fetchJson.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await api.getMyCohortApplications(signedIn)).toEqual({ status: "unavailable", reason: "network-error" });
  });

  it("keeps a value from a newer BE harmless instead of failing the list", () => {
    const row = toMyCohortApplication({ ...myRow, status: "ARCHIVED", answers: [...rowAnswers, { questionId: "q", type: "DATE", label: lt("x") }, "junk"], cohort: { ...myRow.cohort, status: "PAUSED" } });
    expect(row).toMatchObject({ status: "WITHDRAWN", cohort: { status: "CLOSED" } });
    expect(row.answers).toHaveLength(2);
    expect(toMyCohortApplication({ ...myRow, answers: undefined }).answers).toEqual([]);
  });
});

describe("admin calls", () => {
  const cohortRow = {
    id: "c1", name: "2nd", description: "d", status: "OPEN", opensAt: null, closesAt: null, acceptingApplications: true,
    applicationCounts: { SUBMITTED: 2, ACCEPTED: 1, REJECTED: 0, WITHDRAWN: 1, total: 4 }, allowedTransitions: ["CLOSED"], createdBy: "u1",
    createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", questions: questionRows,
  };

  it("maps cohorts with their counts and allowed transitions", () => {
    expect(toAdminCohort(cohortRow)).toMatchObject({ status: "OPEN", applicationCounts: { SUBMITTED: 2, total: 4 }, allowedTransitions: ["CLOSED"] });
    expect(toAdminCohort(cohortRow).questions.map((question) => question.id)).toEqual(["why", "pick"]);
    expect(toAdminCohort({ ...cohortRow, applicationCounts: {}, allowedTransitions: ["OPEN", "DRAFT"] })).toMatchObject({ applicationCounts: { SUBMITTED: 0, total: 0 }, allowedTransitions: ["OPEN"] });
  });

  it("creates with POST and edits with PATCH, sending cleared fields as null", async () => {
    const { http, fetchJson } = createHttp(cohortRow);
    const api = createAdminCohortApi(http);
    await api.saveAdminCohort(null, { name: "2nd", description: null, opensAt: null, closesAt: "2026-12-01T00:00:00.000Z" });
    await api.saveAdminCohort("c1", { name: "2nd", description: null, opensAt: null, closesAt: null });
    expect(call(fetchJson, 0)).toEqual(["/admin/cohorts", { method: "POST", body: { name: "2nd", description: null, opensAt: null, closesAt: "2026-12-01T00:00:00.000Z" } }]);
    expect(call(fetchJson, 1)).toEqual(["/admin/cohorts/c1", { method: "PATCH", body: { name: "2nd", description: null, opensAt: null, closesAt: null } }]);
  });

  it("replaces the questions with PUT and returns the cohort", async () => {
    const { http, fetchJson } = createHttp(cohortRow);
    const questions = [{ id: "why", type: "LONG_TEXT" as const, label: { ko: "왜?", en: null, zh: null }, help: null, required: true, options: null }];
    const saved = await createAdminCohortApi(http).saveAdminCohortQuestions("c/1", questions);
    expect(call(fetchJson)).toEqual(["/admin/cohorts/c%2F1/questions", { method: "PUT", body: { questions } }]);
    expect(saved.questions).toHaveLength(2);
  });

  it("transitions and deletes", async () => {
    const { http, fetchJson } = createHttp(cohortRow);
    const api = createAdminCohortApi(http);
    await api.transitionAdminCohort("c1", "CLOSED");
    await api.deleteAdminCohort("c1");
    expect(call(fetchJson, 0)).toEqual(["/admin/cohorts/c1/transition", { method: "POST", body: { to: "CLOSED" } }]);
    expect(call(fetchJson, 1)).toEqual(["/admin/cohorts/c1", { method: "DELETE" }]);
  });

  it("lists applications with the shared filter query and maps the reviewer-side fields", async () => {
    const { http, fetchJson } = createHttp({ items: [adminRow], page: 2, pageSize: 30, total: 31 });
    const page = await createAdminCohortApi(http).getAdminCohortApplications("c1", { status: "ACCEPTED", q: "mina" }, 2);
    expect(call(fetchJson)[0]).toBe("/admin/cohorts/c1/applications?status=ACCEPTED&q=mina&page=2");
    await createAdminCohortApi(http).getAdminCohortApplications("c1", { questionId: "interest_areas", optionId: "KOL" }, 1);
    expect(call(fetchJson, 1)[0]).toBe("/admin/cohorts/c1/applications?questionId=interest_areas&optionId=KOL&page=1");
    expect(page).toMatchObject({ page: 2, pageSize: 30, total: 31 });
    expect(page.items[0]).toMatchObject({ status: "ACCEPTED", reviewNote: "great", user: { nickname: "mina", email: "m@x.y" } });
  });

  it("reviews with a trimmed note, omits an empty one, and downloads the CSV through the same filter", async () => {
    const { http, fetchJson, fetchText } = createHttp(adminRow);
    const api = createAdminCohortApi(http);
    await api.reviewAdminCohortApplication("a1", { decision: "ACCEPTED", note: "  ok  " });
    await api.reviewAdminCohortApplication("a1", { decision: "REJECTED", note: "   " });
    expect(call(fetchJson, 0)).toEqual(["/admin/cohort-applications/a1/review", { method: "POST", body: { decision: "ACCEPTED", note: "ok" } }]);
    expect(call(fetchJson, 1)[1]?.body).toEqual({ decision: "REJECTED" });
    expect(await api.exportAdminCohortApplications("c1", { status: "SUBMITTED", questionId: "interest_areas", optionId: "KOL" })).toContain("id");
    expect(fetchText).toHaveBeenCalledWith("/admin/cohorts/c1/applications.csv?status=SUBMITTED&questionId=interest_areas&optionId=KOL");
  });

  it("is part of the api client next to the other domains", () => {
    const { http } = createHttp();
    const client = createApiApiClient(http);
    for (const method of ["getCurrentCohort", "applyToCohort", "getAdminCohorts", "exportAdminCohortApplications"] as const) expect(typeof client[method]).toBe("function");
  });
});

describe("cohort error rules", () => {
  it("maps apply failures: network, session, catalog codes, class-validator 400, anything else", () => {
    expect(cohortApplyErrorKey(new TypeError("Failed to fetch"))).toBe("network");
    expect(cohortApplyErrorKey(new ApiHttpError(401, "INVALID_REFRESH_TOKEN"))).toBe("session");
    for (const code of ["PROFILE_REQUIRED", "COHORT_NOT_ACCEPTING", "COHORT_ALREADY_APPLIED", "COHORT_OTHER_DETAIL_REQUIRED", "COHORT_NOT_FOUND"]) {
      expect(cohortApplyErrorKey(new ApiHttpError(409, code)), code).toBe(code);
    }
    expect(cohortApplyErrorKey(new ApiHttpError(400, "VALIDATION_FAILED", ["telegram must be a valid Telegram username"]))).toBe("invalid");
    expect(cohortApplyErrorKey(new ApiHttpError(429, "ThrottlerException: Too Many Requests"))).toBe("TOO_MANY_REQUESTS");
    expect(cohortApplyErrorKey(new ApiHttpError(500, "UNKNOWN_ERROR"))).toBe("generic");
  });

  it("reads COHORT_ANSWERS_INVALID as 'the questions changed' and COHORT_QUESTIONS_INVALID as the editor's own message", () => {
    const changed = new ApiHttpError(400, "COHORT_ANSWERS_INVALID");
    expect(cohortApplyErrorKey(changed)).toBe("COHORT_ANSWERS_INVALID");
    expect(isQuestionsChangedError(changed)).toBe(true);
    expect(isQuestionsChangedError(new ApiHttpError(400, "COHORT_OTHER_DETAIL_REQUIRED"))).toBe(false);
    expect(isStaleCohortError(changed)).toBe(false);
    expect(cohortAdminErrorKey(new ApiHttpError(400, "COHORT_QUESTIONS_INVALID"))).toBe("COHORT_QUESTIONS_INVALID");
  });

  it("marks the fields the BE named, and treats state errors as stale", () => {
    expect(cohortFieldErrorsFromBe(new ApiHttpError(400, "VALIDATION_FAILED", ["telegram must be a valid Telegram username", "intro should not be empty", "unknownField should not exist"]))).toEqual({ telegram: "invalid", intro: "invalid" });
    expect(cohortFieldErrorsFromBe(new ApiHttpError(409, "COHORT_ALREADY_APPLIED"))).toEqual({});
    expect(isStaleCohortError(new ApiHttpError(409, "COHORT_NOT_ACCEPTING"))).toBe(true);
    expect(isStaleCohortError(new ApiHttpError(400, "COHORT_OTHER_DETAIL_REQUIRED"))).toBe(false);
  });

  it("normalizes admin failures by status", () => {
    expect(cohortAdminErrorKey(new ApiHttpError(401, "INVALID_ACCESS_TOKEN"))).toBe("UNAUTHORIZED");
    expect(cohortAdminErrorKey(new ApiHttpError(429, "x"))).toBe("TOO_MANY_REQUESTS");
    expect(cohortAdminErrorKey(new ApiHttpError(409, "COHORT_ALREADY_OPEN"))).toBe("COHORT_ALREADY_OPEN");
    expect(cohortAdminErrorKey(new ApiHttpError(500, "boom"))).toBe("generic");
  });
});
