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

type PageCopy = { title: string; description?: string };

/**
 * Title, description, canonical/hreflang plus the social-share tags of one page. A page's `openGraph` / `twitter`
 * replace the `[locale]` layout's wholesale (Next does not deep-merge them), so a page that only set `title` would
 * share the site-wide title and the locale home's `og:url`. Every public page builds its metadata through here so
 * `og:url` matches the canonical and `siteName` / `og:locale` survive.
 */
export function localeMetadata(locale: string, href: string, { title, description }: PageCopy): Metadata {
  const tags = (localeTags as Record<string, (typeof localeTags)[keyof typeof localeTags]>)[locale] ?? localeTags[routing.defaultLocale];
  return {
    alternates: localeAlternates(locale, href),
    title,
    description,
    openGraph: { title, description, siteName: "Ninja Labs", type: "website", locale: tags.ogLocale, url: localizedPath(locale, href) },
    twitter: { card: "summary_large_image", title, description },
  };
}
