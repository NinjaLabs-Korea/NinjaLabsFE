import { describe, expect, it } from "vitest";
import {
  COHORT_APPLICATION_STATUSES,
  COHORT_REVIEW_DECISIONS,
  COHORT_STATUSES,
  normalizeHandle,
  validateAnswers,
  validateCohortDraft,
  validateQuestionInputs,
  type AnswerInput,
  type CohortFormDraft,
  type CohortQuestion,
  type CohortQuestionInput,
} from "@/lib/cohorts";
import { DEFAULT_COHORT_QUESTIONS } from "@/lib/mocks/cohorts";
import { createMockApiClient } from "@/lib/mocks/api-client";
import {
  BE_ANSWERS_ACCEPTED, BE_ANSWERS_REJECTED, BE_APPLICATION_EDITABLE, BE_APPLICATION_REAPPLY, BE_APPLICATION_REVIEWABLE,
  BE_COHORT_ALLOWED_TRANSITIONS, BE_COHORT_APPLICATION_STATUSES, BE_COHORT_STATUSES, BE_DISPLAY_NAME_ACCEPTED, BE_DISPLAY_NAME_REJECTED,
  BE_HANDLE_ACCEPTED, BE_HANDLE_REJECTED, BE_INTRO_ACCEPTED, BE_INTRO_REJECTED, BE_DISPLAY_NAME_REJECTED_BE_ONLY, BE_INTRO_REJECTED_BE_ONLY, BE_QUESTIONS_ACCEPTED, BE_QUESTIONS_REJECTED,
  BE_REVIEW_DECISIONS, BE_TELEGRAM_KEPT_RAW, BE_TELEGRAM_NORMALIZED, BE_TWITTER_KEPT_RAW, BE_TWITTER_NORMALIZED,
} from "./be-cohort-fixtures";

/**
 * FE cohort mirror against the BE rows pasted in `be-cohort-fixtures.ts` (same method as `validator-parity.test.ts`). A drift in either repo
 * shows up as a failing row here: paste the new BE rows into the fixture unchanged, do not "fix" an expectation to make the FE pass.
 */

const draft = (patch: Partial<CohortFormDraft>): CohortFormDraft => ({ displayName: "홍길동", telegram: "@ninja_kr", twitter: "@ninja", intro: "hello", answers: {}, ...patch });

describe("handles (BE cohort-fields.spec.ts)", () => {
  it.each(BE_TELEGRAM_NORMALIZED)("telegram %j normalizes to %j", (raw, expected) => {
    expect(normalizeHandle(raw, "telegram")).toBe(expected);
  });
  it.each(BE_TWITTER_NORMALIZED)("twitter %j normalizes to %j", (raw, expected) => {
    expect(normalizeHandle(raw, "twitter")).toBe(expected);
  });
  it.each(BE_TELEGRAM_KEPT_RAW)("telegram link %s stays raw and fails the handle check", (raw) => {
    expect(normalizeHandle(raw, "telegram")).toBe(raw);
    expect(validateCohortDraft(draft({ telegram: raw })).telegram).toBe("invalid");
  });
  it.each(BE_TWITTER_KEPT_RAW)("X link %s stays raw and fails the handle check", (raw) => {
    expect(normalizeHandle(raw, "twitter")).toBe(raw);
    expect(validateCohortDraft(draft({ twitter: raw })).twitter).toBe("invalid");
  });
  it.each(BE_HANDLE_REJECTED)("%s handle %j is invalid", (kind, raw) => {
    expect(validateCohortDraft(draft({ [kind]: raw }))[kind]).toBeDefined();
  });
  it.each(BE_HANDLE_ACCEPTED)("%s handle %j is valid", (kind, raw) => {
    expect(validateCohortDraft(draft({ [kind]: raw }))[kind]).toBeUndefined();
  });
});

describe("name and introduction text rules (BE cohort-fields.spec.ts)", () => {
  it.each(BE_DISPLAY_NAME_REJECTED)("displayName %j is rejected", (value) => {
    expect(validateCohortDraft(draft({ displayName: value })).displayName).toBeDefined();
  });
  it.each(BE_INTRO_REJECTED)("intro %j is rejected", (value) => {
    expect(validateCohortDraft(draft({ intro: value })).intro).toBeDefined();
  });
  // Known FE gap (see the fixture): flips to a failure the day the FE catches these before sending.
  it.fails.each(BE_DISPLAY_NAME_REJECTED_BE_ONLY.map((v) => [v]))("displayName %j is rejected by the BE only", (value) => {
    expect(validateCohortDraft(draft({ displayName: value })).displayName).toBeDefined();
  });
  it.fails.each(BE_INTRO_REJECTED_BE_ONLY.map((v) => [v]))("intro %j is rejected by the BE only", (value) => {
    expect(validateCohortDraft(draft({ intro: value })).intro).toBeDefined();
  });
  it.each(BE_DISPLAY_NAME_ACCEPTED)("displayName %j is accepted", (value) => {
    expect(validateCohortDraft(draft({ displayName: value })).displayName).toBeUndefined();
  });
  it.each(BE_INTRO_ACCEPTED)("intro %j is accepted", (value) => {
    expect(validateCohortDraft(draft({ intro: value })).intro).toBeUndefined();
  });
});

describe("status sets and transitions (BE cohort-status.spec.ts)", () => {
  it("the FE status lists are the BE ones", () => {
    expect([...COHORT_STATUSES]).toEqual(BE_COHORT_STATUSES);
    expect([...COHORT_APPLICATION_STATUSES]).toEqual(BE_COHORT_APPLICATION_STATUSES);
    expect([...COHORT_REVIEW_DECISIONS]).toEqual(BE_REVIEW_DECISIONS);
  });

  it("the mock BE offers exactly the BE transitions from DRAFT, OPEN and CLOSED", async () => {
    const api = createMockApiClient();
    const draftCohort = await api.saveAdminCohort(null, { name: "draft", description: null, opensAt: null, closesAt: null });
    const offered: Record<string, readonly string[]> = { DRAFT: draftCohort.allowedTransitions };
    const list = () => api.getAdminCohorts();
    offered.OPEN = (await list()).find((cohort) => cohort.status === "OPEN")!.allowedTransitions;
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    offered.CLOSED = (await list()).find((cohort) => cohort.id === "cohort-2")!.allowedTransitions;
    expect(offered).toEqual(BE_COHORT_ALLOWED_TRANSITIONS);
  });

  it("the mock BE lets the applicant edit and withdraw only a SUBMITTED application, reapply only after WITHDRAWN", async () => {
    const api = createMockApiClient();
    const values = { displayName: "Me", telegram: "@me_builds", twitter: "@me_builds", intro: "hi", answers: [{ questionId: "web3_experience", choices: ["GT_3Y"] }, { questionId: "interest_areas", choices: ["DEVELOPER"] }] };
    const submitted = await api.applyToCohort("cohort-2", values);
    expect(submitted.status).toBe(BE_APPLICATION_EDITABLE[0]);
    expect(submitted).toMatchObject({ editable: true, withdrawable: true });
    await api.withdrawCohortApplication(submitted.id);
    await expect(api.updateCohortApplication(submitted.id, values)).rejects.toMatchObject({ code: "COHORT_APPLICATION_NOT_SUBMITTED" });
    const again = await api.applyToCohort("cohort-2", values);
    expect(again.id).toBe(submitted.id);
    expect(BE_APPLICATION_REAPPLY).toEqual(["WITHDRAWN"]);
    expect(BE_APPLICATION_REVIEWABLE).toEqual(BE_COHORT_APPLICATION_STATUSES.filter((status) => status !== "WITHDRAWN"));
  });
});

describe("answers against the questions (BE cohort-questions.spec.ts validateAnswers)", () => {
  const text = (id: string, type: "LONG_TEXT" | "SHORT_TEXT"): CohortQuestion => ({ id, type, label: { ko: id, en: null, zh: null }, help: null, required: false, options: null });
  const questions = [...DEFAULT_COHORT_QUESTIONS, text("why", "LONG_TEXT"), text("nick", "SHORT_TEXT")];
  const problems = (answers: ReadonlyArray<Record<string, unknown>>) => Object.keys(validateAnswers(questions, answers as AnswerInput[]));

  it("the default questions carry the ids and the withDetail option the BE rows rely on", () => {
    const [web3, interest] = DEFAULT_COHORT_QUESTIONS;
    expect([web3.id, web3.type, web3.required]).toEqual(["web3_experience", "SINGLE_CHOICE", true]);
    expect([interest.id, interest.type, interest.required]).toEqual(["interest_areas", "MULTI_CHOICE", true]);
    expect(web3.options!.map((option) => option.id)).toEqual(["LT_1Y", "Y1_3", "GT_3Y"]);
    expect(interest.options!.filter((option) => option.withDetail).map((option) => option.id)).toEqual(["OTHER"]);
  });
  it.each(BE_ANSWERS_ACCEPTED)("accepts %s", (_name, answers) => {
    expect(problems(answers)).toEqual([]);
  });
  it.each(BE_ANSWERS_REJECTED)("rejects %s", (_name, answers) => {
    expect(problems(answers).length).toBeGreaterThan(0);
  });
});

describe("question editor input (BE cohort-questions.spec.ts validateQuestions)", () => {
  const issues = (questions: readonly Record<string, unknown>[]) => validateQuestionInputs(questions.map((question) => ({ help: null, ...question })) as unknown as CohortQuestionInput[]);
  it.each(BE_QUESTIONS_ACCEPTED)("accepts %s", (_name, questions) => {
    expect(issues(questions)).toEqual([]);
  });
  it.each(BE_QUESTIONS_REJECTED)("rejects %s", (_name, questions) => {
    expect(issues(questions).length).toBeGreaterThan(0);
  });
});
