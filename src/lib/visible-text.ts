/**
 * Mirror of NinjaLabsBE `src/common/validation/visible-text.ts` `hasVisibleText` (read at BE origin/main 026cb6d). The character class is copied
 * verbatim; keep it in step with the BE and with the fixtures in `src/test/be-validator-fixtures.ts`.
 *
 * Nothing-drawing characters: Default_Ignorable_Code_Point (zero-width, soft hyphen, variation selectors, Hangul fillers, U+034F ...), format (Cf),
 * control (Cc), separators (Z), private use (Co), unassigned (Cn), surrogates (Cs), the object replacement character U+FFFC and the braille blank
 * U+2800 (category So, so \p{Z} misses it).
 */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\p{Cc}\p{Z}\p{Co}\p{Cn}\p{Cs}\uFFFC\u2800]/gu;

/**
 * True when `value` has at least one character a reader can see. Same definition as the BE `hasVisibleText`:
 * invisible characters do not count, and a value of only combining marks (\p{M}) has no base letter to draw on.
 */
export function hasVisibleText(value: string): boolean {
  return /[^\p{M}]/u.test(value.replace(INVISIBLE, ""));
}

/**
 * Characters a one-line display name may not contain. Mirror of BE `isPlainDisplayText` (DISPLAY_NAME_FORBIDDEN):
 * control characters (Cc, so line breaks and tabs), U+2028/2029, zero-width space U+200B, direction marks U+200E/200F,
 * embeddings/overrides U+202A-202E, isolates U+2066-2069, word joiner U+2060, BOM U+FEFF. ZWJ/ZWNJ stay allowed (emoji, Indic scripts).
 */
const DISPLAY_NAME_FORBIDDEN = /[\p{Cc}\u2028\u2029\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;

export function isPlainDisplayText(value: string): boolean {
  return !DISPLAY_NAME_FORBIDDEN.test(value);
}

/** Characters PostgreSQL cannot store in text (NUL) or that are control codes other than line break and tab: the BE answers 400 INVALID_CHARACTER. */
const BODY_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export function hasStorableBodyText(value: string): boolean {
  return !BODY_FORBIDDEN.test(value);
}
