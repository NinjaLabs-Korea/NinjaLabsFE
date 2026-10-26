/**
 * 바운티 상세의 액션 패널(`components/bounties/BountyActionPanel.tsx`)이 **어떤 화면을 보여 줄지** 정하는 규칙의 유일한 정의 위치.
 * React·번역·네트워크 없이 입력 → 태그 결과(`BountyActionView`)만 계산하는 순수 함수다. 컴포넌트는 `view.kind`로 switch해서 그리기만 한다.
 *
 * 규칙은 위에서 아래로 **첫 번째로 맞는 것**이 이긴다 (순서 자체가 규칙이다):
 *  1. 진행 중이 아닌 바운티(`reviewing`/`closed`) + 비로그인 → `closed`
 *     (로그인 사용자는 아래로 내려간다: 수정 요청받은 제출은 마감 후에도 재제출할 수 있다)
 *  2. 에이전트 전용 바운티: 로그인 전 → `agentMode`(진행 중) / `closed`; 로그인 후 내 에이전트의 행이 있으면 `agentRow`
 *     (지원 상태·제출 상태·수정 요청·지급 배지), 없으면 `agentMode`(Agent API 엔드포인트 안내) / `closed`.
 *     행 조회 중이면 `checkingStatus`, 조회 실패면 행 없음으로 본다(안내는 계정 상태 없이도 유효하다).
 *  3. 세션 확인 중 → `checkingSession`, 비로그인 → `signedOut`
 *  4. 내 제출(+지원 필요 바운티면 내 지원) 조회 중 → `checkingStatus`, 조회 실패 → `statusUnavailable`
 *  5. 내 직접 행은 없고 에이전트가 만든 행만 있음 → `agentRow` (직접 지원/제출 폼을 띄우지 않는다)
 *  6. 지원 필요 바운티: 지원 전 → `applyForm`(진행 중이고 지원 마감 전일 때만, 아니면 `closed`) / 거절 → `applicationRejected` /
 *     방금 지원했거나 심사 중(`open`) → `applicationUnderReview`(바운티가 완료/취소로 끝났으면 `closed`) / 승인 등 → 7로 내려간다
 *  7. 제출 승인 → `submissionApproved`, 제출 거절 → `submissionRejected`
 *  8. 진행 중이 아니고 수정 요청도 아님 → 심사 중인 제출이 있으면 `inReviewLocked`, 없으면 `closed`
 *  9. 나머지 → `submitForm` (처음 제출 / 심사 중 수정 / 수정 요청 재제출)
 *
 * ## 어디를 고치나
 * - **화면 선택 규칙**: 이 파일의 `deriveActionView`만 고친다. `src/test/bounty-action-state.test.ts`의 표에 행을 추가/수정한다.
 * - **새 화면 종류**: `BountyActionView`에 태그를 추가하면 컴포넌트의 switch가 tsc로 누락을 알려 준다.
 * - **문구·마크업**: 컴포넌트와 `messages/{en,ko,zh}/bounties.json`의 `bounties.action`.
 * - **에러 문구 코드 목록**: `lib/api/error-copy.ts`의 `ERROR_COPY.bountyAction` (아래 `bountyActionErrorCopy`가 읽는다).
 */
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import type { AccountAgentRef, AccountApplication, AccountSubmission, SubmissionStatus } from "@/lib/contracts/account";
import type { AuthStatus } from "@/lib/contracts/auth";
import { parseReviewComment, type ReviewNote } from "@/lib/review-comment";
import type { Bounty, PayoutStatus } from "@/lib/types";

/**
 * What the owner's agent has reached on this bounty (`agentRow.state`). Submissions win over applications:
 * `submitted` = waiting for review, `revisionRequested` = the agent must resubmit through the Agent API.
 */
export type AgentRowState = "applied" | "applicationRejected" | "applicationApproved" | "submitted" | "revisionRequested" | "approved" | "rejected";

/** 심사 대기 중인 제출 상태 — 이 상태의 제출이 있으면 "심사 중" 화면/문구를 쓴다. */
export const PENDING_SUBMISSION_STATUSES: readonly SubmissionStatus[] = ["submitted", "resubmitted", "in_review"];

type ApplicationRow = Pick<AccountApplication, "bountySlug" | "status" | "agent"> & Partial<Pick<AccountApplication, "reviewNote">>;
type SubmissionRow = Pick<AccountSubmission, "bountySlug" | "status" | "agent"> & Partial<Pick<AccountSubmission, "reviewComment" | "paymentStatus">>;

/** `useAccountQuery` 결과 중 이 규칙이 읽는 부분. `data`는 내 전체 행(모든 바운티)이다. */
export type AccountRowsQuery<T> = { loading: boolean; unavailable: boolean; data: readonly T[] | null };

export type BountyActionInput = {
  bountyId: string;
  applicationRequired: boolean;
  status: Bounty["status"];
  submissionMode: "direct" | "agent";
  /** `Bounty.applicationClosed`: the application deadline passed, so a first application is refused. */
  applicationClosed?: boolean;
  /** `Bounty.deadlinePassed`: `status` is `closed` only because the deadline passed; a requested revision is still resubmittable. */
  deadlinePassed?: boolean;
  auth: AuthStatus;
  applications: AccountRowsQuery<ApplicationRow>;
  submissions: AccountRowsQuery<SubmissionRow>;
  /** 이 화면에서 방금 지원/제출에 성공함 (서버 재조회가 끝나기 전에도 결과 화면을 보여 주는 로컬 플래그) */
  applied: boolean;
  submitted: boolean;
};

export type BountyActionView =
  /** 새 지원/제출을 받지 않음. `reason`이 본문 문구를 고른다 (`reviewingBody` / `closedBody`). */
  | { kind: "closed"; reason: "reviewing" | "closed" }
  /** 에이전트 전용 바운티 — `POST /agent-api/v1/bounties/{id}/{endpoint}` 안내 */
  | { kind: "agentMode"; endpoint: "applications" | "submissions" }
  | { kind: "checkingSession" }
  /** Figma 15/15v 비로그인 화면 (로그인 필요 배지 + 비활성 폼 미리보기) */
  | { kind: "signedOut" }
  | { kind: "checkingStatus" }
  | { kind: "statusUnavailable" }
  /**
   * 에이전트만 이 바운티에 참여함 — `row`는 에이전트가 제출까지 했는지(우선) 지원만 했는지, `state`는 그 행의 진행 상태.
   * `review`: 심사자 코멘트(수정 요청·거절·몰수), `payout`: 승인된 제출의 지급 상태. 없으면 생략.
   */
  | { kind: "agentRow"; agentName: string; row: "submission" | "application"; state: AgentRowState; review?: ReviewNote; payout?: PayoutStatus }
  | { kind: "applyForm" }
  /** `note`: what the operator wrote when rejecting (the admin form says the applicant sees it); omitted when none. */
  | { kind: "applicationRejected"; note?: string }
  | { kind: "applicationUnderReview" }
  /** `payout`: the submission's payout status (`lib/payout.ts payoutBadge` decides what shows); omitted when unknown. */
  | { kind: "submissionApproved"; payout?: PayoutStatus }
  /** `review`: 심사자 코멘트 (없으면 생략). `forfeited`면 승인됐지만 수상이 몰수된 건이다. */
  | { kind: "submissionRejected"; review?: ReviewNote }
  /** 마감 후 심사 중 — 폼 없이 안내만 */
  | { kind: "inReviewLocked" }
  /**
   * 제출 폼. `revising`(수정 요청 재제출)이 제목/버튼에서 `inReview`(심사 중 수정)보다 우선하고, 둘 다 false면 첫 제출이다.
   * 안내 문구는 각각 독립적으로 붙는다 (방금 제출한 직후의 수정 요청 행처럼 둘 다 true일 수 있다).
   */
  | { kind: "submitForm"; revising: boolean; inReview: boolean; revisionComment?: string };

export type BountyActionViewKind = BountyActionView["kind"];

/** 내 직접 행(`agent: null`)과 에이전트가 만든 행을 따로 고른다. 둘은 서로를 대신하지 않는다. */
export function splitRows<T extends { agent: AccountAgentRef | null }>(rows: readonly T[] | undefined): { own: T | undefined; agent: T | undefined } {
  return { own: rows?.find((row) => row.agent === null), agent: rows?.find((row) => row.agent !== null) };
}

const AGENT_SUBMISSION_STATE: Record<SubmissionStatus, AgentRowState> = {
  submitted: "submitted",
  resubmitted: "submitted",
  in_review: "submitted",
  revision_requested: "revisionRequested",
  approved: "approved",
  rejected: "rejected",
};

/** The `agentRow` view for the owner's agent rows on one bounty (submission first), or undefined when the agent has none. */
function agentRowView(application: ApplicationRow | undefined, submission: SubmissionRow | undefined): BountyActionView | undefined {
  const agent = (submission ?? application)?.agent;
  if (!agent) return undefined;
  if (!submission) {
    const state: AgentRowState = application?.status === "rejected" ? "applicationRejected" : application?.status === "open" ? "applied" : "applicationApproved";
    return { kind: "agentRow", agentName: agent.name, row: "application", state };
  }
  const state = AGENT_SUBMISSION_STATE[submission.status];
  const review = state === "revisionRequested" || state === "rejected" ? parseReviewComment(submission.reviewComment) : null;
  return {
    kind: "agentRow", agentName: agent.name, row: "submission", state,
    ...(review ? { review } : {}),
    ...(state === "approved" && submission.paymentStatus ? { payout: submission.paymentStatus } : {}),
  };
}

/** Rule 2 for agent-only bounties: guide until the owner's agent has a row, then that row's progress. */
function deriveAgentBountyView(input: BountyActionInput, closed: BountyActionView): BountyActionView {
  const { applicationRequired, auth, applications, submissions, status } = input;
  const guide: BountyActionView = status === "active" ? { kind: "agentMode", endpoint: applicationRequired ? "applications" : "submissions" } : closed;
  if (auth !== "signed-in") return guide;
  if (submissions.loading || (applicationRequired && applications.loading)) return { kind: "checkingStatus" };
  // The guide does not depend on account state: a failed read just means no progress to show.
  if (submissions.unavailable || (applicationRequired && applications.unavailable)) return guide;
  const forBounty = <T extends { bountySlug: string }>(rows: readonly T[] | null) => rows?.filter((row) => row.bountySlug === input.bountyId);
  const view = agentRowView(splitRows(forBounty(applications.data)).agent, splitRows(forBounty(submissions.data)).agent);
  if (!view) return guide;
  // An approved application with no submission yet: the next step is the submission endpoint, not another application.
  if (view.kind === "agentRow" && view.state === "applicationApproved" && status === "active") return { kind: "agentMode", endpoint: "submissions" };
  return view;
}

export function deriveActionView(input: BountyActionInput): BountyActionView {
  const { applicationRequired, applicationClosed = false, deadlinePassed = false, status, submissionMode, auth, applications, submissions, applied, submitted } = input;
  const acceptingNew = status === "active";
  const closed: BountyActionView = { kind: "closed", reason: status === "reviewing" ? "reviewing" : "closed" };

  // 1. 마감된 바운티는 비로그인에게 계정 상태가 필요 없다. 로그인 사용자는 재제출·에이전트 행 때문에 계속 진행.
  if (!acceptingNew && auth === "signed-out") return closed;
  // 2. 에이전트 전용 바운티의 직접 폼은 없다 (Agent API 안내 패널은 컴포넌트 몫). 로그인했으면 내 에이전트의 진행 상태를 먼저 보여 준다.
  if (submissionMode === "agent") return deriveAgentBountyView(input, closed);
  // 3. 세션
  if (auth === "loading") return { kind: "checkingSession" };
  if (auth !== "signed-in") return { kind: "signedOut" };
  // 4. 내 행 조회. 지원이 필요 없는 바운티는 지원 목록을 기다리지도, 실패로 보지도 않는다.
  if (submissions.loading || (applicationRequired && applications.loading)) return { kind: "checkingStatus" };
  if (submissions.unavailable || (applicationRequired && applications.unavailable)) return { kind: "statusUnavailable" };

  const forBounty = <T extends { bountySlug: string }>(rows: readonly T[] | null) => rows?.filter((row) => row.bountySlug === input.bountyId);
  const { own: application, agent: agentApplication } = splitRows(forBounty(applications.data));
  const { own: submission, agent: agentSubmission } = splitRows(forBounty(submissions.data));

  // 5. 에이전트만 참여했으면 직접 지원/제출은 별개의 두 번째 참여가 되므로 폼을 숨긴다 (에이전트 행은 Agent API로 관리).
  if (!application && !submission && !applied && !submitted) {
    const agentView = agentRowView(agentApplication, agentSubmission);
    if (agentView) return agentView;
  }

  // 6. 지원 단계 (승인된 지원 등은 제출 단계로 내려간다)
  if (applicationRequired) {
    if (!application && !applied) return acceptingNew && !applicationClosed ? { kind: "applyForm" } : closed;
    if (application?.status === "rejected") return application.reviewNote ? { kind: "applicationRejected", note: application.reviewNote } : { kind: "applicationRejected" };
    // `applied` only bridges the gap until the server row arrives; a row that already moved on (approved...) wins.
    if (application ? application.status === "open" : applied) {
      // A pending application on a bounty that ended (COMPLETED / CANCELLED; not merely past its deadline, where the sponsor can still decide)
      // can never be reviewed: say the bounty is closed instead of promising "submission unlocks after approval".
      return application && status === "closed" && !deadlinePassed ? closed : { kind: "applicationUnderReview" };
    }
  }

  // 7. 확정된 제출
  if (submission?.status === "approved") return submission.paymentStatus ? { kind: "submissionApproved", payout: submission.paymentStatus } : { kind: "submissionApproved" };
  if (submission?.status === "rejected") {
    const review = parseReviewComment(submission.reviewComment);
    return review ? { kind: "submissionRejected", review } : { kind: "submissionRejected" };
  }

  // 8~9. BE는 승인/거절 전까지 재제출을 받는다(마감 후엔 수정 요청일 때만). 단 바운티가 진행 중일 때만(`isInProgress`:
  // OPEN / SUBMISSION_CLOSED / IN_REVIEW) — `closed`(COMPLETED / CANCELLED)는 BOUNTY_REVIEW_CLOSED이므로 재제출 폼을 주지 않는다.
  // 단 마감일만 지난 OPEN 바운티도 FE 상태는 `closed`이지만 BE는 수정 요청 재제출을 받는다(`deadlinePassed`).
  const revising = submission?.status === "revision_requested" && (status !== "closed" || deadlinePassed);
  const inReview = submitted || (submission !== undefined && PENDING_SUBMISSION_STATUSES.includes(submission.status));
  if (!acceptingNew && !revising) return inReview ? { kind: "inReviewLocked" } : closed;
  const revisionComment = revising ? parseReviewComment(submission?.reviewComment)?.text : undefined;
  return revisionComment ? { kind: "submitForm", revising, inReview, revisionComment } : { kind: "submitForm", revising, inReview };
}

/**
 * 지원/제출 실패의 문구 키 (`bounties.action.errors.<key>`):
 * - `ERROR_COPY.bountyAction.codes`에 있는 코드 → 그 코드 키
 * - 목록 밖 BE 코드 → `unknown` + 원 코드(`{code}`로 표시)
 * - 네트워크 등 HTTP 응답이 아닌 실패 → `generic` (레지스트리의 `fallback`)
 */
export type BountyActionErrorCopy =
  | { key: (typeof ERROR_COPY.bountyAction.codes)[number] }
  | { key: "unknown"; code: string }
  | { key: typeof ERROR_COPY.bountyAction.fallback };

/**
 * BE answers that mean "your row for this bounty is not what this page shows" (applied or finalized from another tab or
 * device): the panel re-reads /applications/me and /submissions/me so the right section replaces the stale form.
 */
export function isStaleRowsError(error: unknown): boolean {
  const { key } = bountyActionErrorCopy(error);
  return key === "ALREADY_APPLIED" || key === "APPLICATION_NOT_APPROVED" || key === "SUBMISSION_FINALIZED";
}

export function bountyActionErrorCopy(error: unknown): BountyActionErrorCopy {
  const code = knownCode(error, ERROR_COPY.bountyAction.codes);
  if (code) return { key: code };
  if (error instanceof ApiHttpError) return { key: "unknown", code: error.code };
  return { key: ERROR_COPY.bountyAction.fallback };
}
