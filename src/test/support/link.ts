/** The string a real `@/i18n/navigation` Link would put in `href`, for the `<a>` stand-in in tests that mock it (`{ pathname, query }` objects included). */
export function hrefString(href: string | { pathname: string; query?: Record<string, string> } | undefined): string | undefined {
  if (href === undefined || typeof href === "string") return href;
  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname}${query}`;
}
