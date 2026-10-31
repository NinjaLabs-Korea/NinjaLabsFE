import { describe, expect, it } from "vitest";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { getMockFixtureSnapshot, createMockFixtures } from "@/lib/mocks/fixtures";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { CohortApplicationValues, CohortQuestionInput } from "@/lib/cohorts";

const owner = (): AuthSnapshot => ({ status: "signed-in", user: getMockFixtureSnapshot(createMockFixtures("default")).account.user });
const stranger: AuthSnapshot = { status: "signed-in", user: { id: "someone-else", handle: "x", initials: "X", profileSlug: "x" } };
const values: CohortApplicationValues = {
  displayName: "Me", telegram: "@me_builds", twitter: "@me_builds", intro: "hi",
  answers: [{ questionId: "web3_experience", choices: ["GT_3Y"] }, { questionId: "interest_areas", choices: ["DEVELOPER"] }],
};
const mine = async (api: ReturnType<typeof createMockApiClient>) => {
  const result = await api.getMyCohortApplications(owner());
  if (result.status !== "available") throw new Error("unavailable");
  return result.data;
};
const code = async (promise: Promise<unknown>) => promise.then(() => null, (error: { status: number; code: string }) => `${error.status} ${error.code}`);

describe("mock cohort recruitment (BE twin)", () => {
  it("starts with an open, accepting cohort and no application of mine", async () => {
    const api = createMockApiClient();
    expect(await api.getCurrentCohort()).toMatchObject({ id: "cohort-2", acceptingApplications: true });
    expect(await mine(api)).toEqual([]);
    expect(await api.getMyCohortApplications(stranger)).toEqual({ status: "available", data: [] });
  });

  it("apply -> edit -> withdraw -> reapply keeps one row per cohort and never shows the review note", async () => {
    const api = createMockApiClient();
    const created = await api.applyToCohort("cohort-2", values);
    expect(created).toMatchObject({ status: "SUBMITTED", editable: true, withdrawable: true });
    expect(created).not.toHaveProperty("reviewNote");
    expect(await code(api.applyToCohort("cohort-2", values))).toBe("409 COHORT_ALREADY_APPLIED");
    expect(await api.updateCohortApplication(created.id, { ...values, intro: "changed" })).toMatchObject({ intro: "changed" });
    await api.withdrawCohortApplication(created.id);
    expect(await code(api.withdrawCohortApplication(created.id))).toBe("409 COHORT_APPLICATION_NOT_SUBMITTED");
    expect(await code(api.updateCohortApplication(created.id, values))).toBe("409 COHORT_APPLICATION_NOT_SUBMITTED");
    const again = await api.applyToCohort("cohort-2", values);
    expect(again.id).toBe(created.id);
    expect(again.status).toBe("SUBMITTED");
    expect(await mine(api)).toHaveLength(1);
  });

  it("requires the detail of 'other' (400) and refuses unknown, draft and closed cohorts", async () => {
    const api = createMockApiClient();
    expect(await code(api.applyToCohort("cohort-2", { ...values, answers: [values.answers[0], { questionId: "interest_areas", choices: ["OTHER"] }] }))).toBe("400 COHORT_OTHER_DETAIL_REQUIRED");
    expect(await code(api.applyToCohort("cohort-2", { ...values, answers: values.answers.slice(1) }))).toBe("400 COHORT_ANSWERS_INVALID");
    expect(await code(api.applyToCohort("cohort-2", { ...values, answers: [...values.answers, { questionId: "ghost", text: "x" }] }))).toBe("400 COHORT_ANSWERS_INVALID");
    expect(await code(api.applyToCohort("nope", values))).toBe("404 COHORT_NOT_FOUND");
    const draft = await api.saveAdminCohort(null, { name: "draft", description: null, opensAt: null, closesAt: null });
    expect(await code(api.applyToCohort(draft.id, values))).toBe("404 COHORT_NOT_FOUND");
    expect(await code(api.applyToCohort("cohort-1", values))).toBe("409 COHORT_NOT_ACCEPTING");
  });

  it("closing stops edits but not withdrawals, and the admin sees the decision while the applicant only sees the status", async () => {
    const api = createMockApiClient();
    const created = await api.applyToCohort("cohort-2", values);
    const reviewed = await api.reviewAdminCohortApplication(created.id, { decision: "ACCEPTED", note: "  keep  " });
    expect(reviewed).toMatchObject({ status: "ACCEPTED", reviewNote: "keep" });
    const [row] = await mine(api);
    expect(row.status).toBe("ACCEPTED");
    expect(row).not.toHaveProperty("reviewNote");
    expect(await api.reviewAdminCohortApplication(created.id, { decision: "REJECTED" })).toMatchObject({ status: "REJECTED", reviewNote: null });

    const second = createMockApiClient();
    const mineSubmitted = await second.applyToCohort("cohort-2", values);
    await second.transitionAdminCohort("cohort-2", "CLOSED");
    expect(await code(second.updateCohortApplication(mineSubmitted.id, values))).toBe("409 COHORT_NOT_ACCEPTING");
    await second.withdrawCohortApplication(mineSubmitted.id);
    expect(await code(second.reviewAdminCohortApplication(mineSubmitted.id, { decision: "ACCEPTED" }))).toBe("409 COHORT_APPLICATION_WITHDRAWN");
  });

  it("enforces one open cohort, the transition table, the window and the delete guard", async () => {
    const api = createMockApiClient();
    const draft = await api.saveAdminCohort(null, { name: "3rd", description: null, opensAt: null, closesAt: null });
    expect(draft.status).toBe("DRAFT");
    expect(draft.allowedTransitions).toEqual(["OPEN"]);
    expect(await code(api.transitionAdminCohort(draft.id, "OPEN"))).toBe("409 COHORT_ALREADY_OPEN");
    expect(await code(api.transitionAdminCohort(draft.id, "CLOSED"))).toBe("400 COHORT_INVALID_TRANSITION");
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    expect((await api.transitionAdminCohort(draft.id, "OPEN")).acceptingApplications).toBe(true);
    expect((await api.transitionAdminCohort("cohort-2", "OPEN").catch((error: { code: string }) => error.code))).toBe("COHORT_ALREADY_OPEN");
    expect((await api.transitionAdminCohort(draft.id, "CLOSED")).allowedTransitions).toEqual(["OPEN"]);
    expect(await code(api.saveAdminCohort(null, { name: "x", description: null, opensAt: "2026-12-01T00:00:00.000Z", closesAt: "2026-12-01T00:00:00.000Z" }))).toBe("400 COHORT_INVALID_WINDOW");
    expect(await code(api.deleteAdminCohort("cohort-2"))).toBe("409 COHORT_HAS_APPLICATIONS");
    await api.deleteAdminCohort(draft.id);
    expect((await api.getAdminCohorts()).map((cohort) => cohort.id)).not.toContain(draft.id);
  });

  it("a window in the future is open but not accepting", async () => {
    const api = createMockApiClient();
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    const future = await api.saveAdminCohort(null, { name: "later", description: null, opensAt: new Date(Date.now() + 86_400_000).toISOString(), closesAt: null });
    const opened = await api.transitionAdminCohort(future.id, "OPEN");
    expect(opened).toMatchObject({ status: "OPEN", acceptingApplications: false });
    expect(await api.getCurrentCohort()).toMatchObject({ id: future.id, acceptingApplications: false });
  });

  it("filters, searches and pages the applications, and the CSV carries the same filter", async () => {
    const api = createMockApiClient();
    const all = await api.getAdminCohortApplications("cohort-2", {}, 1);
    expect(all).toMatchObject({ page: 1, pageSize: 30, total: 4 });
    expect((await api.getAdminCohortApplications("cohort-2", { status: "ACCEPTED" }, 1)).items.map((row) => row.displayName)).toEqual(["Joon"]);
    expect((await api.getAdminCohortApplications("cohort-2", { questionId: "web3_experience", optionId: "LT_1Y" }, 1)).items.map((row) => row.displayName)).toEqual(["Sora"]);
    expect((await api.getAdminCohortApplications("cohort-2", { questionId: "interest_areas", optionId: "KOL" }, 1)).total).toBe(1);
    expect((await api.getAdminCohortApplications("cohort-2", { questionId: "interest_areas" }, 1)).total).toBe(4);
    expect((await api.getAdminCohortApplications("cohort-2", { q: "MINA" }, 1)).items.map((row) => row.displayName)).toEqual(["Mina"]);
    expect((await api.getAdminCohortApplications("cohort-2", {}, 2)).items).toEqual([]);
    const csv = await api.exportAdminCohortApplications("cohort-2", { status: "REJECTED" });
    expect(csv.startsWith("﻿\"id\",\"applied_at\"")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
    expect(csv.split("\r\n")[0]).toBe('\uFEFF"id","applied_at","status","display_name","nickname","email","telegram","twitter","intro","Web3 경력","참여하고 싶은 분야","other_answers","review_note","reviewed_at"');
    expect(await code(api.getAdminCohortApplications("nope", {}, 1))).toBe("404 COHORT_NOT_FOUND");
  });

  it("neutralizes spreadsheet formulas in the CSV", async () => {
    const api = createMockApiClient();
    await api.applyToCohort("cohort-2", { ...values, displayName: "=HYPERLINK(\"x\")" });
    const csv = await api.exportAdminCohortApplications("cohort-2", { q: "HYPERLINK" });
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
});

describe("mock cohort questions (BE twin of CONTRACT A)", () => {
  const input = (overrides: Partial<CohortQuestionInput> = {}): CohortQuestionInput => ({ type: "SHORT_TEXT", label: { ko: "질문" }, help: null, required: false, options: null, ...overrides });

  it("starts every cohort with the two default questions, public and admin alike", async () => {
    const api = createMockApiClient();
    expect((await api.getCurrentCohort())?.questions.map((question) => question.id)).toEqual(["web3_experience", "interest_areas"]);
    const draft = await api.saveAdminCohort(null, { name: "new", description: null, opensAt: null, closesAt: null });
    expect(draft.questions.map((question) => question.id)).toEqual(["web3_experience", "interest_areas"]);
  });

  it("PUT replaces the list: ids kept for known questions and options, generated for new ones, order is the array order", async () => {
    const api = createMockApiClient();
    const [experience] = (await api.getAdminCohorts()).find((cohort) => cohort.id === "cohort-2")!.questions;
    const saved = await api.saveAdminCohortQuestions("cohort-2", [
      input({ type: "LONG_TEXT", label: { ko: "왜 지원했나요?", en: "Why?" }, required: true }),
      input({ id: experience.id, type: "SINGLE_CHOICE", label: { ko: "경력" }, options: [{ id: "LT_1Y", label: { ko: "짧음" }, withDetail: false }, { label: { ko: "새 선택지" }, withDetail: true }] }),
    ]);
    expect(saved.questions[0]).toMatchObject({ type: "LONG_TEXT", required: true, label: { ko: "왜 지원했나요?", en: "Why?", zh: null }, options: null });
    expect(saved.questions[0].id).toMatch(/^q_[0-9a-f]{12}$/);
    expect(saved.questions[1].id).toBe("web3_experience");
    expect(saved.questions[1].options?.[0].id).toBe("LT_1Y");
    expect(saved.questions[1].options?.[1].id).toMatch(/^o_[0-9a-f]{8}$/);
    expect((await api.getCurrentCohort())?.questions).toHaveLength(2);
  });

  it("refuses unknown and duplicate ids and broken shapes with COHORT_QUESTIONS_INVALID, and an unknown cohort with 404", async () => {
    const api = createMockApiClient();
    expect(await code(api.saveAdminCohortQuestions("cohort-2", [input({ id: "ghost" })]))).toBe("400 COHORT_QUESTIONS_INVALID");
    expect(await code(api.saveAdminCohortQuestions("cohort-2", [input({ id: "web3_experience", type: "SINGLE_CHOICE", options: [{ id: "nope", label: { ko: "a" }, withDetail: false }, { label: { ko: "b" }, withDetail: false }] })]))).toBe("400 COHORT_QUESTIONS_INVALID");
    expect(await code(api.saveAdminCohortQuestions("cohort-2", [input({ id: "interest_areas", type: "MULTI_CHOICE", options: [] }), input()]))).toBe("400 COHORT_QUESTIONS_INVALID");
    const twice = { id: "web3_experience", type: "SHORT_TEXT" as const, label: { ko: "a" }, help: null, required: false, options: null };
    expect(await code(api.saveAdminCohortQuestions("cohort-2", [twice, twice]))).toBe("400 COHORT_QUESTIONS_INVALID");
    expect(await code(api.saveAdminCohortQuestions("nope", []))).toBe("404 COHORT_NOT_FOUND");
  });

  it("snapshots answers, so editing the questions never changes an application already received", async () => {
    const api = createMockApiClient();
    const created = await api.applyToCohort("cohort-2", values);
    expect(created.answers.map((answer) => [answer.questionId, answer.choices?.map((choice) => choice.label.ko)])).toEqual([["web3_experience", ["3년 이상"]], ["interest_areas", ["개발자"]]]);
    await api.saveAdminCohortQuestions("cohort-2", [input({ id: "web3_experience", type: "SINGLE_CHOICE", label: { ko: "바뀐 질문" }, options: [{ id: "GT_3Y", label: { ko: "바뀐 선택지" }, withDetail: false }, { label: { ko: "또" }, withDetail: false }] })]);
    const [row] = await mine(api);
    expect(row.answers[0].label.ko).toBe("Web3 경력");
    expect(row.answers[0].choices?.[0].label.ko).toBe("3년 이상");
    // The old application can no longer be edited with the old answers: the form changed.
    expect(await code(api.updateCohortApplication(created.id, values))).toBe("400 COHORT_ANSWERS_INVALID");
  });

  it("exports one CSV column per current question and puts answers to removed questions into other_answers", async () => {
    const api = createMockApiClient();
    await api.saveAdminCohortQuestions("cohort-2", [input({ id: "web3_experience", type: "SINGLE_CHOICE", label: { ko: "Web3 경력" }, options: [{ id: "LT_1Y", label: { ko: "a" }, withDetail: false }, { id: "Y1_3", label: { ko: "b" }, withDetail: false }] }), input({ label: { ko: "새 질문" } })]);
    const [header, ...rows] = (await api.exportAdminCohortApplications("cohort-2", { q: "mina" })).split("\r\n").filter(Boolean);
    expect(header).toContain('"Web3 경력","새 질문","other_answers"');
    expect(rows[0]).toContain('"1~3년"');
    expect(rows[0]).toContain('"참여하고 싶은 분야: 개발자;리서처"');
  });
});
