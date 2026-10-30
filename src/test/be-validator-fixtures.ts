/**
 * Accepted / rejected strings copied from NinjaLabsBE `origin/main` 026cb6d. Paste new BE rows here unchanged; never "fix" an expectation to
 * make the FE pass. Used by `nickname.test.ts`, `validator-parity.test.ts` and `visible-text.test.ts`.
 *   - nickname rows: `src/users/users.dto.spec.ts` (CompleteProfileDto it.each tables and the "보이지 않는 결합 문자" block)
 *   - visible-text rows: `src/common/validation/visible-text.spec.ts`
 */

/** users.dto.spec.ts "rejects nickname %p (length 2..50 ...)" (the long `n`.repeat(51) row is built here) */
export const BE_NICKNAME_REJECTED: readonly string[] = [
  "a", "n".repeat(51), "ninja dev", "ninja@dev", "ninja/dev", "ninja<b>", "   ", "​​", "ㅤㅤ", "ninjaㅤdev",
  "ninjaᅟ", "ᅠninja", "ﾠﾠ", "́ab", "á́́́́b", "ab.́", "ab️", "٣️", "a-́b",
  // "must start and end with a letter or digit"
  ".ninja", "ninja.", "-ninja", "ninja-", "_ninja", "ninja_", "..", "...", "--", "-.", ".-", "_-_", ".a", "a.",
  // reserved words and the withdrawn_ prefix (case-insensitive, trimmed)
  "me", "ME", "Me", "check-nickname", "Check-Nickname", "admin", "ADMIN", "new", "New", "edit", "EDIT", "  me  ", "withdrawn_1a2b3c4d", "Withdrawn_x",
  // static file extensions
  "ninja.png", "ninja.PNG", "Ninja.Png", "a.b.json", "닌자.js", "ninja.WOFF2", "  ninja.css  ",
  // look-alikes: fullwidth, Cyrillic/Greek mixed with Latin, mathematical alphanumerics
  "ａｄｍｉｎ", "Ｍｅ", "ｎｅｗ", "Ｗｉｔｈｄｒａｗｎ_abc", "ａｂ",
  "аdmin", "buіlderone", "admοn", "\u{1D41A}\u{1D41D}\u{1D426}\u{1D422}\u{1D427}",
  // "보이지 않는 결합 문자": Default_Ignorable_Code_Point inside a name
  "coreni͏nja", "Admi͏n", "builde឴rone", "coreninja͏", "c͏͏͏oreninja", "ni᠋nja",
];

/** users.dto.spec.ts "accepts nickname %p" plus the single-script and combining-mark rows */
export const BE_NICKNAME_ACCEPTED: readonly string[] = [
  "ninja_dev", "  ninja  ", "닌자.개발자-01",
  "a.b", "a-b", "a_b", "ninja-dev", "n.i.n.j.a", "닌자.개발자", "हिन्दी", "ไทยแลนด์",
  "café", "ไทย-dev", "01", "me2", "admin1", "newbie", "edits", "withdrawn", "withdrawn-1", "unwithdrawn_1",
  "ninja", "ab", "n".repeat(50), "닌자_빌더", "a.b-c_d",
  "Привет", "Ελληνικά", "dev한글", "ㅋㅋㅋ", "café",
  "ninja.jsx", "ninja.woff3", "ninja.pngx", "ninja.mp4", "ninjapng", "ninja_png", "ninja-json", "png.ninja", "js.dev", "a.jso", "ninja.j",
];

/** visible-text.spec.ts `hasVisibleText` "accepts" rows (both describe blocks) */
export const BE_VISIBLE_ACCEPTED: readonly string[] = ["a", "한글", "a​b", " x ", "é", "ก็", "a͏b"];

/** visible-text.spec.ts `hasVisibleText` "rejects" rows (string rows; the 5 / null rows are BE type checks) */
export const BE_VISIBLE_REJECTED: readonly string[] = [
  "", " ", "​", "​​", "​ ⁠﻿", "ㅤ", "ᅟᅠ", "⠀⠀", "­­", "‮", " ‮",
  "͏͏͏", "️️️", "￼￼", "឴឴", "᠋᠋", "", "͸͸", "́", "️", "͏",
];
