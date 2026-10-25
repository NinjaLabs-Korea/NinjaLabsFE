import { endsWithStaticFileExtension } from "@/lib/static-extensions";

/**
 * 닉네임 규칙 — NinjaLabsBE `src/users/nickname.ts` + `CompleteProfileDto`(@Trim @Length(2,50) @Matches @IsNotReservedNickname)의 거울.
 * BE 규칙이 바뀌면 여기와 `src/test/nickname.test.ts`를 함께 고칠 것. `/users/:nickname` 경로에 그대로 쓰이는 값이다.
 *
 *   - 정규형은 trim + 유니코드 NFC (BE `normalizeNickname`): 자모로 풀어 쓴 한글·결합 악센트도 검증·전송 전에 합친다
 *   - 유니코드 문자/숫자와 `_ . -`만, 공백 불가
 *   - 한글 채움 문자(U+115F, U+1160, U+3164, U+FFA0)는 불가 (BE 정규식): 범주는 문자(Lo)지만 빈칸으로 그려져 "보이지 않는 이름"이 된다
 *   - 처음과 끝은 문자/숫자 (`.ninja`, `ninja-`, `..`, `--` 불가)
 *   - 길이 2~50 (trim 후, **코드 포인트** 기준 — BE `@Length`/validator `isLength`는 서로게이트 쌍을 한 글자로 센다)
 *   - 라우트와 충돌하는 예약어는 대소문자 무관 거부
 *   - 탈퇴 익명화 이름의 접두사 `withdrawn_`도 대소문자 무관 거부 (BE `WITHDRAWN_NICKNAME_PREFIX` — 탈퇴자 사칭 방지)
 *   - 정적 파일 확장자(`.js`, `.JSON` …)로 끝나면 대소문자 무관 거부 — proxy matcher가 건너뛰는 경로라 `/members/<닉네임>`이
 *     페이지가 아닌 파일 요청이 된다. 목록은 `lib/static-extensions.ts` 한 곳 (`.inj`는 허용)
 */
export const NICKNAME = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*[\p{L}\p{N}]$/u;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 50;
export const RESERVED_NICKNAMES: readonly string[] = ["me", "check-nickname", "admin", "new", "edit"];

const ALLOWED_CHARS = /^(?!.*[\u115F\u1160\u3164\uFFA0])[\p{L}\p{N}_.-]+$/u;

/** 탈퇴한 유저의 익명화 닉네임 접두사 (`withdrawn_<id 8hex>`) — 공개 프로필이 없으므로 상세 URL도 될 수 없다 */
export const WITHDRAWN_NICKNAME_PREFIX = "withdrawn_";

export function isReservedNickname(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return RESERVED_NICKNAMES.includes(normalized) || normalized.startsWith(WITHDRAWN_NICKNAME_PREFIX);
}

/** 실패 사유. 화면 문구는 messages `signup.profile.form.nicknameErrors.<사유>`에 있다. */
export type NicknameError = "tooShort" | "tooLong" | "reserved" | "chars" | "edge" | "staticExtension";

/** 코드 포인트 수 (`"𝐀".length === 2`지만 한 글자). `<input maxLength>`는 UTF-16 단위라 더 엄격할 뿐, 검증은 이 값으로 한다. */
export function nicknameLength(value: string): number {
  return [...value].length;
}

/** Avatar initials: the first two code points, upper-cased. `slice(0, 2)` would cut an astral letter (nicknames allow any Unicode letter) into a lone surrogate. */
export function nicknameInitials(nickname: string): string {
  return Array.from(nickname).slice(0, 2).join("").toUpperCase();
}

/** BE `normalizeNickname`과 같은 정규형(trim + NFC). 검증·중복 검사·저장 요청은 모두 이 값으로 한다. */
export function normalizeNickname(raw: string): string {
  return raw.trim().normalize("NFC");
}

/** BE와 같은 순서로 검사한다: trim·NFC → 길이 → 예약어 → 문자 집합 → 양 끝 → 정적 파일 확장자. 통과하면 null. */
export function validateNickname(raw: string): NicknameError | null {
  const value = normalizeNickname(raw);
  const length = nicknameLength(value);
  if (length < NICKNAME_MIN) return "tooShort";
  if (length > NICKNAME_MAX) return "tooLong";
  if (isReservedNickname(value)) return "reserved";
  if (!ALLOWED_CHARS.test(value)) return "chars";
  if (!NICKNAME.test(value)) return "edge";
  if (endsWithStaticFileExtension(value)) return "staticExtension";
  return null;
}

export function isValidNickname(raw: string): boolean {
  return validateNickname(raw) === null;
}
