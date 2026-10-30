import { endsWithStaticFileExtension } from "@/lib/static-extensions";

/**
 * 닉네임 규칙 - NinjaLabsBE `src/users/nickname.ts` + `CompleteProfileDto`(@Trim @Length(2,50) @Matches @IsNotReservedNickname)의 거울.
 * 문자 클래스는 BE 정규식을 그대로 옮긴 것이다 (BE `origin/main` `026cb6d`에서 읽음). 손으로 줄이지 말고 BE와 함께 갱신한다.
 * BE 규칙이 바뀌면 여기와 `src/test/nickname.test.ts`를 함께 고칠 것. `/users/:nickname` 경로에 그대로 쓰이는 값이다.
 *
 *   - 정규형은 trim + 유니코드 NFC (BE `normalizeNickname`): 자모로 풀어 쓴 한글·결합 악센트도 검증·전송 전에 합친다
 *   - 유니코드 문자/숫자와 `_ . -`만, 공백 불가. 결합 문자(`\p{M}`: 힌디어 모음 기호·비라마, 태국어 성조·모음 기호, 악센트)는 글자 뒤에 연속 3개까지 (`_ . -` 바로 뒤 불가), 변이 선택자는 불가. 끝은 문자/숫자/결합 문자
 *   - 화면에 그려지지 않는 Default_Ignorable_Code_Point(U+034F, 크메르 U+17B4/17B5, 몽골 변이 선택자 U+180B-180F 등)는 불가 (\p{M}이라 결합 문자 허용으로 열리지만 사칭에 쓰인다)
 *   - 한글 채움 문자(U+115F, U+1160, U+3164, U+FFA0)는 불가 (BE 정규식): 범주는 문자(Lo)지만 빈칸으로 그려져 "보이지 않는 이름"이 된다
 *   - 전각/반각 문자(U+FF00 블록)와 수학용 영숫자(U+1D400 블록)는 불가: `ａｄｍｉｎ`처럼 NFKC로 라틴이 되는 모양만 같은 문자(사칭)
 *   - 라틴 글자와 모양이 같은 라틴 확장 문자 거부 (BE-3 규칙과 같은 범위): U+0250-02FF(IPA 확장·수정 문자), U+1D00-1DBF(음성 확장),
 *     U+2100-218F(문자형 기호·숫자 형태), U+0131(ı), U+0237(ȷ), U+A730-A7FF(라틴 확장 D), U+AB30-AB6F(라틴 확장 E). `ɑdmin`, `ᴀdmin`, `ℓinja`류
 *   - 라틴 글자와 라틴처럼 보이는 문자 체계(키릴, 그리스, 콥트, 아르메니아, 체로키, 리수, 조지아, 캐나다 원주민, 티피나그, 바이, 글라골, 오세이지, 데저렛, 아들람, 룬, 오검)를
 *     한 이름에 섞을 수 없음 (BE 정규식과 같은 목록)
 *   - 처음과 끝은 문자/숫자 (`.ninja`, `ninja-`, `..`, `--` 불가)
 *   - 길이 2~50 (trim 후, **코드 포인트** 기준 - BE `@Length`/validator `isLength`는 서로게이트 쌍을 한 글자로 센다)
 *   - 라우트와 충돌하는 예약어는 대소문자 무관 거부. 비교는 BE `nicknameSkeleton`과 같은 골격(NFKC + 소문자 + 키릴/그리스 동형 글자를 라틴으로)
 *   - 탈퇴 익명화 이름의 접두사 `withdrawn_`도 대소문자 무관 거부 (BE `WITHDRAWN_NICKNAME_PREFIX` - 탈퇴자 사칭 방지)
 *   - 정적 파일 확장자(`.js`, `.JSON` …)로 끝나면 대소문자 무관 거부 - proxy matcher가 건너뛰는 경로라 `/members/<닉네임>`이
 *     페이지가 아닌 파일 요청이 된다. 목록은 `lib/static-extensions.ts` 한 곳 (`.inj`는 허용)
 */
export const NICKNAME = /^(?!.*[\p{Default_Ignorable_Code_Point}\u115F\u1160\u3164\uFFA0\p{Variation_Selector}\uFF00-\uFFEF\u{1D400}-\u{1D7FF}])(?!.*[\u0131\u0237\u0250-\u02FF\u1D00-\u1DBF\u2100-\u218F\uA730-\uA7FF\uAB30-\uAB6F])(?!(?=.*[A-Za-z\u00C0-\u024F])(?=.*[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Coptic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}\p{Script=Georgian}\p{Script=Canadian_Aboriginal}\p{Script=Tifinagh}\p{Script=Vai}\p{Script=Glagolitic}\p{Script=Osage}\p{Script=Deseret}\p{Script=Adlam}\p{Script=Runic}\p{Script=Ogham}]))(?!.*\p{M}{4})(?!.*[_.-]\p{M})[\p{L}\p{N}][\p{L}\p{N}\p{M}_.-]*[\p{L}\p{N}\p{M}]$/u;
/**
 * Lookup shape for `/members/<nickname>`: only the edges and the character classes, none of the look-alike rules above.
 * Rows created before those rules (the BE left them untouched) keep working URLs; the BE decides what exists.
 */
export const NICKNAME_LOOKUP_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}_.-]*[\p{L}\p{N}\p{M}]$/u;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 50;
export const RESERVED_NICKNAMES: readonly string[] = ["me", "check-nickname", "admin", "new", "edit"];

// BE NICKNAME의 선행 부정 탐색을 분리한 것: 전각/반각 블록과 수학용 영숫자 (NFKC로 라틴이 되는 사칭용 모양).
const LOOKALIKE_BLOCKS = /[\uFF00-\uFFEF\u{1D400}-\u{1D7FF}]/u;
// BE-3과 같은 범위: 라틴 글자와 모양이 같은 라틴 확장 문자.
const LATIN_LOOKALIKES = /[\u0131\u0237\u0250-\u02FF\u1D00-\u1DBF\u2100-\u218F\uA730-\uA7FF\uAB30-\uAB6F]/u;
// BE NICKNAME의 혼합 문자 탐색을 분리한 것: 라틴 글자와 라틴처럼 보이는 문자 체계(키릴, 그리스, 아르메니아 등 BE 목록)가 한 이름에 같이 있음.
const MIXED_SCRIPT = /(?=.*[A-Za-z\u00C0-\u024F])(?=.*[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Coptic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}\p{Script=Georgian}\p{Script=Canadian_Aboriginal}\p{Script=Tifinagh}\p{Script=Vai}\p{Script=Glagolitic}\p{Script=Osage}\p{Script=Deseret}\p{Script=Adlam}\p{Script=Runic}\p{Script=Ogham}])/u;

/** 라틴 글자와 모양이 같은 키릴/그리스 소문자 -> 라틴 (BE `CONFUSABLE_TO_LATIN`과 같은 표). */
/** 체로키 대문자 -> 라틴 (toLowerCase 뒤 골격 키로 쓰려고 소문자 형태를 키로 만든다. BE `cherokeeLookalikes`) */
function cherokeeLookalikes(cherokee: string, latin: string): Record<string, string> {
  return Object.fromEntries([...cherokee].map((char, index) => [char.toLowerCase(), latin[index]]));
}

const CONFUSABLE_TO_LATIN: Readonly<Record<string, string>> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w", "һ": "h", "ո": "n",
  "α": "a", "ο": "o", "ρ": "p", "ν": "v", "ι": "i", "κ": "k", "τ": "t", "χ": "x", "υ": "u",
  "օ": "o", "ս": "u", "ɑ": "a",
  ...cherokeeLookalikes("ᎪᏴᏟᎠᎬᏀᎻᎵᎫᏦᏞᎷᏢᏒᏚᎢᏙᎳᏃ", "abcdeghijklmprstvwz"),
};

/** 예약어 비교용 골격 (BE `nicknameSkeleton`). */
function nicknameSkeleton(value: string): string {
  return [...value.trim().normalize("NFKC").toLowerCase()].map((char) => CONFUSABLE_TO_LATIN[char] ?? char).join("");
}

// Hangul filler letters (U+115F, U+1160, U+3164, U+FFA0) are category Lo but draw as blanks; the BE rejects them anywhere in the name.
// Combining marks (\p{M}: Hindi vowel signs and virama, Thai tone marks, accents) are allowed after a letter, but not the invisible
// variation selectors (also \p{M}; emoji styling) and Default_Ignorable_Code_Point (U+034F, Khmer U+17B4/17B5, Mongolian U+180B-180F: draw as
// nothing, so `coreni<U+034F>nja` would look like `coreninja`) - BE `NICKNAME`.
const ALLOWED_CHARS = /^(?!.*[\p{Default_Ignorable_Code_Point}\u115F\u1160\u3164\uFFA0\p{Variation_Selector}])[\p{L}\p{N}\p{M}_.-]+$/u;
// More than 3 marks in a row, or a mark right after `_ . -`: BE `NICKNAME` lookaheads.
const BAD_MARKS = /\p{M}{4}|[_.-]\p{M}/u;

/** 탈퇴한 유저의 익명화 닉네임 접두사 (`withdrawn_<id 8hex>`) - 공개 프로필이 없으므로 상세 URL도 될 수 없다 */
export const WITHDRAWN_NICKNAME_PREFIX = "withdrawn_";

export function isReservedNickname(value: string): boolean {
  const normalized = nicknameSkeleton(value);
  return RESERVED_NICKNAMES.includes(normalized) || normalized.startsWith(WITHDRAWN_NICKNAME_PREFIX);
}

/** 실패 사유. 화면 문구는 messages `signup.profile.form.nicknameErrors.<사유>`에 있다. */
export type NicknameError = "tooShort" | "tooLong" | "reserved" | "chars" | "marks" | "lookalike" | "mixedScript" | "edge" | "staticExtension";

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

/** BE와 같은 순서로 검사한다: trim·NFC → 길이 → 전각·혼합 문자 → 예약어 → 문자 집합 → 결합 문자 → 양 끝 → 정적 파일 확장자. 통과하면 null. */
export function validateNickname(raw: string): NicknameError | null {
  const value = normalizeNickname(raw);
  const length = nicknameLength(value);
  if (length < NICKNAME_MIN) return "tooShort";
  if (length > NICKNAME_MAX) return "tooLong";
  if (!ALLOWED_CHARS.test(value)) return "chars";
  // Before `reserved`: `ＡＤＭＩＮ` / `аdmin` skeleton to "admin", but the useful answer is why the characters themselves are refused.
  if (LOOKALIKE_BLOCKS.test(value) || LATIN_LOOKALIKES.test(value)) return "lookalike";
  if (MIXED_SCRIPT.test(value)) return "mixedScript";
  if (isReservedNickname(value)) return "reserved";
  if (BAD_MARKS.test(value)) return "marks";
  if (!NICKNAME.test(value)) return "edge";
  if (endsWithStaticFileExtension(value)) return "staticExtension";
  return null;
}

export function isValidNickname(raw: string): boolean {
  return validateNickname(raw) === null;
}
