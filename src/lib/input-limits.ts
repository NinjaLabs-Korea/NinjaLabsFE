/**
 * 사용자 본문 입력의 길이 상한 - NinjaLabsBE DTO의 `@MaxLength`/`@MaxChars` 거울.
 * 폼의 `maxLength`와 에이전트 안내(`agent-skill.ts`)가 같은 값을 쓴다. BE가 바뀌면 여기만 고친다.
 *   ApplyDto.message 4000 · SubmitDto.description 8000 · SubmitDto.commitSha 64 · CompleteProfileDto.bio 1000
 * `<input maxLength>`는 UTF-16 단위라 BE(코드 포인트)보다 같거나 엄격하다.
 */
export const APPLICATION_MESSAGE_MAX = 4000;
export const SUBMISSION_DESCRIPTION_MAX = 8000;
export const COMMIT_SHA_MAX = 64;
export const PROFILE_BIO_MAX = 1000;

/**
 * 기수 모집 지원서 상한: BE `cohorts/cohort-fields.ts`의 거울 (displayName VARCHAR 60, activityTypeOther/interestOther 60, intro 1000).
 * 자기소개 "추천" 구간(`COHORT_INTRO_RECOMMENDED_*`)은 Tally 폼의 안내 문구일 뿐 검증이 아니다.
 */
export const COHORT_DISPLAY_NAME_MAX = 60;
export const COHORT_OTHER_DETAIL_MAX = 60;
export const COHORT_INTRO_MAX = 1000;
export const COHORT_INTRO_RECOMMENDED_MIN = 100;
export const COHORT_INTRO_RECOMMENDED_MAX = 300;
/** 운영자 기수 입력: name VARCHAR 60, description TEXT 10 000, 심사 메모 2000. */
export const COHORT_NAME_MAX = 60;
export const COHORT_DESCRIPTION_MAX = 10_000;
export const COHORT_REVIEW_NOTE_MAX = 2000;

/** 운영자 공지: `CreateNoticeDto` title @MaxChars(200), body @MaxLength(50 000). PATCH(`UpdateNoticeDto`)는 본문 100 000이지만 더 엄격한 생성 한도를 둘 다에 쓴다. */
export const NOTICE_TITLE_MAX = 200;
export const NOTICE_BODY_MAX = 50_000;

/** 운영자 하이라이트: `CreateHighlightDto` title @MaxChars(200), description @MaxLength(2000) (PATCH는 4000, 생성 한도를 쓴다). */
export const HIGHLIGHT_TITLE_MAX = 200;
export const HIGHLIGHT_DESCRIPTION_MAX = 2000;

/**
 * 운영자 바운티: `CreateBountyDto` title @MaxChars(200), sponsorName @MaxChars(100), description @MaxLength(50 000),
 * requirements/evaluationCriteria @MaxLength(20 000) (PATCH는 두 배, 더 엄격한 생성 한도를 둘 다에 쓴다).
 */
export const BOUNTY_TITLE_MAX = 200;
export const BOUNTY_SPONSOR_MAX = 100;
export const BOUNTY_TEXT_MAX = { description: 50_000, deliverables: 20_000, reviewProcess: 20_000 } as const;
/** BE `CreateBountyDto`/`UpdateBountyDto` `@Max(1000)` (`maxWinners`). */
export const MAX_WINNERS_MAX = 1000;

/** 에이전트 등록: `RegisterAgentDto` name @MaxChars(100), description @MaxLength(1000). */
export const AGENT_NAME_MAX = 100;
export const AGENT_DESCRIPTION_MAX = 1000;

/** 감사 로그 조회: `AuditLogsQueryDto.entityType` @MaxLength(64). */
export const AUDIT_ENTITY_TYPE_MAX = 64;

/** 운영자 입금·제출·지원 심사 메모/코멘트: BE `@MaxLength(2000)`. */
export const OPS_NOTE_MAX = 2000;

/** 지원서 목록 검색어: `cohort-admin.controller.ts`의 검색 쿼리 `q` @MaxChars(320). */
export const COHORT_APPLICATION_SEARCH_MAX = 320;

/**
 * FE 전용(BE 상한 없음): 텔레그램/X 핸들 입력칸. 프로필 URL을 붙여 넣어도 되도록 핸들 규칙(32/15자)보다 넉넉하게 두고,
 * BE가 정규화한 뒤 핸들 정규식으로 검증한다.
 */
export const COHORT_HANDLE_INPUT_MAX = 80;

/**
 * 닉네임 길이는 `nickname.ts`가 정의한다(검증 규칙과 한 파일). 입력칸이 이 모듈에서 한도를 모두 찾도록 다시 내보낸다.
 */
export { NICKNAME_MAX, NICKNAME_MIN } from "@/lib/nickname";
