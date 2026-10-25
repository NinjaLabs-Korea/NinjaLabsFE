/**
 * BE 에러 코드 → 사용자 문구 레지스트리. "이 화면은 어떤 코드에 전용 문구가 있나"의 **유일한 정의 위치**다.
 *
 * 규칙 (모든 화면 공통):
 * - 화면마다 `messages`(문구 객체의 전체 경로)와 `codes`(전용 문구가 있는 코드 목록)를 하나씩 갖는다.
 * - 각 코드의 문구 키는 **코드 이름 그대로**다: `ERROR_COPY.accountDelete` → `account.settings.deleteErrors.WITHDRAWAL_BLOCKED_OPEN_PAYOUTS`.
 * - 목록에 없는 코드·네트워크 오류는 `fallback` 키(같은 객체 안)로 떨어진다. `fallback`이 없는 화면은 호출부가 자체 문구를 넘긴다.
 * - 컴포넌트는 `useTranslations(ERROR_COPY.<화면>.messages)`로 그 객체를 열고 `t(errorCopyKey(error, ERROR_COPY.<화면>))`로 읽는다.
 *
 * ## 어디를 고치나
 * - **화면에 코드 하나 추가**: 아래 해당 화면의 `codes`에 코드를 넣고 → `messages/{en,ko,zh}/<ns>.json`의 그 객체에 같은 이름의 키를 추가.
 *   `src/test/error-copy.test.ts`가 en 키 존재를, `messages-parity.test.ts`가 ko/zh를 확인한다.
 * - **코드 철자**: `be-error-codes.ts`(BE 스냅샷) 또는 `FE_ERROR_CODES`에 있는 코드만 넣을 수 있다 — 아니면 tsc가 실패한다.
 *   BE에 새 코드가 생겼으면 먼저 `be-error-codes.ts`를 BE 카탈로그와 맞춘다.
 * - **새 화면**: `ERROR_COPY`에 항목을 추가하면 테스트가 자동으로 그 화면도 검사한다.
 */
import { BE_ERROR_CODES, type BeErrorCode } from "./be-error-codes";
import { ApiHttpError } from "./http";

/**
 * BE가 아니라 FE가 스스로 만드는 코드. 위치:
 * - `VALIDATION_FAILED` / `UNKNOWN_ERROR` / `REFRESH_UNAVAILABLE` — `lib/api/http.ts` (Nest `message[]`, 빈 message, refresh 일시 장애)
 * - `NETWORK_ERROR` / `UNAUTHORIZED` / `TOO_MANY_REQUESTS` / `TRANSITION_BLOCKED` — `lib/admin-operations.ts opsErrorCode` 정규화 결과 (`TOO_MANY_REQUESTS`는 `knownCode`도 429에서 만든다)
 */
export const FE_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNKNOWN_ERROR",
  "REFRESH_UNAVAILABLE",
  "NETWORK_ERROR",
  "UNAUTHORIZED",
  "TOO_MANY_REQUESTS",
  "TRANSITION_BLOCKED",
] as const;
export type FeErrorCode = (typeof FE_ERROR_CODES)[number];

/** 레지스트리 목록에 들어갈 수 있는 코드 전체 (BE 스냅샷 ∪ FE 코드). */
export type KnownErrorCode = BeErrorCode | FeErrorCode;
export const KNOWN_ERROR_CODES: readonly KnownErrorCode[] = [...BE_ERROR_CODES, ...FE_ERROR_CODES];

export type ErrorCopySurface = {
  /** 문구 객체의 전체 경로 `<namespace>.<path>` (useTranslations 인자). 코드마다 이 객체 안에 같은 이름의 키가 있다. */
  readonly messages: string;
  /** 이 화면이 전용 문구를 보여 주는 코드 */
  readonly codes: readonly KnownErrorCode[];
  /** 목록 밖 코드·네트워크 오류 → 이 객체 안의 키. 생략하면 호출부가 자체 fallback을 쓴다. */
  readonly fallback?: string;
};

export const ERROR_COPY = {
  /**
   * 온보딩 지갑 연결 (challenge → 서명 → verify) — `wallet/WalletConnectButton.tsx`. BE `wallets.service.ts`가 던지는 코드 전부.
   * 서명 거절 등 지갑 쪽 실패는 `ApiHttpError`가 아니므로 `generic`이다.
   */
  walletVerify: {
    messages: "common.wallet.verifyErrors",
    codes: [
      "INVALID_INJECTIVE_ADDRESS",
      "CHALLENGE_NOT_FOUND",
      "CHALLENGE_EXPIRED",
      "INVALID_SIGNATURE",
      // 409: 이 주소가 다른 계정에 연결됐거나, 내 계정에 이미 대표 지갑이 있다.
      "WALLET_ALREADY_LINKED",
      "DATABASE_UNAVAILABLE",
      "TOO_MANY_REQUESTS",
    ],
    fallback: "generic",
  },
  /**
   * 바운티 상세 → 직접 지원/제출 — `bounties/BountyActionPanel.tsx` (키 선택은 `lib/bounty-action-state.ts bountyActionErrorCopy`).
   * BE bounties/rewards 코드와 FE 전송 코드(REFRESH_UNAVAILABLE / UNKNOWN_ERROR). 목록 밖 BE 코드는 `unknown`(원 코드를 `{code}`로),
   * HTTP 응답이 아닌 실패는 `generic`이다.
   */
  bountyAction: {
    messages: "bounties.action.errors",
    codes: [
      "ALREADY_APPLIED", "BOUNTY_NOT_OPEN", "APPLICATION_NOT_APPROVED", "DEADLINE_PASSED", "SUBMISSION_FINALIZED", "VALIDATION_FAILED",
      "APPLICATION_DEADLINE_PASSED", "SUBMISSION_TYPE_BOUNTY", "AGENT_SUBMISSION_REQUIRED", "DIRECT_SUBMISSION_REQUIRED",
      "REFRESH_UNAVAILABLE", "UNKNOWN_ERROR", "MAX_WINNERS_REACHED", "BOUNTY_NOT_FOUND", "INVALID_CHARACTER", "REFERENCE_NOT_FOUND",
      "DATABASE_UNAVAILABLE", "TOO_MANY_REQUESTS",
    ],
    fallback: "generic",
  },
  /** 내 정보 → 계정 삭제 (`DELETE /users/me`) — `account/AccountSettingsView.tsx` */
  accountDelete: {
    messages: "account.settings.deleteErrors",
    codes: [
      "CONFIRM_NICKNAME_MISMATCH",
      "WITHDRAWAL_BLOCKED_OPEN_PAYOUTS",
      // 409: 승인됐지만 아직 지급 요청 전인 보상 — 탈퇴하면 잃으므로 운영자가 먼저 지급해야 한다.
      "WITHDRAWAL_BLOCKED_PENDING_REWARDS",
      "DATABASE_UNAVAILABLE",
      // 탈퇴는 5회/분 한도다
      "TOO_MANY_REQUESTS",
    ],
    fallback: "generic",
  },
  /** 내 지원 현황 → 지원 철회 — `account/ApplicationsView.tsx` (이 코드면 목록도 새로고침한다) */
  applicationWithdraw: {
    messages: "account.applications.withdrawErrors",
    codes: ["APPLICATION_NOT_FOUND_OR_NOT_PENDING", "TOO_MANY_REQUESTS"],
    fallback: "generic",
  },
  /** 내 에이전트 → API 키 회전 — `account/AgentsView.tsx` */
  agentRotate: {
    messages: "agents.list.rotateErrors",
    codes: ["AGENT_NOT_ACTIVE", "TOO_MANY_REQUESTS"],
    fallback: "generic",
  },
  /** 에이전트 등록 (register → 서명 → verify) — `agents/AgentRegisterForm.tsx`. 필드 검증(VALIDATION_FAILED)은 인라인으로 따로 처리한다. */
  agentRegister: {
    messages: "agents.form.registerErrors",
    codes: ["AGENT_KEY_OR_WALLET_ALREADY_REGISTERED", "TOO_MANY_REQUESTS"],
    fallback: "generic",
  },
  /**
   * 온보딩 프로필 저장 — `signup/ProfileForm.tsx`. 코드 외 상태 규칙(네트워크 → `network`, 401 → `session`,
   * 코드 없는 409 → `NICKNAME_TAKEN`, 400/422 → `invalid`)은 `ProfileForm.saveErrorKey`가 소유한다.
   */
  profileSave: {
    messages: "signup.profile.form.saveErrors",
    codes: ["NICKNAME_TAKEN", "INVALID_CHARACTER", "REFERENCE_NOT_FOUND", "DATABASE_UNAVAILABLE", "TOO_MANY_REQUESTS"],
    fallback: "generic",
  },
  /**
   * 로그인 콜백의 `#error=<CODE>` — `lib/api/oauth.ts` → `app/[locale]/auth/callback/page.tsx`. BE는 로그인 시작 실패(`GET /auth/google`)의
   * `TURNSTILE_FAILED`/`TURNSTILE_UNAVAILABLE`과 콜백 중 DB 장애 `DATABASE_UNAVAILABLE`을 `#error=`로 돌려보낸다
   * (BE `START_FAILURE_CODES`). 그 밖의 실패는 `AUTH_FAILED` → 일반 문구 `failedBody`.
   */
  loginCallback: {
    messages: "signup.authCallback.errors",
    codes: ["TURNSTILE_FAILED", "TURNSTILE_UNAVAILABLE", "DATABASE_UNAVAILABLE"],
  },
  /** 운영자 콘솔 CRUD 저장/삭제/전이 토스트 — `lib/admin-helpers.ts adminErrorDescription` (fallback은 액션별 문구) */
  adminWrite: {
    messages: "admin.common.errors",
    codes: [
      "INVALID_CHARACTER", "INVALID_DATE", "REFERENCE_NOT_FOUND", "BOUNTY_NOT_FOUND", "BOUNTY_HAS_OPEN_FUNDS",
      // 다른 운영자가 먼저 지운 공지/하이라이트/유저에 대한 수정·삭제·멤버 지정 (404)
      "NOTICE_NOT_FOUND", "HIGHLIGHT_NOT_FOUND", "USER_NOT_FOUND",
      // 바운티 생성: 서버 env에 USDC 컨트랙트 / EVM 체인 ID가 없다 (운영자가 고칠 설정 문제 — 일반 실패 문구로 숨기지 않는다)
      "USDC_EVM_CONTRACT_NOT_CONFIGURED", "INJECTIVE_EVM_CHAIN_NOT_CONFIGURED",
      // 바운티 수정: 마감을 과거로 옮김 (BE bounty-admin.service — 저장된 값 그대로 되보내는 것은 통과)
      "DEADLINE_IN_PAST",
      // 커버/썸네일/하이라이트 이미지 업로드 (POST /admin/media — 5 MiB, PNG/JPEG/WebP 시그니처 검사)
      "MEDIA_FILE_TOO_LARGE", "MEDIA_FILE_TYPE_UNSUPPORTED",
      // 503: BE가 DB에 닿지 못함 (일시 장애)
      "DATABASE_UNAVAILABLE",
      // 403 (운영자 권한 회수) / 401 · 429는 `adminApiErrorCode`가 상태로 정규화한다 — 429 본문에는 코드가 없다
      "ADMIN_ONLY", "UNAUTHORIZED", "TOO_MANY_REQUESTS",
    ],
  },
  /**
   * 운영자 바운티 운영(지원/제출/보상/지급/NFT) — `lib/admin-operations.ts opsErrorCode`. 해당 엔드포인트가 던지는 BE 코드 전부와
   * FE 정규화 코드. 목록 밖은 `unknown`(원 코드를 `{code}`로 보여 준다).
   */
  adminOperations: {
    messages: "admin.operations.errors",
    codes: [
      "BOUNTY_NOT_FOUND",
      "BOUNTY_REVIEW_CLOSED",
      "APPLICATION_NOT_FOUND_OR_NOT_PENDING",
      "APPLICATION_APPROVAL_CLOSED",
      "SUBMISSION_NOT_FOUND",
      "SUBMISSION_NOT_REVIEWABLE",
      "SUBMISSION_REVISION_CHANGED",
      "REVISION_COMMENT_REQUIRED",
      "MAX_WINNERS_REACHED",
      "INVALID_DECISION",
      "REWARD_NOT_FOUND",
      "DEPOSIT_BELOW_REWARD_AMOUNT",
      "REWARD_NOT_FOUND_OR_NOT_PENDING",
      "REWARD_NOT_FUNDED",
      "INVALID_TX_HASH",
      "INVALID_TOKEN_AMOUNT",
      "TX_HASH_ALREADY_USED",
      "APPROVED_SUBMISSION_OR_WALLET_NOT_FOUND",
      "APPROVED_SUBMISSION_NOT_FOUND",
      "PAYOUT_ALREADY_REQUESTED",
      "PAYOUT_EXCEEDS_AVAILABLE_REWARD",
      "PAYOUT_NOT_FOUND_OR_WRONG_STATUS",
      "PAYOUT_SELF_APPROVAL",
      "NFT_JOB_NOT_FOUND_OR_NOT_FAILED",
      "INVALID_TRANSITION",
      "TRANSITION_BLOCKED",
      "VALIDATION_FAILED",
      "INVALID_CHARACTER",
      "ADMIN_ONLY",
      "UNAUTHORIZED",
      "TOO_MANY_REQUESTS",
      "REFRESH_UNAVAILABLE",
      "DATABASE_UNAVAILABLE",
      "NETWORK_ERROR",
    ],
    fallback: "unknown",
  },
} as const satisfies Record<string, ErrorCopySurface>;

export type ErrorCopySurfaceName = keyof typeof ERROR_COPY;

/** `value`가 `codes`에 있으면 그 코드(좁혀진 타입), 아니면 null. 문자열 코드(URL fragment, 정규화 결과)용. */
export function listedCode<const C extends string>(value: unknown, codes: readonly C[]): C | null {
  return typeof value === "string" && (codes as readonly string[]).includes(value) ? (value as C) : null;
}

/**
 * 실패한 API 호출의 BE 코드가 `codes`에 있으면 그 코드, 아니면 null (네트워크 오류 등 `ApiHttpError`가 아닌 것도 null).
 * mock 모드의 `MockApiError`도 `ApiHttpError`를 상속하므로 같은 경로를 탄다.
 * 429는 코드를 `TOO_MANY_REQUESTS`로 정규화한다: Nest throttler 본문(`ThrottlerException: Too Many Requests`)에는 카탈로그 코드가 없어
 * 그대로 두면 "알 수 없는 오류 (ThrottlerException…)"처럼 원문이 화면에 샌다. 이 코드를 `codes`에 넣은 화면만 전용 문구를 쓴다.
 */
export function knownCode<const C extends string>(error: unknown, codes: readonly C[]): C | null {
  if (!(error instanceof ApiHttpError)) return null;
  return listedCode(error.status === 429 ? "TOO_MANY_REQUESTS" : error.code, codes);
}

type SurfaceWithFallback = { readonly codes: readonly string[]; readonly fallback: string };

/** 화면 `S`의 문구 키 타입 (코드 | fallback) — 컴포넌트 state 타입으로 쓴다. */
export type ErrorCopyKey<S extends SurfaceWithFallback> = S["codes"][number] | S["fallback"];

/** 화면의 문구 키: 목록에 있는 코드면 그 코드, 아니면 화면의 `fallback`. `t(errorCopyKey(...))`로 쓴다. */
export function errorCopyKey<S extends SurfaceWithFallback>(error: unknown, surface: S): ErrorCopyKey<S> {
  return knownCode(error, surface.codes) ?? surface.fallback;
}
