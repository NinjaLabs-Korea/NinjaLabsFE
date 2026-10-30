/** BE `CreateNoticeDto.summary` is plain text shown as the public list excerpt; keep the old 240-char budget. */
export const NOTICE_SUMMARY_MAX = 240;

/**
 * Only the head of the body can reach a 240-char excerpt; anything past this many UTF-16 units is dropped before the
 * regex passes so a pasted 1 MB body costs the same as a short one.
 */
export const SUMMARY_SOURCE_MAX = 4000;

const LABEL_MAX = 300;
const URL_MAX = 1000;

/**
 * Replaces `[label](url)` with `label` and drops `![alt](url)` entirely. The url part is scanned with a parenthesis depth
 * counter so `[a](https://x/y_(z))` does not leave a stray `)`; every scan is bounded and stops at a newline. Text that does
 * not form a complete link is left as it is. The url is never kept, so a `javascript:` target cannot reach the excerpt.
 */
function stripLinksAndImages(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("[", i);
    if (open === -1) break;
    const isImage = open > i && text[open - 1] === "!";
    let j = open + 1;
    while (j < text.length && j - open <= LABEL_MAX && text[j] !== "]" && text[j] !== "\n") j++;
    if (text[j] !== "]" || text[j + 1] !== "(") {
      out += text.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    let depth = 1;
    let k = j + 2;
    while (k < text.length && k - j <= URL_MAX && text[k] !== "\n" && depth > 0) {
      if (text[k] === "(") depth++;
      else if (text[k] === ")") depth--;
      k++;
    }
    if (depth !== 0) {
      out += text.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    out += text.slice(i, isImage ? open - 1 : open) + (isImage ? "" : text.slice(open + 1, j));
    i = k;
  }
  return out + text.slice(i);
}

/** A markdown table row (`| a | b |`) or its separator (`--- | :---:`): no prose in them worth an excerpt. */
function isTableLine(line: string): boolean {
  return /^[ \t]*\|/.test(line) || (line.includes("|") && /^[ \t|:-]+$/.test(line) && line.includes("-"));
}

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
  const withoutCode = source.replace(/```[\s\S]*?(```|$)/g, " ");
  const text = stripLinksAndImages(withoutCode.split("\n").filter((line) => !isTableLine(line)).join("\n"))
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
