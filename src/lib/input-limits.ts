/**
 * 사용자 본문 입력의 길이 상한 — NinjaLabsBE DTO의 `@MaxLength`/`@MaxChars` 거울.
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
