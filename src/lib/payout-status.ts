/**
 * payout / 보상 상태 집합 - **BE 상수의 복사본(snapshot)**이다. 손으로 새 집합을 만들지 말 것 (`be-error-codes.ts`와 같은 방식).
 *
 * 원본: NinjaLabsBE `src/rewards/payout-status.ts` (`OPEN_PAYOUT_STATUSES`, `UNSETTLED_PAYOUT_STATUSES`, `PAYABLE_REWARD_STATUSES`).
 * 스냅샷 기준: BE `origin/main` @ `026cb6d` (이 파일의 마지막 변경 커밋 `a667a31`).
 *
 * 쓰는 곳: 미리보기 mock(`lib/mocks/admin-operations.ts`)과 운영 콘솔 규칙(`lib/admin-operations.ts`). api 모드에서는 BE가 판정한다.
 *
 * ## 어디를 고치나
 * - BE가 집합을 바꿨을 때: 원본을 열어 아래 배열을 같은 내용으로 맞추고 위 기준 커밋을 갱신한다.
 *   `src/test/payout-status-mirror.test.ts`의 스냅샷도 같이 고쳐야 통과한다 (집합 변경을 일부러 하게 만드는 장치).
 */

/** 진행 중(열린) payout: 승인 또는 송금을 기다린다. FAILED / CANCELLED / PAID는 포함하지 않는다. */
export const OPEN_PAYOUT_STATUSES: readonly string[] = ["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING"];

/** 배정됐지만 아직 지급되지 않은 상태 (= PAID, CANCELLED가 아닌 것). 하나라도 있으면 보상을 PAID로 닫지 않는다. */
export const UNSETTLED_PAYOUT_STATUSES: readonly string[] = [...OPEN_PAYOUT_STATUSES, "FAILED"];

/** 입금이 확인돼 payout을 요청할 수 있는 보상 상태. */
export const PAYABLE_REWARD_STATUSES: readonly string[] = ["FUNDED", "PARTIALLY_PAID", "PAID"];
