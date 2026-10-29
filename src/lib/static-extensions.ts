/**
 * Static-file extensions the proxy matcher (`src/proxy.ts config.matcher`) skips - the single FE source of this list.
 *
 * The matcher itself must stay a string literal (Next parses it at build time), so it repeats the group verbatim and
 * `src/test/proxy-matcher.test.ts` asserts the literal and this list are identical. A path ending in one of these is
 * served as a file and never reaches the proxy, so a nickname ending in one would produce an unreachable
 * `/members/<nickname>` page: `lib/nickname.ts` rejects it (mirror of the BE nickname rule, case-insensitive).
 */
export const STATIC_FILE_EXTENSIONS = [
  "ico", "png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "txt", "xml", "json", "js", "css", "map", "woff", "woff2", "ttf",
] as const;

/** `/\.(ico|png|…)$/i` - true when `value` ends in a static-file extension, any case. */
export const STATIC_FILE_EXTENSION_SUFFIX = new RegExp(`\\.(${STATIC_FILE_EXTENSIONS.join("|")})$`, "i");

export function endsWithStaticFileExtension(value: string): boolean {
  return STATIC_FILE_EXTENSION_SUFFIX.test(value);
}
