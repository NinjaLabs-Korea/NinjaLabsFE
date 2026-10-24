/** BE `CreateNoticeDto.summary` is plain text shown as the public list excerpt; keep the old 240-char budget. */
export const NOTICE_SUMMARY_MAX = 240;

/**
 * Markdown body → plain-text excerpt for `notice.summary`. The public notices list renders the summary as text, so a
 * raw `body.slice(0, 240)` showed `**`, `##`, `[label](url)` and list bullets verbatim.
 * Truncates by code point (never splits a surrogate pair) and appends `…` when it cuts.
 */
export function markdownToPlainSummary(markdown: string, max = NOTICE_SUMMARY_MAX): string {
  const text = markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](\S(?:.*?\S)?)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}
