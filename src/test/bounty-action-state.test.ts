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
type SubRow = Pick<AccountSubmission, "bountySlug" | "status" | "agent"> & Partial<Pick<AccountSubmission, "reviewComment">>;

const BOUNTY = "bounty-1";
const bot = { id: "agent-1", name: "Scout" };
const app = (status: AppRow["status"], agent: AppRow["agent"] = null, bountySlug = BOUNTY): AppRow => ({ bountySlug, status, agent });
const sub = (status: SubRow["status"], agent: SubRow["agent"] = null, bountySlug = BOUNTY, reviewComment?: string | null): SubRow => ({ bountySlug, status, agent, reviewComment });
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
  ["closed agent bounty, signed in, no agent row", { status: "closed", submissionMode: "agent" }, { kind: "closed", reason: "closed" }],
  ["reviewing agent bounty, still loading session", { status: "reviewing", submissionMode: "agent", auth: "loading" }, { kind: "closed", reason: "reviewing" }],
  // 2. 에이전트 전용 바운티 → Agent API 안내 (로그인 여부·내 행과 무관)
  ["agent bounty that needs an application", { submissionMode: "agent", applicationRequired: true, auth: "signed-out" }, { kind: "agentMode", endpoint: "applications" }],
  ["agent bounty with direct submissions", { submissionMode: "agent", submissions: loaded([sub("approved")]) }, { kind: "agentMode", endpoint: "submissions" }],
  // 3. 세션
  ["session still loading", { auth: "loading" }, { kind: "checkingSession" }],
  ["session loading on a closed bounty (a revision may still be resubmittable)", { auth: "loading", status: "closed" }, { kind: "checkingSession" }],
  ["signed out on an active bounty", { auth: "signed-out", applicationRequired: true }, { kind: "signedOut" }],
  // 2b. 지원 마감 후엔 비로그인에게도 지원 CTA가 없다
  ["signed out, application deadline passed", { auth: "signed-out", applicationRequired: true, applicationClosed: true }, { kind: "closed", reason: "applications" }],
  ["signed out, application deadline passed but no application needed", { auth: "signed-out", applicationRequired: false, applicationClosed: true }, { kind: "signedOut" }],
  // 4. 내 행 조회
  ["submissions loading", { submissions: loading }, { kind: "checkingStatus" }],
  ["applications loading on an apply bounty", { applicationRequired: true, applications: loading }, { kind: "checkingStatus" }],
  ["applications loading is ignored when no application is needed", { applications: loading }, firstSubmit],
  ["submissions unavailable", { submissions: unavailable }, { kind: "statusUnavailable" }],
  ["applications unavailable on an apply bounty", { applicationRequired: true, applications: unavailable }, { kind: "statusUnavailable" }],
  ["applications unavailable is ignored when no application is needed", { applications: unavailable }, firstSubmit],
  // 5. 에이전트만 참여 → 폼 없이 안내 (제출 행이 지원 행보다 우선)
  ["only an agent applied", { applicationRequired: true, applications: loaded([app("open", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application", state: "applied" }],
  ["only an agent submitted", { submissions: loaded([sub("submitted", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "submitted" }],
  ["agent applied and submitted", { applications: loaded([app("submitted", bot)]), submissions: loaded([sub("in_review", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "submitted" }],
  ["agent applied on a no-application bounty still hides the form", { applications: loaded([app("open", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application", state: "applied" }],
  ["agent row on a closed bounty (signed in)", { status: "closed", submissions: loaded([sub("approved", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "approved" }],
  ["agent submission with a revision request (direct bounty)", { submissions: loaded([sub("revision_requested", bot, BOUNTY, "add a README")]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "revisionRequested", review: { forfeited: false, text: "add a README" } }],
  ["agent submission rejected, forfeited", { submissions: loaded([sub("rejected", bot, BOUNTY, "forfeited: wallet never connected")]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "rejected", review: { forfeited: true, text: "wallet never connected" } }],
  ["agent submission approved carries the payout status", { submissions: loaded([{ ...sub("approved", bot), paymentStatus: "PAID" as const }]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "approved", payout: "PAID" }],
  ["agent application rejected", { applicationRequired: true, applications: loaded([app("rejected", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application", state: "applicationRejected" }],
  // 2. 에이전트 전용 바운티: 내 에이전트의 진행 상태가 안내보다 우선
  ["agent bounty, my agent has a revision request", { submissionMode: "agent", submissions: loaded([sub("revision_requested", bot, BOUNTY, "fix the link")]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "revisionRequested", review: { forfeited: false, text: "fix the link" } }],
  ["agent bounty, revision request after the bounty closed", { submissionMode: "agent", status: "closed", submissions: loaded([sub("revision_requested", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "submission", state: "revisionRequested" }],
  ["agent bounty, my agent applied", { submissionMode: "agent", applicationRequired: true, applications: loaded([app("open", bot)]) }, { kind: "agentRow", agentName: "Scout", row: "application", state: "applied" }],
  ["agent bounty, my agent was approved but has not submitted", { submissionMode: "agent", applicationRequired: true, applications: loaded([app("approved", bot)]) }, { kind: "agentMode", endpoint: "submissions" }],
  ["agent bounty, status still loading", { submissionMode: "agent", submissions: loading }, { kind: "checkingStatus" }],
  ["agent bounty, status unavailable falls back to the guide", { submissionMode: "agent", submissions: unavailable }, { kind: "agentMode", endpoint: "submissions" }],
  ["own row beside the agent row wins", { applicationRequired: true, applications: loaded([app("open", bot), app("rejected")]) }, { kind: "applicationRejected" }],
  ["just applied here beside an agent row", { applicationRequired: true, applied: true, applications: loaded([app("open", bot)]) }, { kind: "applicationUnderReview" }],
  ["just submitted here beside an agent row", { submitted: true, submissions: loaded([sub("in_review", bot)]) }, updateSubmit],
  // 6. 지원 단계
  ["apply bounty, no application yet", { applicationRequired: true }, { kind: "applyForm" }],
  ["apply bounty, no application, reviewing", { applicationRequired: true, status: "reviewing" }, { kind: "closed", reason: "reviewing" }],
  ["apply bounty, no application, closed", { applicationRequired: true, status: "closed" }, { kind: "closed", reason: "closed" }],
  ["apply bounty past its application deadline, no application yet", { applicationRequired: true, applicationClosed: true }, { kind: "closed", reason: "applications" }],
  ["apply bounty past its application deadline, approved applicant still submits", { applicationRequired: true, applicationClosed: true, applications: loaded([app("approved")]) }, firstSubmit],
  ["rows for other bounties do not count", { applicationRequired: true, applications: loaded([app("approved", null, "other")]) }, { kind: "applyForm" }],
  ["application rejected", { applicationRequired: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["application rejected with the operator's note", { applicationRequired: true, applications: loaded([{ ...app("rejected"), reviewNote: "Portfolio too thin" }]) }, { kind: "applicationRejected", note: "Portfolio too thin" }],
  ["application auto-rejected by a cancelled bounty", { status: "closed", closedReason: "cancelled", applicationRequired: true, applications: loaded([app("rejected")]) }, { kind: "closed", reason: "cancelled" }],
  ["rejection on a completed bounty stays a rejection", { status: "closed", closedReason: "completed", applicationRequired: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["rejection on a bounty only past its deadline stays a rejection", { status: "closed", closedReason: "deadline", applicationRequired: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["rejection beats the local applied flag", { applicationRequired: true, applied: true, applications: loaded([app("rejected")]) }, { kind: "applicationRejected" }],
  ["application under review", { applicationRequired: true, applications: loaded([app("open")]) }, { kind: "applicationUnderReview" }],
  ["the local applied flag does not hide an approved server row", { applicationRequired: true, applied: true, applications: loaded([app("approved")]) }, firstSubmit],
  ["just applied (server row not re-read yet)", { applicationRequired: true, applied: true }, { kind: "applicationUnderReview" }],
  ["just applied on a closed bounty", { applicationRequired: true, applied: true, status: "closed" }, { kind: "applicationUnderReview" }],
  ["application approved → submit form", { applicationRequired: true, applications: loaded([app("approved")]) }, firstSubmit],
  ["application approved, bounty reviewing, nothing submitted", { applicationRequired: true, status: "reviewing", applications: loaded([app("approved")]) }, { kind: "closed", reason: "reviewing" }],
  ["pending application on an ended bounty (completed/cancelled) is shown as closed", { applicationRequired: true, status: "closed", applications: loaded([app("open")]) }, { kind: "closed", reason: "closed" }],
  ["pending application on a bounty that moved to SUBMISSION_CLOSED / IN_REVIEW can no longer unlock a submission", { applicationRequired: true, status: "reviewing", applications: loaded([app("open")]) }, { kind: "closed", reason: "reviewing" }],
  ["pending application on a bounty closed only by its deadline is still under review", { applicationRequired: true, status: "closed", closedReason: "deadline", applications: loaded([app("open")]) }, { kind: "applicationUnderReview" }],
  // 7. 확정된 제출
  ["submission approved", { submissions: loaded([sub("approved")]) }, { kind: "submissionApproved" }],
  ["submission approved carries its payout status", { submissions: loaded([{ ...sub("approved"), paymentStatus: "PARTIALLY_PAID" as const }]) }, { kind: "submissionApproved", payout: "PARTIALLY_PAID" }],
  ["submission approved on a closed bounty", { status: "closed", submissions: loaded([sub("approved")]) }, { kind: "submissionApproved" }],
  ["submission rejected", { submissions: loaded([sub("rejected")]) }, { kind: "submissionRejected" }],
  ["submission rejected after an approved application", { applicationRequired: true, applications: loaded([app("completed")]), submissions: loaded([sub("rejected")]) }, { kind: "submissionRejected" }],
  ["submission rejected with a reviewer comment", { submissions: loaded([sub("rejected", null, BOUNTY, "does not meet the brief")]) }, { kind: "submissionRejected", review: { forfeited: false, text: "does not meet the brief" } }],
  ["submission rejected, forfeited award (prefix stripped)", { submissions: loaded([sub("rejected", null, BOUNTY, "forfeited: winner wallet never connected")]) }, { kind: "submissionRejected", review: { forfeited: true, text: "winner wallet never connected" } }],
  ["submission rejected with a blank comment", { submissions: loaded([sub("rejected", null, BOUNTY, "   ")]) }, { kind: "submissionRejected" }],
  // 8. 진행 중이 아님
  ["reviewing, submission pending", { status: "reviewing", submissions: loaded([sub("in_review")]) }, { kind: "inReviewLocked" }],
  ["closed only by the deadline, submission resubmitted (the sponsor can still review)", { status: "closed", closedReason: "deadline", submissions: loaded([sub("resubmitted")]) }, { kind: "inReviewLocked" }],
  ["cancelled bounty, submission pending: nobody is reviewing it", { status: "closed", closedReason: "cancelled", submissions: loaded([sub("submitted")]) }, { kind: "closed", reason: "cancelled" }],
  ["cancelled bounty, submission in review", { status: "closed", closedReason: "cancelled", submissions: loaded([sub("in_review")]) }, { kind: "closed", reason: "cancelled" }],
  ["reviewing, just submitted", { status: "reviewing", submitted: true }, { kind: "inReviewLocked" }],
  ["reviewing, nothing submitted", { status: "reviewing" }, { kind: "closed", reason: "reviewing" }],
  ["cancelled, revision requested (BE answers BOUNTY_REVIEW_CLOSED)", { status: "closed", closedReason: "cancelled", submissions: loaded([sub("revision_requested")]) }, { kind: "closed", reason: "cancelled" }],
  ["closedReason alone drives a deadline-only close (no other flag): revision stays resubmittable", { status: "closed", closedReason: "deadline", submissions: loaded([sub("revision_requested")]) }, { kind: "submitForm", revising: true, inReview: false }],
  ["completed, revision requested (BE answers BOUNTY_REVIEW_CLOSED)", { status: "closed", closedReason: "completed", submissions: loaded([sub("revision_requested")]) }, { kind: "closed", reason: "closed" }],
  ["closed only by the deadline, revision requested (BE still resubmittable)", { status: "closed", closedReason: "deadline", submissions: loaded([sub("revision_requested")]) }, { kind: "submitForm", revising: true, inReview: false }],
  ["closed only by the deadline, nothing submitted", { status: "closed", closedReason: "deadline" }, { kind: "closed", reason: "closed" }],
  // 9. 제출 폼
  ["first submission", {}, firstSubmit],
  ["submission pending → update form", { submissions: loaded([sub("submitted")]) }, updateSubmit],
  ["submission in review → update form", { submissions: loaded([sub("in_review")]) }, updateSubmit],
  ["just submitted (server row not re-read yet)", { submitted: true }, updateSubmit],
  ["revision requested", { submissions: loaded([sub("revision_requested")]) }, resubmit],
  ["revision requested with a reviewer comment", { submissions: loaded([sub("revision_requested", null, BOUNTY, "add a README")]) }, { kind: "submitForm", revising: true, inReview: false, revisionComment: "add a README" }],
  ["revision requested on a reviewing bounty (BE still accepts it)", { status: "reviewing", submissions: loaded([sub("revision_requested")]) }, resubmit],
  ["revision requested and just resubmitted", { submitted: true, submissions: loaded([sub("revision_requested")]) }, { kind: "submitForm", revising: true, inReview: true }],
];

describe("deriveActionView - which bounty action section to show", () => {
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

describe("splitRows - the owner's own row and an agent row never stand in for each other", () => {
  it("picks the first row of each kind", () => {
    const own = app("open");
    const agent = app("approved", bot);
    expect(splitRows([agent, own])).toEqual({ own, agent });
    expect(splitRows([own])).toEqual({ own, agent: undefined });
    expect(splitRows(undefined)).toEqual({ own: undefined, agent: undefined });
  });
});

describe("bountyActionErrorCopy - bounties.action.errors key for a failed apply/submit", () => {
  it.each(ERROR_COPY.bountyAction.codes)("a listed code uses its own key: %s", (code) => {
    expect(bountyActionErrorCopy(new ApiHttpError(400, code))).toEqual({ key: code });
  });

  it.each([
    [["submissionUrl must be a public http(s) URL (no localhost or private addresses)"], "VALIDATION_URL"],
    [["message should not be empty"], "VALIDATION_TEXT_REQUIRED"],
    [["description must be shorter than or equal to 5000 characters"], "VALIDATION_TOO_LONG"],
    [["commitSha must be a hex git commit hash (4 to 64 hex characters)"], "VALIDATION_COMMIT_SHA"],
    [["commitSha must be shorter than or equal to 64 characters"], "VALIDATION_COMMIT_SHA"],
    [["something else must be odd"], "VALIDATION_FAILED"],
  ])("a 400 VALIDATION_FAILED names the problem: %j -> %s", (details, key) => {
    expect(bountyActionErrorCopy(new ApiHttpError(400, "VALIDATION_FAILED", details))).toEqual({ key });
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

describe("bountyActionErrorCopy: throttled requests", () => {
  it("shows the too-many-requests copy, not the raw throttler text, for a 429", () => {
    expect(bountyActionErrorCopy(new ApiHttpError(429, "ThrottlerException: Too Many Requests"))).toEqual({ key: "TOO_MANY_REQUESTS" });
  });
});
