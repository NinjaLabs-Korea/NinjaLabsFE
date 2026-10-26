/** Zero-width and Hangul filler characters draw as nothing: text made only of them is blank to the reader (like the nickname rule). */
const INVISIBLE = /[\u200B-\u200F\u2060\u2062-\u2064\uFEFF\u115F\u1160\u3164\uFFA0]/gu;

/** True when `value` has at least one character a reader can see (whitespace and invisible characters do not count). */
export function hasVisibleText(value: string): boolean {
  return value.replace(INVISIBLE, "").trim().length > 0;
}
