/**
 * BE 감사 action 카탈로그의 그대로 복사본(snapshot)이다. 손으로 action을 지어내지 말 것.
 *
 * 원본: NinjaLabsBE `src/audit/audit-actions.ts` (`AUDIT_ACTIONS`와 `SCRIPT_AUDIT_ACTIONS`의 키, 같은 순서).
 * 스냅샷 기준: BE `main` @ `16e7dd5` + BE #66(`fix/audit-gaps`, 지원·제출 action 4개) · 서버 55개 + 운영 스크립트 7개.
 *
 * ## 어디를 고치나
 * - BE가 action을 추가/삭제했을 때: 이 두 배열을 BE 파일과 같게 맞추고 위 기준 커밋을 갱신한 뒤, `messages/<locale>/admin.json`의
 *   `audit.actions`에 같은 키를 en/ko/zh 셋 다 추가한다 (`src/test/admin-audit-labels.test.ts`가 라벨 키 집합이 이 목록과 같은지 확인한다).
 * - BE 체크아웃이 옆에 있으면 `AUDIT_ACTIONS_BE_FILE=<BE>/src/audit/audit-actions.ts npm run test:unit`로 이 스냅샷이 원본과 같은지도 대조한다.
 * - 저장된 action 값은 BE에서 이름을 바꾸지 않는다. 이 목록에 없는 action이 오면 화면은 원문 코드를 그대로 보여 준다.
 */
export const BE_AUDIT_ACTIONS = [
  "BOUNTY_CREATED",
  "BOUNTY_UPDATED",
  "BOUNTY_DELETED",
  "BOUNTY_FUNDING_PENDING",
  "BOUNTY_OPEN",
  "BOUNTY_SUBMISSION_CLOSED",
  "BOUNTY_IN_REVIEW",
  "BOUNTY_COMPLETED",
  "BOUNTY_CANCELLED",
  "APPLICATION_SUBMITTED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "APPLICATION_REAPPLIED",
  "APPLICATION_WITHDRAWN",
  "SUBMISSION_SUBMITTED",
  "SUBMISSION_RESUBMITTED",
  "SUBMISSION_START_REVIEW",
  "SUBMISSION_REQUEST_REVISION",
  "SUBMISSION_APPROVE",
  "SUBMISSION_REJECT",
  "REWARD_DEPOSIT_CONFIRMED",
  "PAYOUT_REQUESTED",
  "PAYOUT_APPROVED",
  "PAYOUT_SELF_APPROVED",
  "PAYOUT_PAID",
  "AGENT_VERIFIED",
  "AGENT_KEY_ROTATED",
  "AGENT_REVOKED",
  "COHORT_CREATED",
  "COHORT_UPDATED",
  "COHORT_DELETED",
  "COHORT_QUESTIONS_UPDATED",
  "COHORT_OPENED",
  "COHORT_CLOSED",
  "COHORT_REOPENED",
  "COHORT_APPLICATION_SUBMITTED",
  "COHORT_APPLICATION_REAPPLIED",
  "COHORT_APPLICATION_UPDATED",
  "COHORT_APPLICATION_WITHDRAWN",
  "COHORT_APPLICATION_ACCEPTED",
  "COHORT_APPLICATION_REJECTED",
  "NOTICE_CREATED",
  "NOTICE_PUBLISHED",
  "NOTICE_UPDATED",
  "NOTICE_DELETED",
  "HIGHLIGHT_CREATED",
  "HIGHLIGHT_UPDATED",
  "HIGHLIGHT_DELETED",
  "USER_WITHDRAWN",
  "USER_NICKNAME_CHANGED",
  "USER_MEMBER_GRANTED",
  "USER_MEMBER_REVOKED",
  "USER_AVATAR_UPDATED",
  "USER_AVATAR_REMOVED",
  "NFT_JOB_RETRIED",
] as const;

/** 운영 스크립트(`scripts/*.js`)와 runbook 수동 SQL만 쓰는 action (BE `SCRIPT_AUDIT_ACTIONS`). */
export const BE_SCRIPT_AUDIT_ACTIONS = [
  "ADMIN_GRANTED",
  "ADMIN_REVOKED",
  "NFT_JOB_REQUEUED",
  "REWARD_REFUNDED",
  "SUBMISSION_AWARD_FORFEITED",
  "PAYOUT_CORRECTED_MANUAL",
  "PAYOUT_CANCELLED_MANUAL",
] as const;
