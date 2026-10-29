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
 * True when `value` has at least one character a reader can see. Text left with only combining marks (\p{M}) does not count either:
 * without a base letter they draw as nothing.
 */
export function hasVisibleText(value: string): boolean {
  return /[^\p{M}]/u.test(value.replace(INVISIBLE, ""));
}
