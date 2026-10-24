// 바운티 액션 패널 화면 선택 규칙(`lib/bounty-action-state.ts deriveActionView`)을 문서화하는 표 테스트.
// 규칙을 바꾸면 여기 표의 해당 행을 같이 고친다. 각 행 = "이 상황이면 이 화면" 한 줄.
// 렌더링(문구·링크)은 `bounty-action-panel.test.tsx` / `bounty-action-panel-matrix.test.tsx`가 검사한다.
import { describe, expect, it } from "vitest";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import {
  bountyActionErrorCopy,
  deriveActionView,
  splitRows,
  type BountyActionInput,
  type BountyActionView,
} from "@/lib/bounty-action-state";
import type { AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import { MockApiError } from "@/lib/mocks/mock-error";

type AppRow = Pick<AccountApplication, "bountySlug" | "status" | "agent">;
type SubRow = Pick<AccountSubmission, "bountySlug" | "status" | "agent">;

const BOUNTY = "bounty-1";
const bot = { id: "agent-1", name: "Scout" };
const app = (status: AppRow["status"], agent: AppRow["agent"] = null, bountySlug = BOUNTY): AppRow => ({ bountySlug, status, agent });
const sub = (status: SubRow["status"], agent: SubRow["agent"] = null, bountySlug = BOUNTY): SubRow => ({ bountySlug, status, agent });
const loaded = <T,>(data: T[]) => ({ loading: false, unavailable: false, data });
const loading = { loading: true, unavailable: false, data: null };
const unavailable = { loading: false, unavailable: true, data: null };

/** 기본값: 로그인, 진행 중, 직접 제출 바운티(지원 불필요), 내 행 없음, 로컬 플래그 없음 */
function input(overrides: Partial<BountyActionInput> = {}): BountyActionInput {
  return {
    bountyId: BOUNTY,
    applicationRequired: false,
    status: "active",
    submissionMode: "direct",
    auth: "signed-in",
    applications: loaded<AppRow>([]),
    submissions: loaded<SubRow>([]),
    applied: false,
    submitted: false,
    ...overrides,
  };
}

const firstSubmit: BountyActionView = { kind: "submitForm", revising: false, inReview: false };
const updateSubmit: BountyActionView = { kind: "submitForm", revising: false, inReview: true };
const resubmit: BountyActionView = { kind: "submitForm", revising: true, inReview: false };

const table: Array<[string, Partial<BountyActionInput>, BountyActionView]> = [
  // 1. 마감 + (에이전트 바운티 | 비로그인) → 계정 상태 없이 마감 안내
  ["reviewing bounty, signed out", { status: "reviewing", auth: "signed-out" }, { kind: "closed", reason: "reviewing" }],
  ["closed bounty, signed out", { status: "closed", auth: "signed-out" }, { kind: "closed", reason: "closed" }],
  ["closed agent bounty, signed in", { status: "closed", submissionMode: "agent" }, { kind: "closed", reason: "closed" }],
  ["reviewing agent bounty, still loading session", { status: "reviewing", submissionMode: "agent", auth: "loading" }, { kind: "closed", reason: "reviewing" }],
  // 2. 에이전트 전용 바운티 → Agent API 안내 (로그인 여부·내 행과 무관)
  ["agent bounty that needs an application", { submissionMode: "agent", applicationRequired: true, auth: "signed-out" }, { kind: "agentMode", endpoint: "applications" }],
  ["agent bounty with direct submissions", { submissionMode: "agent", submissions: loaded([sub("approved")]) }, { kind: "agentMode", endpoint: "submissions" }],
  // 3. 세션
  ["session still loading", { auth: "loading" }, { kind: "checkingSession" }],
  ["session loading on a closed bounty (a revision may still be resubmittable)", { auth: "loading", status: "closed" }, { kind: "checkingSession" }],
  ["signed out on an active bounty", { auth: "signed-out", applicationRequired: true }, { kind: "signedOut" }],
  // 4. 내 행 조회
  ["submissions loading", { submissions: loading }, { kind: "checkingStatus" }],
  ["applications loading on an apply bounty", { applicationRequired: true, applications: loading }, { kind: "checkingStatus" }],
  ["applications loading is ignored when no application is needed", { applications: loading }, firstSubmit],
  ["submissions unavailable", { submissions: unavailable }, { kind: "statusUnavailable" }],
  ["applications unavailable on an apply bounty", { applicationRequired: true, applications: unavailable }, { kind: "statusUnavailable" }],
  ["applications unavailable is ignored when no application is needed", { applications: unavailable }, firstSubmit],
  // 5. 에이전트만 참여 → 폼 없이 안내 (제출 행이 지원 행보다 우선)
  ["only an agent applied", { applicationRequired: true, applications: loaded([app("open", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application" }],
  ["only an agent submitted", { submissions: loaded([sub("submitted", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission" }],
  ["agent applied and submitted", { applications: loaded([app("submitted", bot)]), submissions: loaded([sub("in_review", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission" }],
  ["agent applied on a no-application bounty still hides the form", { applications: loaded([app("open", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application" }],
  ["agent row on a closed bounty (signed in)", { status: "closed", submissions: loaded([sub("approved", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission" }],
  ["own row beside the agent row wins", { applicationRequired: true, applications: loaded([app("open", bot), app("rejected")]) }, { kind: "applicationRejected" }],
  ["just applied here beside an agent row", { applicationRequired: true, applied: true, applications: loaded([app("open", bot)]) }, { kind: "applicationUnderReview" }],
  ["just submitted here beside an agent row", { submitted: true, submissions: loaded([sub("in_review", bot)]) }, updateSubmit],
  // 6. 지원 단계
  ["apply bounty, no application yet", { applicationRequired: true }, { kind: "applyForm" }],
  ["apply bounty, no application, reviewing", { applicationRequired: true, status: "reviewing" }, { kind: "closed", reason: "reviewing" }],
  ["apply bounty, no application, closed", { applicationRequired: true, status: "closed" }, { kind: "closed", reason: "closed" }],
  ["rows for other bounties do not count", { applicationRequired: true, applications: loaded([app("approved", null, "other")]) }, { kind: "applyForm" }],
  ["application rejected", { applicationRequired: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["rejection beats the local applied flag", { applicationRequired: true, applied: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["application under review", { applicationRequired: true, applications: loaded([app("open")]) }, { kind: "applicationUnderReview" }],
  ["just applied (server row not re-read yet)", { applicationRequired: true, applied: true }, { kind: "applicationUnderReview" }],
  ["just applied on a closed bounty", { applicationRequired: true, applied: true, status: "closed" }, { kind: "applicationUnderReview" }],
  ["application approved → submit form", { applicationRequired: true, applications: loaded([app("approved")]) }, firstSubmit],
  ["application approved, bounty reviewing, nothing submitted", { applicationRequired: true, status: "reviewing", applications: loaded([app("approved")]) }, { kind: "closed", reason: "reviewing" }],
  // 7. 확정된 제출
  ["submission approved", { submissions: loaded([sub("approved")]) }, { kind: "submissionApproved" }],
  ["submission approved on a closed bounty", { status: "closed", submissions: loaded([sub("approved")]) }, { kind: "submissionApproved" }],
  ["submission rejected", { submissions: loaded([sub("rejected")]) }, { kind: "submissionRejected" }],
  ["submission rejected after an approved application", { applicationRequired: true, applications: loaded([app("completed")]), submissions: loaded([sub("rejected")]) }, { kind: "submissionRejected" }],
  // 8. 진행 중이 아님
  ["reviewing, submission pending", { status: "reviewing", submissions: loaded([sub("in_review")]) }, { kind: "inReviewLocked" }],
  ["closed, submission resubmitted", { status: "closed", submissions: loaded([sub("resubmitted")]) }, { kind: "inReviewLocked" }],
  ["reviewing, just submitted", { status: "reviewing", submitted: true }, { kind: "inReviewLocked" }],
  ["reviewing, nothing submitted", { status: "reviewing" }, { kind: "closed", reason: "reviewing" }],
  ["closed, revision requested (BE answers BOUNTY_REVIEW_CLOSED)", { status: "closed", submissions: loaded([sub("revision_requested")]) }, { kind: "closed", reason: "closed" }],
  // 9. 제출 폼
  ["first submission", {}, firstSubmit],
  ["submission pending → update form", { submissions: loaded([sub("submitted")]) }, updateSubmit],
  ["submission in review → update form", { submissions: loaded([sub("in_review")]) }, updateSubmit],
  ["just submitted (server row not re-read yet)", { submitted: true }, updateSubmit],
  ["revision requested", { submissions: loaded([sub("revision_requested")]) }, resubmit],
  ["revision requested on a reviewing bounty (BE still accepts it)", { status: "reviewing", submissions: loaded([sub("revision_requested")]) }, resubmit],
  ["revision requested and just resubmitted", { submitted: true, submissions: loaded([sub("revision_requested")]) }, { kind: "submitForm", revising: true, inReview: true }],
];

describe("deriveActionView — which bounty action section to show", () => {
  it.each(table)("%s", (_label, overrides, expected) => {
    expect(deriveActionView(input(overrides))).toEqual(expected);
  });

  it("covers every view kind at least once", () => {
    const kinds = new Set(table.map(([, , view]) => view.kind));
    expect([...kinds].sort()).toEqual([
      "agentMode", "agentRow", "applicationRejected", "applicationUnderReview", "applyForm", "checkingSession", "checkingStatus",
      "closed", "inReviewLocked", "signedOut", "statusUnavailable", "submissionApproved", "submissionRejected", "submitForm",
    ]);
  });
});

describe("splitRows — the owner's own row and an agent row never stand in for each other", () => {
  it("picks the first row of each kind", () => {
    const own = app("open");
    const agent = app("approved", bot);
    expect(splitRows([agent, own])).toEqual({ own, agent });
    expect(splitRows([own])).toEqual({ own, agent: undefined });
    expect(splitRows(undefined)).toEqual({ own: undefined, agent: undefined });
  });
});

describe("bountyActionErrorCopy — bounties.action.errors key for a failed apply/submit", () => {
  it.each(ERROR_COPY.bountyAction.codes)("a listed code uses its own key: %s", (code) => {
    expect(bountyActionErrorCopy(new ApiHttpError(400, code))).toEqual({ key: code });
  });

  it("mock-mode errors take the same path", () => {
    expect(bountyActionErrorCopy(new MockApiError(409, "ALREADY_APPLIED"))).toEqual({ key: "ALREADY_APPLIED" });
  });

  it("an unlisted BE code shows `unknown` with the raw code", () => {
    expect(bountyActionErrorCopy(new ApiHttpError(409, "BOUNTY_REVIEW_CLOSED"))).toEqual({ key: "unknown", code: "BOUNTY_REVIEW_CLOSED" });
  });

  it("a non-HTTP failure (network, wallet) falls back to `generic`", () => {
    expect(bountyActionErrorCopy(new TypeError("Failed to fetch"))).toEqual({ key: "generic" });
    expect(bountyActionErrorCopy({ code: "ALREADY_APPLIED" })).toEqual({ key: "generic" });
  });
});
