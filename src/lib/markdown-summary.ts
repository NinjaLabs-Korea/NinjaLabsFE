/** BE `CreateNoticeDto.summary` is plain text shown as the public list excerpt; keep the old 240-char budget. */
export const NOTICE_SUMMARY_MAX = 240;

/**
 * Only the head of the body can reach a 240-char excerpt; anything past this many UTF-16 units is dropped before the
 * regex passes so a pasted 1 MB body costs the same as a short one.
 */
export const SUMMARY_SOURCE_MAX = 4000;

/**
 * Markdown body → plain-text excerpt for `notice.summary`. The public notices list renders the summary as text, so a
 * raw `body.slice(0, 240)` showed `**`, `##`, `[label](url)` and list bullets verbatim.
 * Truncates by code point (never splits a surrogate pair) and appends `…` when it cuts.
 *
 * Every pattern is linear in the input: quantifiers that could scan to the end of the text from many start positions
 * (`[^)]*`, `\s*` across lines, `.+?` up to a closing marker) are bounded and stop at a newline, so an unclosed
 * `[a](` or a run of `" \n"` costs O(n·k) with a small constant k instead of O(n²).
 */
export function markdownToPlainSummary(markdown: string, max = NOTICE_SUMMARY_MAX): string {
  let source = markdown.length > SUMMARY_SOURCE_MAX ? markdown.slice(0, SUMMARY_SOURCE_MAX) : markdown;
  // Do not leave half of a surrogate pair at the cut.
  if (/[\uD800-\uDBFF]$/.test(source)) source = source.slice(0, -1);
  const text = source
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!\[([^\]\n]{0,300})\]\([^)\n]{0,1000}\)/g, "$1")
    .replace(/\[([^\]\n]{1,300})\]\([^)\n]{0,1000}\)/g, "$1")
    .replace(/<[^<>\n]{1,300}>/g, " ")
    .replace(/^[ \t]{0,3}(#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d{1,9}[.)][ \t]+)/gm, "")
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, " ")
    .replace(/(\*\*|__|~~)([^\n]{1,300}?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](\S(?:[^\n]{0,300}?\S)?)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}
