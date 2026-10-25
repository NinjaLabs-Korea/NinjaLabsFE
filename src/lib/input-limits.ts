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
