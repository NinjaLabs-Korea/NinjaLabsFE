import type { Metadata } from "next";
import { localeTags, routing } from "./routing";

/** `/<locale><href>` with the locale home as `/<locale>` (no trailing slash), the same shape `sitemap.ts` emits. */
function localizedPath(locale: string, href: string): string {
  return `/${locale}${href === "/" ? "" : href}`;
}

/**
 * Per-page `alternates`: `canonical` is the page's own localized URL and `languages` lists the same page in every
 * locale (hreflang keys from `localeTags`). Resolved against `metadataBase`. Every page with metadata sets it - a
 * child's `alternates` replaces the layout's (the `[locale]` layout's value is only right for the locale home).
 */
export function localeAlternates(locale: string, href: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: localizedPath(locale, href),
    languages: Object.fromEntries(routing.locales.map((l) => [localeTags[l].htmlLang, localizedPath(l, href)])),
  };
}
