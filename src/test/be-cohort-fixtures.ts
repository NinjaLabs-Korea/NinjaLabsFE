/**
 * Cohort (recruitment) rows copied from NinjaLabsBE `origin/main` d98c327. Paste new BE rows here unchanged; never "fix" an expectation to
 * make the FE pass. Used by `cohort-parity.test.ts`. Same method as `be-validator-fixtures.ts` (nickname / visible text).
 *   - handle rows:        `src/cohorts/cohort-fields.spec.ts` ("handle normalization", "CohortApplicationFields")
 *   - text rule rows:     `src/cohorts/cohort-fields.spec.ts` ("visible text rules")
 *   - status / policy:    `src/cohorts/cohort-status.spec.ts` (CohortStatusPolicy, CohortApplicationPolicy)
 *   - question rows:      `src/cohorts/cohort-questions.spec.ts` (validateQuestions, validateAnswers; ids of `DEFAULT_COHORT_QUESTIONS`)
 */

/** cohort-fields.spec.ts "accepts @name, name and URLs and always yields @name" (telegram pattern) */
export const BE_TELEGRAM_NORMALIZED: ReadonlyArray<readonly [string, string]> = [
  ["@name", "@name"], ["name", "@name"], [" @@name ", "@name"], ["https://t.me/name?start=1", "@name"], ["t.me/name/", "@name"], ["", ""],
  ["https://t.me/valid_name", "@valid_name"], ["t.me/valid_name?start=1", "@valid_name"],
];

/** cohort-fields.spec.ts "keeps non-profile telegram link %s unchanged so the handle check fails" */
export const BE_TELEGRAM_KEPT_RAW: readonly string[] = [
  "t.me/joinchat/AAAA", "https://t.me/JoinChat/AAAA", "https://t.me/share/url?url=x", "t.me/c/123/4", "t.me/name/12", "t.me/+AbCdEf/x", "t.me/addstickers/pack", "t.me/joinchat",
];

/** cohort-fields.spec.ts "applies the same rule to X post/intent links" */
export const BE_TWITTER_KEPT_RAW: readonly string[] = ["https://x.com/name/status/1", "x.com/intent/tweet?text=a", "x.com/i/flow/login"];
export const BE_TWITTER_NORMALIZED: ReadonlyArray<readonly [string, string]> = [["https://x.com/Ninja_KR?s=20", "@Ninja_KR"]];

/** cohort-fields.spec.ts "rejects %s = %j" (handle rows; the value is what the applicant typed) */
export const BE_HANDLE_REJECTED: ReadonlyArray<readonly ["telegram" | "twitter", string]> = [
  ["telegram", "abc"], ["telegram", "a b c d e"], ["telegram", "1abcde"], ["twitter", "x".repeat(16)], ["twitter", "bad-handle"],
];
/** the `valid` body of cohort-fields.spec.ts: these two normalize to `@ninja_kr` and `@Ninja_KR` and pass */
export const BE_HANDLE_ACCEPTED: ReadonlyArray<readonly ["telegram" | "twitter", string]> = [["telegram", "https://t.me/ninja_kr"], ["twitter", "@Ninja_KR"]];

/** cohort-fields.spec.ts "visible text rules" rejects (both create and update) */
export const BE_DISPLAY_NAME_REJECTED: readonly string[] = ["​​", "ㅤ⠀", "   ", "x".repeat(61)];
export const BE_INTRO_REJECTED: readonly string[] = ["​​​", "   ", "x".repeat(1001)];
/**
 * BE rejects these (400, the form then marks the field invalid), but the FE draft check does not catch them before sending: it only
 * checks "has a visible character" and the length. Known gap, not fixed here (behavior-preserving PR): `cohort-parity.test.ts` runs
 * them with `it.fails`, so closing the gap (validateCohortDraft using isPlainDisplayText / the bidi check) turns the test red and
 * these rows then move up into the lists above.
 */
export const BE_DISPLAY_NAME_REJECTED_BE_ONLY: readonly string[] = ["ab‮cd", "a\nb"];
export const BE_INTRO_REJECTED_BE_ONLY: readonly string[] = ["hi ‮ evil", "x⁦y"];
/** "counts emoji by code point like Postgres (60 flags ok, 61 not)" and "accepts Korean/emoji names with ZWJ and multi-line intro" */
export const BE_DISPLAY_NAME_ACCEPTED: readonly string[] = ["🥷".repeat(60), "홍길동 👩‍💻"];
export const BE_INTRO_ACCEPTED: readonly string[] = ["line1\nline2\r\n\nline4"];

/** cohort-status.spec.ts */
export const BE_COHORT_STATUSES: readonly string[] = ["DRAFT", "OPEN", "CLOSED"];
export const BE_COHORT_ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = { DRAFT: ["OPEN"], OPEN: ["CLOSED"], CLOSED: ["OPEN"] };
export const BE_COHORT_APPLICATION_STATUSES: readonly string[] = ["SUBMITTED", "ACCEPTED", "REJECTED", "WITHDRAWN"];
export const BE_REVIEW_DECISIONS: readonly string[] = ["ACCEPTED", "REJECTED"];
/** CohortApplicationPolicy: editable/withdrawable = SUBMITTED only; reapply = WITHDRAWN only; reviewable = all but WITHDRAWN */
export const BE_APPLICATION_EDITABLE: readonly string[] = ["SUBMITTED"];
export const BE_APPLICATION_REAPPLY: readonly string[] = ["WITHDRAWN"];
export const BE_APPLICATION_REVIEWABLE: readonly string[] = ["SUBMITTED", "ACCEPTED", "REJECTED"];

/** cohort-questions.spec.ts validateAnswers: the questions it runs against (web3 + interest = DEFAULT_COHORT_QUESTIONS ids, plus a LONG and a SHORT text) */
export const BE_ANSWER_QUESTION_IDS = { web3: "web3_experience", interest: "interest_areas", longText: "why", shortText: "nick" } as const;
export const BE_OK_ANSWERS = [{ questionId: "web3_experience", choices: ["Y1_3"] }, { questionId: "interest_areas", choices: ["KOL", "DEVELOPER"] }];
/** validateAnswers `it.each` rejects (COHORT_ANSWERS_INVALID): [name, answers] */
export const BE_ANSWERS_REJECTED: ReadonlyArray<readonly [string, ReadonlyArray<Record<string, unknown>>]> = [
  ["unknown question", [...BE_OK_ANSWERS, { questionId: "ghost", text: "x" }]],
  ["unknown option", [{ questionId: "web3_experience", choices: ["NOPE"] }, BE_OK_ANSWERS[1]]],
  ["missing required question", [BE_OK_ANSWERS[0]]],
  ["empty choices on a required question", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: [] }]],
  ["two choices on SINGLE_CHOICE", [{ questionId: "web3_experience", choices: ["LT_1Y", "Y1_3"] }, BE_OK_ANSWERS[1]]],
  ["duplicate question answers", [...BE_OK_ANSWERS, BE_OK_ANSWERS[0]]],
  ["duplicate choice ids", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["KOL", "KOL"] }]],
  ["SHORT_TEXT with a newline", [...BE_OK_ANSWERS, { questionId: "nick", text: "a\nb" }]],
  ["SHORT_TEXT over 200 code points", [...BE_OK_ANSWERS, { questionId: "nick", text: "x".repeat(201) }]],
  ["LONG_TEXT over 2000 code points", [...BE_OK_ANSWERS, { questionId: "why", text: "x".repeat(2001) }]],
  ["LONG_TEXT with a bidi override", [...BE_OK_ANSWERS, { questionId: "why", text: "a‮b" }]],
  ["choices on a text question", [...BE_OK_ANSWERS, { questionId: "why", text: "x", choices: ["a"] }]],
  ["text on a choice question", [{ questionId: "web3_experience", choices: ["Y1_3"], text: "x" }, BE_OK_ANSWERS[1]]],
  // COHORT_OTHER_DETAIL_REQUIRED rows ("withDetail option needs other")
  ["withDetail option without other", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["OTHER"] }]],
  ["withDetail option with a blank other", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["OTHER"], other: "   " }]],
  ["withDetail option with a 61 character other", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["OTHER"], other: "x".repeat(61) }]],
];
/** validateAnswers accepts: [name, answers] */
export const BE_ANSWERS_ACCEPTED: ReadonlyArray<readonly [string, ReadonlyArray<Record<string, unknown>>]> = [
  ["a complete answer set", BE_OK_ANSWERS],
  ["answers in any order, with a long answer", [{ questionId: "interest_areas", choices: ["KOL", "DEVELOPER"] }, { questionId: "web3_experience", choices: ["Y1_3"] }, { questionId: "why", text: "  이유\n있음 " }]],
  ["a blank optional answer", [...BE_OK_ANSWERS, { questionId: "nick", text: "   " }]],
  ["a 200 code point short answer", [...BE_OK_ANSWERS, { questionId: "nick", text: "😀".repeat(200) }]],
  ["a detail with the withDetail option", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["KOL", "OTHER"], other: " UX 리서치 " }]],
  ["a detail nobody asked for", [BE_OK_ANSWERS[0], { questionId: "interest_areas", choices: ["KOL"], other: "ignored" }]],
];

const lt = (ko: string) => ({ ko });
type QuestionInputRow = Record<string, unknown>;
const choice = (overrides: QuestionInputRow = {}): QuestionInputRow => ({
  type: "SINGLE_CHOICE", label: lt("질문"), required: true, options: [{ label: lt("가") }, { label: lt("나") }], ...overrides,
});
/** validateQuestions `it.each` rejects that need no stored questions (COHORT_QUESTIONS_INVALID): [name, questions] */
export const BE_QUESTIONS_REJECTED: ReadonlyArray<readonly [string, readonly QuestionInputRow[]]> = [
  ["1 option", [choice({ options: [{ label: lt("a") }] })]],
  ["21 options", [choice({ options: Array.from({ length: 21 }, (_, i) => ({ label: lt(`o${i}`) })) })]],
  ["two withDetail options", [choice({ options: [{ label: lt("a"), withDetail: true }, { label: lt("b"), withDetail: true }] })]],
  ["blank label.ko", [choice({ label: lt("   ") })]],
  ["201 character label.ko", [choice({ label: lt("가".repeat(201)) })]],
  ["newline in label", [choice({ label: lt("a\nb") })]],
  ["201 character label.en", [choice({ label: { ko: "ok", en: "x".repeat(201) } })]],
  ["61 character option label", [choice({ options: [{ label: lt("가".repeat(61)) }, { label: lt("b") }] })]],
  ["501 character help", [choice({ help: lt("가".repeat(501)) })]],
  ["31 questions", Array.from({ length: 31 }, () => ({ type: "SHORT_TEXT", label: lt("q"), required: false }))],
];
/** "accepts 30 questions and 20 options and counts code points" */
export const BE_QUESTIONS_ACCEPTED: ReadonlyArray<readonly [string, readonly QuestionInputRow[]]> = [
  ["30 questions", Array.from({ length: 30 }, () => ({ type: "SHORT_TEXT", label: lt("q"), required: false }))],
  ["20 options", [choice({ options: Array.from({ length: 20 }, (_, i) => ({ label: lt(`o${i}`) })) })]],
  ["a 200 code point emoji label", [choice({ label: lt("😀".repeat(200)) })]],
];
