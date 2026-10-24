/**
 * BE가 응답 `message`로 던지는 에러 코드 목록 — **BE 카탈로그의 그대로 복사본(snapshot)**이다. 손으로 코드를 지어내지 말 것.
 *
 * 원본: NinjaLabsBE `src/common/http/error-codes.ts` (`ERROR_CODES`의 키, 같은 순서·같은 묶음).
 * 스냅샷 기준: BE `fix/wiki-audit-findings` @ `c3c2a08` (카탈로그 마지막 변경 `9e55829`) · 82개.
 * 줄 끝 주석은 "HTTP 상태 — BE 카탈로그의 한 줄 의미"이고 사용자 문구가 아니다 (사용자 문구는 `messages/<locale>/*.json`).
 *
 * ## 어디를 고치나
 * - **BE가 코드를 추가/삭제/개명했을 때**: BE 카탈로그를 열고 이 배열을 같은 내용으로 맞춘 뒤 위 "스냅샷 기준" 커밋을 갱신한다.
 *   코드가 사라졌다면 `lib/api/error-copy.ts`의 목록에서도 빼야 tsc가 통과한다 (목록은 이 배열의 부분집합으로 타입이 걸려 있다).
 * - **어떤 화면이 이 코드를 사용자 문구로 보여 주게 하고 싶을 때**: 여기는 건드리지 말고 `lib/api/error-copy.ts`의 해당 화면 목록에
 *   코드를 넣고 그 화면의 messages 객체에 같은 이름의 키를 en/ko/zh 셋 다 추가한다 (`src/test/error-copy.test.ts`가 확인한다).
 * - FE가 스스로 만드는 코드(`NETWORK_ERROR`, `VALIDATION_FAILED` 등)는 BE 코드가 아니므로 여기가 아니라 `error-copy.ts`의
 *   `FE_ERROR_CODES`에 둔다.
 * - `INVALID_TRANSITION`은 실제 메시지가 `INVALID_TRANSITION:<from>-><to>`다 (접두사가 코드 — `admin-operations.ts opsErrorCode`가 정규화).
 */
export const BE_ERROR_CODES = [
  // ── 인증 / 세션 (auth) ──
  "MISSING_BEARER_TOKEN", // 401 — Authorization: Bearer 헤더가 없다
  "INVALID_ACCESS_TOKEN", // 401 — access token이 위조·만료됐거나 세션이 폐기됐다 (FE는 refresh 후 1회 재시도)
  "INVALID_REFRESH_TOKEN", // 401 — refresh token이 없거나 만료·폐기·재사용 감지됐다 (재로그인 필요)
  "INVALID_LOGIN_CODE", // 401 — 일회용 로그인 코드가 없거나 만료·이미 사용됐다
  "INVALID_CODE_CHALLENGE", // 401 — PKCE code_challenge 형식이 올바르지 않다
  "INVALID_OAUTH_STATE", // 401 — OAuth state가 변조됐거나 만료됐다
  "GOOGLE_CODE_EXCHANGE_FAILED", // 401 — Google 인가 코드 교환이 실패했다
  "INVALID_GOOGLE_ID_TOKEN", // 401 — Google id_token 서명·발급자·대상(aud) 검증에 실패했다
  "GOOGLE_EMAIL_NOT_VERIFIED", // 401 — Google 계정 이메일이 인증되지 않았다
  "GOOGLE_UNAVAILABLE", // 503 — Google 서명 키/엔드포인트에 일시적으로 닿지 못했다 (재시도 가능)
  "ACCOUNT_CONFLICT", // 409 — 같은 이메일/Google 계정의 활성 유저와 충돌했다 (동시 첫 로그인 등; 콜백은 #error=AUTH_FAILED로 보낸다)
  "ADMIN_ONLY", // 403 — 운영자(is_admin)만 호출할 수 있다
  "TURNSTILE_FAILED", // 400 — Turnstile 봇 검증 토큰이 없거나 거부됐다
  "TURNSTILE_UNAVAILABLE", // 503 — Turnstile 검증 서버에 닿지 못했다

  // ── 유저 / 탈퇴 ──
  "USER_NOT_FOUND", // 404 — 대상 유저가 없다 (탈퇴 포함)
  "NICKNAME_TAKEN", // 409 — 이미 사용 중인 닉네임이다
  "CONFIRM_NICKNAME_MISMATCH", // 400 — 탈퇴 확인용 닉네임 입력이 현재 닉네임과 다르다
  "WITHDRAWAL_BLOCKED_OPEN_PAYOUTS", // 409 — 진행 중인 지급(payout)이 있어 탈퇴할 수 없다
  "WITHDRAWAL_BLOCKED_PENDING_REWARDS", // 409 — 입금 대기 중인 보상이 걸려 있어 탈퇴할 수 없다

  // ── 지갑 ──
  "INVALID_INJECTIVE_ADDRESS", // 400 — Injective 주소(inj1… 또는 0x…) 형식이 올바르지 않다
  "CHALLENGE_NOT_FOUND", // 400 — 발급된 지갑 challenge가 없다 (먼저 challenge 요청)
  "CHALLENGE_EXPIRED", // 400 — challenge가 만료됐거나 이미 사용됐다
  "INVALID_SIGNATURE", // 401 — 서명 검증에 실패했다 (지갑 연결·에이전트 등록 공통)
  "WALLET_ALREADY_LINKED", // 409 — 이 주소가 이미 다른 계정에 연결됐거나, 내 대표 지갑이 이미 있다 (부분 유니크 인덱스 충돌)

  // ── 에이전트 ──
  "INVALID_AGENT_WALLET_ADDRESS", // 400 — 에이전트 지갑 주소 형식이 올바르지 않다
  "AGENT_PUBLIC_KEY_REQUIRED", // 400 — 에이전트 공개키가 필요하다
  "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED", // 409 — 같은 공개키 또는 지갑으로 이미 등록된 에이전트가 있다
  "AGENT_NOT_FOUND", // 404 — 내 에이전트가 아니거나 없다
  "AGENT_ALREADY_VERIFIED", // 409 — 이미 검증이 끝난 에이전트다
  "AGENT_NOT_ACTIVE", // 409 — ACTIVE 상태가 아니어서 키 회전 등을 할 수 없다
  "MISSING_AGENT_API_KEY", // 401 — Agent API 키 헤더가 없다
  "INVALID_AGENT_API_KEY", // 401 — Agent API 키가 없거나 만료·폐기됐다
  "AGENT_SUBMISSION_REQUIRED", // 400 — 에이전트 제출 전용 바운티인데 사람이 직접 요청했다
  "DIRECT_SUBMISSION_REQUIRED", // 400 — 직접 제출 전용 바운티인데 에이전트가 요청했다

  // ── 바운티 (공개/어드민) ──
  "BOUNTY_NOT_FOUND", // 400, 404 — 바운티가 없거나 비공개다 (하이라이트 생성에서 존재하지 않는 bountyId는 400)
  "BOUNTY_NOT_OPEN", // 400 — 지원/제출을 받는 상태(OPEN 등)가 아니다
  "BOUNTY_REVIEW_CLOSED", // 400 — 바운티가 이미 종료돼 심사·보상 처리를 할 수 없다
  "BOUNTY_HAS_OPEN_FUNDS", // 409 — 미정산 보상·지급이 남아 있어 삭제할 수 없다
  "DEADLINE_IN_PAST", // 400 — 마감일을 과거로 바꿀 수 없다
  "MAX_WINNERS_BELOW_APPROVED", // 400 — 이미 승인된 수보다 적게 최대 당선자 수를 줄일 수 없다
  "INVALID_TRANSITION", // 400 — 허용되지 않는 상태 전이다 (실제 메시지는 INVALID_TRANSITION:<from>-><to>)
  "REWARD_TOKEN_DENOM_REQUIRED", // 400 — 보상 토큰 denom이 필요하다
  "REWARD_TOKEN_CONTRACT_REQUIRED", // 400 — 보상 토큰 컨트랙트 주소가 필요하다
  "REWARD_EVM_METADATA_REQUIRED", // 400 — EVM 보상 토큰의 메타데이터(컨트랙트·체인)가 필요하다
  "USDC_EVM_CONTRACT_NOT_CONFIGURED", // 400 — 서버에 USDC EVM 컨트랙트 주소 설정이 없다 (운영 env)
  "INJECTIVE_EVM_CHAIN_NOT_CONFIGURED", // 400 — 서버에 Injective EVM 체인 ID 설정이 없다 (운영 env)

  // ── 지원 (applications) ──
  "SUBMISSION_TYPE_BOUNTY", // 400 — 제출형 바운티는 지원 없이 바로 제출한다
  "APPLICATION_DEADLINE_PASSED", // 400 — 지원/제출 마감이 지났다
  "ALREADY_APPLIED", // 409 — 이미 지원했다 (철회 상태만 재지원 가능)
  "APPLICATION_NOT_FOUND_OR_NOT_PENDING", // 404 — 지원서가 없거나 PENDING이 아니라 처리할 수 없다
  "APPLICATION_APPROVAL_CLOSED", // 400 — 바운티 상태상 더 이상 지원을 승인할 수 없다
  "APPLICATION_NOT_APPROVED", // 403 — 승인된 지원자만 제출할 수 있다

  // ── 제출 / 심사 (submissions) ──
  "DEADLINE_PASSED", // 400 — 제출 마감이 지났다 (수정 요청 상태의 재제출은 예외)
  "SUBMISSION_FINALIZED", // 409 — 이미 확정(승인/반려)된 제출이라 수정할 수 없다
  "SUBMISSION_NOT_FOUND", // 404 — 제출물이 없다
  "SUBMISSION_NOT_REVIEWABLE", // 400 — 심사 가능한 상태의 제출이 아니다
  "SUBMISSION_REVISION_CHANGED", // 400 — 심사 중에 제출이 재제출돼 리비전이 바뀌었다 (새로고침 후 다시 심사)
  "REVISION_COMMENT_REQUIRED", // 400 — 수정 요청에는 코멘트가 필요하다
  "MAX_WINNERS_REACHED", // 400 — 최대 당선자 수에 도달해 더 승인할 수 없다
  "INVALID_DECISION", // 404 — 알 수 없는 심사 결정 값이다 (404로 나가는 것이 현행 계약)

  // ── 보상 / 지급 (rewards) ──
  "INVALID_TX_HASH", // 400 — 트랜잭션 해시 형식이 올바르지 않다
  "INVALID_TOKEN_AMOUNT", // 400 — 토큰 금액이 최소 단위 양의 정수 문자열이 아니다
  "TX_HASH_ALREADY_USED", // 409 — 이미 다른 입금/지급에 쓰인 tx hash다 (중복 사용 불가)
  "REWARD_NOT_FOUND", // 404 — 보상 행이 없다
  "REWARD_NOT_FOUND_OR_NOT_PENDING", // 404 — 보상이 없거나 입금 대기(DEPOSIT_PENDING) 상태가 아니다
  "REWARD_NOT_FUNDED", // 400 — 보상이 없거나 입금 확인(FUNDED 이상)이 안 돼 지급을 요청할 수 없다
  "APPROVED_SUBMISSION_OR_WALLET_NOT_FOUND", // 404 — 승인된 제출이 없거나 수령자의 지갑이 연결돼 있지 않다
  "APPROVED_SUBMISSION_NOT_FOUND", // 404 — 해당 지급의 승인된 제출이 없다
  "PAYOUT_ALREADY_REQUESTED", // 409 — 같은 제출에 이미 지급 요청이 있다 (멱등)
  "PAYOUT_EXCEEDS_AVAILABLE_REWARD", // 400 — 지급액이 남은 보상 잔액을 넘는다
  "PAYOUT_NOT_FOUND_OR_WRONG_STATUS", // 404 — 지급이 없거나 현재 상태에서 허용되지 않는 처리다
  "PAYOUT_SELF_APPROVAL", // 403 — 지급 요청자 본인이 승인할 수 없다 (PAYOUT_ALLOW_SELF_APPROVAL로만 허용)

  // ── 콘텐츠 (notices / highlights / members / media / nfts) ──
  "NOTICE_NOT_FOUND", // 404 — 공지가 없다
  "HIGHLIGHT_NOT_FOUND", // 404 — 하이라이트가 없다
  "NFT_JOB_NOT_FOUND_OR_NOT_FAILED", // 404 — NFT 작업이 없거나 FAILED가 아니라 재시도할 수 없다
  "MEDIA_FILE_REQUIRED", // 400 — 업로드 파일이 없다
  "MEDIA_FILE_TOO_LARGE", // 400 — 업로드 파일이 크기 상한을 넘는다
  "MEDIA_FILE_TYPE_UNSUPPORTED", // 400 — 허용되지 않는 이미지 형식이다 (시그니처 검사)
  "MEDIA_NOT_FOUND", // 404 — 미디어가 없다

  // ── 공통 (DB 오류 매핑 — common/database/pg-errors.ts) ──
  "INVALID_CHARACTER", // 400 — 요청 값에 DB가 거부하는 문자(NUL 등)가 있다
  "REFERENCE_NOT_FOUND", // 400 — 참조하는 대상 행이 없다 (FK 위반)
  "DATABASE_UNAVAILABLE", // 503 — DB 연결 풀/응답 타임아웃 (재시도 가능)
] as const;

export type BeErrorCode = (typeof BE_ERROR_CODES)[number];
