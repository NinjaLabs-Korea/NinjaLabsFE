import { describe, expect, it } from "vitest";
import {
  answerDisplay,
  detailChoiceIndex,
  applicationToDraft,
  cohortApplicationQuery,
  cohortPhase,
  draftToValues,
  emptyCohortDraft,
  localized,
  normalizeHandle,
  resolveCohortApplyView,
  validateAnswers,
  validateCohortDraft,
  validateQuestionInputs,
  type AnswerInput,
  type CohortFormDraft,
  type CohortQuestion,
  type CohortQuestionInput,
  type MyCohortApplication,
  type PublicCohort,
} from "@/lib/cohorts";
import { DEFAULT_COHORT_QUESTIONS } from "@/lib/mocks/cohorts";

const label = (ko: string) => ({ ko, en: null, zh: null });
const question = (overrides: Partial<CohortQuestion> & Pick<CohortQuestion, "id" | "type">): CohortQuestion => ({ label: label(overrides.id), help: null, required: false, options: null, ...overrides });
const choices = (...ids: string[]) => ids.map((id) => ({ id, label: label(id), withDetail: id === "other" }));

const valid: CohortFormDraft = {
  displayName: "  Mina  ",
  telegram: "https://t.me/mina_builds?start=1",
  twitter: "x.com/mina_builds",
  intro: "  I build on Injective.  ",
  answers: {},
};

describe("normalizeHandle (mirror of the BE)", () => {
  it.each([
    ["name", "@name"],
    ["@name", "@name"],
    ["@@name", "@name"],
    ["  @name  ", "@name"],
    ["https://t.me/name", "@name"],
    ["t.me/name?start=x", "@name"],
    ["http://www.telegram.me/name/", "@name"],
    ["t.me/alice", "@alice"],
    ["", ""],
    ["   ", ""],
  ])("telegram %j -> %j", (raw, expected) => {
    expect(normalizeHandle(raw, "telegram")).toBe(expected);
  });

  it.each([
    ["https://x.com/name?s=20", "@name"],
    ["https://twitter.com/name", "@name"],
    ["mobile.twitter.com/name#top", "@name"],
    ["name", "@name"],
  ])("twitter %j -> %j", (raw, expected) => {
    expect(normalizeHandle(raw, "twitter")).toBe(expected);
  });
});

describe("normalizeHandle keeps non-profile links raw (mirror of the BE)", () => {
  it.each([
    ["t.me/joinchat/AAA", "telegram"],
    ["https://t.me/joinchat/BBB", "telegram"],
    ["https://t.me/JoinChat/BBB", "telegram"],
    ["t.me/name/12", "telegram"],
    ["t.me/share/url?url=x", "telegram"],
    ["x.com/intent/tweet", "twitter"],
    ["https://x.com/someone/status/1", "twitter"],
    ["https://x.com/i/flow/login", "twitter"],
  ] as const)("%s stays raw and fails validation", (raw, kind) => {
    expect(normalizeHandle(raw, kind)).toBe(raw);
    const errors = validateCohortDraft({ ...valid, [kind]: raw });
    expect(errors[kind]).toBe("invalid");
  });

  it("still normalizes profile links and bare handles", () => {
    expect(normalizeHandle("https://x.com/bob?s=20", "twitter")).toBe("@bob");
    expect(normalizeHandle("@carol", "twitter")).toBe("@carol");
    expect(normalizeHandle("https://t.me/alice/", "telegram")).toBe("@alice");
  });
});

describe("validateCohortDraft (the four fixed fields)", () => {
  it("accepts a complete draft and the empty draft reports every required field", () => {
    expect(validateCohortDraft(valid)).toEqual({});
    expect(Object.keys(validateCohortDraft(emptyCohortDraft)).sort()).toEqual(["displayName", "intro", "telegram", "twitter"]);
  });

  it("checks the handle shapes after normalization", () => {
    expect(validateCohortDraft({ ...valid, telegram: "abc" }).telegram).toBe("invalid");
    expect(validateCohortDraft({ ...valid, telegram: "1abcdef" }).telegram).toBe("invalid");
    expect(validateCohortDraft({ ...valid, twitter: "a".repeat(16) }).twitter).toBe("invalid");
    expect(validateCohortDraft({ ...valid, twitter: "has space" }).twitter).toBe("invalid");
  });

  it("limits the name to 60 and the introduction to 1000 characters (code points, like the BE)", () => {
    expect(validateCohortDraft({ ...valid, displayName: "x".repeat(61) }).displayName).toBe("tooLong");
    expect(validateCohortDraft({ ...valid, intro: "가".repeat(1000) }).intro).toBeUndefined();
    expect(validateCohortDraft({ ...valid, intro: "가".repeat(1001) }).intro).toBe("tooLong");
    expect(validateCohortDraft({ ...valid, intro: "\u{1F600}".repeat(1000) }).intro).toBeUndefined();
    expect(validateCohortDraft({ ...valid, intro: "   " }).intro).toBe("required");
  });
});

describe("validateAnswers (mirror of the BE rules)", () => {
  const short = question({ id: "s", type: "SHORT_TEXT", required: true });
  const long = question({ id: "l", type: "LONG_TEXT" });
  const single = question({ id: "one", type: "SINGLE_CHOICE", required: true, options: choices("a", "b", "other") });
  const multi = question({ id: "many", type: "MULTI_CHOICE", required: true, options: choices("a", "b", "other") });
  const all = [short, long, single, multi];
  const ok: AnswerInput[] = [{ questionId: "s", text: "hi" }, { questionId: "one", choices: ["a"] }, { questionId: "many", choices: ["a", "b"] }];

  it("accepts a complete answer set and leaves optional questions out", () => {
    expect(validateAnswers(all, ok)).toEqual({});
  });

  it("flags unanswered required questions: blank text, invisible text, empty choices", () => {
    expect(validateAnswers(all, [])).toEqual({ s: "required", one: "required", many: "required" });
    expect(validateAnswers(all, [{ questionId: "s", text: "   " }, { questionId: "one", choices: [] }, { questionId: "many", choices: ["a"] }])).toEqual({ s: "required", one: "required" });
    expect(validateAnswers(all, [{ questionId: "s", text: "\u200B\u200B" }, ...ok.slice(1)]).s).toBe("required");
  });

  it("limits a short answer to 200 code points without a newline, a long answer to 2000 with newlines", () => {
    expect(validateAnswers(all, [{ questionId: "s", text: "x".repeat(200) }, ...ok.slice(1)])).toEqual({});
    expect(validateAnswers(all, [{ questionId: "s", text: "x".repeat(201) }, ...ok.slice(1)]).s).toBe("tooLong");
    expect(validateAnswers(all, [{ questionId: "s", text: "\u{1F600}".repeat(200) }, ...ok.slice(1)])).toEqual({});
    expect(validateAnswers(all, [{ questionId: "s", text: "one\ntwo" }, ...ok.slice(1)]).s).toBe("invalid");
    expect(validateAnswers(all, [...ok, { questionId: "l", text: "line\nbreak" }])).toEqual({});
    expect(validateAnswers(all, [...ok, { questionId: "l", text: "x".repeat(2001) }]).l).toBe("tooLong");
    expect(validateAnswers(all, [...ok, { questionId: "l", text: "a\u202Eb" }]).l).toBe("invalid");
  });

  it("takes exactly one choice for SINGLE and at least one for MULTI, only ids of the question's options", () => {
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["a", "b"] }, ok[2]]).one).toBe("invalid");
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["zzz"] }, ok[2]]).one).toBe("invalid");
    expect(validateAnswers(all, [ok[0], ok[1], { questionId: "many", choices: ["a", "a"] }]).many).toBe("invalid");
    expect(validateAnswers(all, [ok[0], ok[1], { questionId: "many", choices: ["a", "nope"] }]).many).toBe("invalid");
  });

  it("asks for the detail exactly when a chosen option has withDetail (1..60 characters), and ignores it otherwise", () => {
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["other"] }, ok[2]]).one).toBe("otherRequired");
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["other"], other: "  " }, ok[2]]).one).toBe("otherRequired");
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["other"], other: "Designer" }, ok[2]])).toEqual({});
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["other"], other: "x".repeat(61) }, ok[2]]).one).toBe("tooLong");
    expect(validateAnswers(all, [ok[0], { questionId: "one", choices: ["a"], other: "ignored" }, ok[2]])).toEqual({});
  });

  it("rejects unknown and duplicate question ids and text/choice mix-ups", () => {
    expect(validateAnswers(all, [...ok, { questionId: "ghost", text: "x" }]).ghost).toBe("invalid");
    expect(validateAnswers(all, [...ok, { questionId: "s", text: "again" }]).s).toBe("invalid");
    expect(validateAnswers(all, [{ questionId: "s", choices: ["a"] }, ...ok.slice(1)]).s).toBe("invalid");
    expect(validateAnswers(all, [ok[0], { questionId: "one", text: "a" }, ok[2]]).one).toBe("invalid");
  });
});

describe("draftToValues", () => {
  const [experience, interests] = DEFAULT_COHORT_QUESTIONS;
  const shortQ = question({ id: "why", type: "SHORT_TEXT" });

  it("trims, normalizes handles and sends the answers in question order with the CONTRACT A5 shape", () => {
    const draft: CohortFormDraft = {
      ...valid,
      answers: {
        interest_areas: { text: "", choices: ["RESEARCHER", "DEVELOPER", "OTHER"], other: " UX " },
        web3_experience: { text: "", choices: ["Y1_3"], other: "ignored" },
        why: { text: "  because  ", choices: [], other: "" },
      },
    };
    expect(draftToValues(draft, [experience, interests, shortQ])).toEqual({
      displayName: "Mina",
      telegram: "@mina_builds",
      twitter: "@mina_builds",
      intro: "I build on Injective.",
      answers: [
        { questionId: "web3_experience", choices: ["Y1_3"] },
        { questionId: "interest_areas", choices: ["DEVELOPER", "RESEARCHER", "OTHER"], other: "UX" },
        { questionId: "why", text: "because" },
      ],
    });
  });

  it("leaves unanswered questions, unknown options and answers of removed questions out", () => {
    const draft: CohortFormDraft = { ...valid, answers: { why: { text: "  ", choices: [], other: "" }, web3_experience: { text: "", choices: ["gone"], other: "" }, removed: { text: "old", choices: [], other: "" } } };
    expect(draftToValues(draft, [experience, shortQ]).answers).toEqual([]);
  });

  it("keeps a missing detail as null so the BE answers COHORT_OTHER_DETAIL_REQUIRED", () => {
    const draft: CohortFormDraft = { ...valid, answers: { interest_areas: { text: "", choices: ["OTHER"], other: " " } } };
    expect(draftToValues(draft, [interests]).answers).toEqual([{ questionId: "interest_areas", choices: ["OTHER"], other: null }]);
  });
});

describe("applicationToDraft", () => {
  it("fills answers by question id, and what the cohort no longer asks is never sent again", () => {
    const [experience] = DEFAULT_COHORT_QUESTIONS;
    const saved = {
      displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "Hi",
      answers: [
        { questionId: "web3_experience", type: "SINGLE_CHOICE" as const, label: experience.label, text: null, choices: [{ id: "Y1_3", label: label("1~3") }], other: null },
        { questionId: "activity_type", type: "SINGLE_CHOICE" as const, label: label("현재 활동 유형"), text: null, choices: [{ id: "STUDENT", label: label("학생") }], other: null },
      ],
    };
    const draft = applicationToDraft(saved);
    expect(draft.answers.web3_experience).toEqual({ text: "", choices: ["Y1_3"], other: "" });
    expect(draftToValues(draft, [experience]).answers).toEqual([{ questionId: "web3_experience", choices: ["Y1_3"] }]);
    expect(draftToValues(draft, [question({ ...experience, options: choices("LT_1Y") })]).answers).toEqual([]);
  });
});

describe("localized / answerDisplay", () => {
  it("shows the viewer's language and falls back to Korean for a missing or blank translation", () => {
    expect(localized({ ko: "가", en: "a", zh: null }, "en")).toBe("a");
    expect(localized({ ko: "가", en: "a", zh: null }, "zh")).toBe("가");
    expect(localized({ ko: "가", en: " ", zh: "甲" }, "en")).toBe("가");
    expect(localized({ ko: "가", en: "a", zh: "甲" }, "ko")).toBe("가");
  });

  it("joins the chosen options and puts the detail after the option that asked for it", () => {
    const answer = { questionId: "interest_areas", type: "MULTI_CHOICE" as const, label: label("분야"), text: null, other: "UX",
      choices: [{ id: "DEVELOPER", label: { ko: "개발자", en: "Developer", zh: null } }, { id: "OTHER", label: { ko: "기타", en: "Other", zh: null } }] };
    expect(answerDisplay(answer, "en")).toBe("Developer, Other (UX)");
    expect(answerDisplay(answer, "zh")).toBe("개발자, 기타 (UX)");
    expect(answerDisplay({ ...answer, type: "SHORT_TEXT", text: "plain", choices: null, other: null }, "en")).toBe("plain");
  });
});
describe("answerDisplay detail placement", () => {
  const lt = (ko: string) => ({ ko, en: null, zh: null });
  const answer = { questionId: "q", type: "MULTI_CHOICE" as const, label: lt("분야"), text: null, other: "UX",
    choices: [{ id: "o_1a2b3c4d", label: lt("기타") }, { id: "o_5e6f7a8b", label: lt("A") }] };
  const question = { id: "q", type: "MULTI_CHOICE" as const, label: lt("분야"), help: null, required: false,
    options: [{ id: "o_1a2b3c4d", label: lt("기타"), withDetail: true }, { id: "o_5e6f7a8b", label: lt("A"), withDetail: false }, { id: "o_9c8d7e6f", label: lt("B"), withDetail: false }] };

  it("attaches the detail to the withDetail option even when it is not last and its id has no 'other'", () => {
    expect(answerDisplay(answer, "ko", question)).toBe("기타 (UX), A");
    expect(detailChoiceIndex(answer, question)).toBe(0);
  });

  it("guesses (id mentions other, else last) only when the question is gone", () => {
    expect(answerDisplay(answer, "ko")).toBe("기타, A (UX)");
    expect(detailChoiceIndex({ ...answer, other: null }, question)).toBe(-1);
  });
});


describe("validateQuestionInputs", () => {
  const input = (overrides: Partial<CohortQuestionInput> = {}): CohortQuestionInput => ({ type: "SHORT_TEXT", label: { ko: "질문" }, help: null, required: false, options: null, ...overrides });
  const choiceInput = (count: number, extra: Partial<CohortQuestionInput> = {}): CohortQuestionInput =>
    input({ type: "SINGLE_CHOICE", options: Array.from({ length: count }, (_, i) => ({ label: { ko: `옵션${i}` }, withDetail: false })), ...extra });
  const codes = (questions: CohortQuestionInput[]) => validateQuestionInputs(questions).map((issue) => issue.code);

  it("accepts an empty list, a text question and a choice question with 2..20 options", () => {
    expect(codes([])).toEqual([]);
    expect(codes([input(), choiceInput(2), choiceInput(20)])).toEqual([]);
  });

  it("allows 30 questions and no more", () => {
    expect(codes(Array.from({ length: 30 }, () => input()))).toEqual([]);
    expect(codes(Array.from({ length: 31 }, () => input()))).toEqual(["tooManyQuestions"]);
  });

  it("needs a Korean label of 1..200 plain characters; translations are optional but bounded", () => {
    expect(codes([input({ label: { ko: "  " } })])).toEqual(["labelRequired"]);
    expect(codes([input({ label: { ko: "x".repeat(201) } })])).toEqual(["labelTooLong"]);
    expect(codes([input({ label: { ko: "a\nb" } })])).toEqual(["labelInvalid"]);
    expect(codes([input({ label: { ko: "ok", en: "x".repeat(201) } })])).toEqual(["labelTooLong"]);
    expect(codes([input({ label: { ko: "ok", en: null, zh: "" } })])).toEqual([]);
  });

  it("asks for the Korean help text when only a translation is typed", () => {
    expect(codes([input({ help: { ko: "  ", en: "Only English" } })])).toEqual(["helpKoRequired"]);
    expect(codes([input({ help: { ko: "도움", en: "Help" } })])).toEqual([]);
  });

  it("limits help to 500 characters", () => {
    expect(codes([input({ help: { ko: "x".repeat(500) } })])).toEqual([]);
    expect(codes([input({ help: { ko: "x".repeat(501) } })])).toEqual(["helpTooLong"]);
  });

  it("needs 2..20 options, labels up to 60 and at most one withDetail", () => {
    expect(codes([choiceInput(1)])).toEqual(["optionsCount"]);
    expect(codes([choiceInput(21)])).toEqual(["optionsCount"]);
    expect(validateQuestionInputs([choiceInput(2, { options: [{ label: { ko: "" }, withDetail: false }, { label: { ko: "x".repeat(61) }, withDetail: false }] })])).toEqual([
      { code: "optionLabelRequired", index: 0, optionIndex: 0 },
      { code: "optionLabelTooLong", index: 0, optionIndex: 1 },
    ]);
    expect(codes([choiceInput(2, { options: [{ label: { ko: "a" }, withDetail: true }, { label: { ko: "b" }, withDetail: true }] })])).toEqual(["withDetailMax"]);
  });
});

const cohort = (overrides: Partial<PublicCohort> = {}): PublicCohort => ({ id: "c1", name: "2nd", description: null, opensAt: null, closesAt: null, acceptingApplications: true, questions: [], ...overrides });
const application = (overrides: Partial<MyCohortApplication> = {}): MyCohortApplication => ({
  displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "I build on Injective.", answers: [],
  id: "a1", cohortId: "c1", cohort: { id: "c1", name: "2nd", status: "OPEN", acceptingApplications: true },
  status: "SUBMITTED", reviewedAt: null, editable: true, withdrawable: true, createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
  ...overrides,
});

describe("resolveCohortApplyView", () => {
  it("shows the form when there is no application, and again after a withdrawal (reapply)", () => {
    expect(resolveCohortApplyView(cohort(), [])).toEqual({ kind: "form", reapply: false });
    expect(resolveCohortApplyView(cohort(), [application({ status: "WITHDRAWN" })])).toEqual({ kind: "form", reapply: true });
  });

  it("does not offer the form once the cohort stopped accepting", () => {
    expect(resolveCohortApplyView(cohort({ acceptingApplications: false }), [])).toEqual({ kind: "not-accepting" });
    expect(resolveCohortApplyView(cohort({ acceptingApplications: false }), [application({ status: "WITHDRAWN" })])).toEqual({ kind: "not-accepting" });
  });

  it("follows the application's status, and ignores applications to another cohort", () => {
    expect(resolveCohortApplyView(cohort(), [application()]).kind).toBe("submitted");
    expect(resolveCohortApplyView(cohort(), [application({ status: "ACCEPTED" })]).kind).toBe("accepted");
    expect(resolveCohortApplyView(cohort(), [application({ status: "REJECTED" })]).kind).toBe("rejected");
    expect(resolveCohortApplyView(cohort({ id: "c2" }), [application()])).toEqual({ kind: "form", reapply: false });
  });
});

describe("cohortPhase", () => {
  const now = Date.parse("2026-10-27T00:00:00.000Z");
  it("is open while accepting, upcoming before the opening time, closed otherwise", () => {
    expect(cohortPhase({ acceptingApplications: true, opensAt: null }, now)).toBe("open");
    expect(cohortPhase({ acceptingApplications: false, opensAt: "2026-11-01T00:00:00.000Z" }, now)).toBe("upcoming");
    expect(cohortPhase({ acceptingApplications: false, opensAt: "2026-10-01T00:00:00.000Z" }, now)).toBe("closed");
    expect(cohortPhase({ acceptingApplications: false, opensAt: null }, now)).toBe("closed");
  });
});

describe("cohortApplicationQuery", () => {
  it("builds the filter query shared by the table and the CSV export; blank filters are dropped", () => {
    expect(cohortApplicationQuery({})).toBe("");
    expect(cohortApplicationQuery({ status: "SUBMITTED", questionId: "interest_areas", optionId: "BIZDEV", q: "  mi na " }, 2)).toBe("?status=SUBMITTED&questionId=interest_areas&optionId=BIZDEV&q=mi+na&page=2");
    expect(cohortApplicationQuery({ q: "  " })).toBe("");
  });

  it("sends the choice filter only when the question and the option are both set", () => {
    expect(cohortApplicationQuery({ questionId: "interest_areas" })).toBe("");
    expect(cohortApplicationQuery({ optionId: "KOL" })).toBe("");
  });
});
