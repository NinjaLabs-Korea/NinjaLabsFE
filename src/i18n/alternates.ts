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

/** `image`: the page's own share image (a notice thumbnail); omitted = the site card the `[locale]` file-based `opengraph-image` renders. */
type PageCopy = { title: string; description?: string; image?: string };

/** The `[locale]/opengraph-image.tsx` route (`generateImageMetadata` id `social`): the site card, one per locale. */
const SITE_CARD_SIZE = { width: 1200, height: 630 };
const siteCardPath = (locale: string) => `/${locale}/opengraph-image/social`;

/**
 * Title, description, canonical/hreflang plus the social-share tags of one page. A page's `openGraph` / `twitter`
 * replace the `[locale]` layout's wholesale (Next does not deep-merge them), so a page that only set `title` would
 * share the site-wide title and the locale home's `og:url`. Every public page builds its metadata through here so
 * `og:url` matches the canonical and `siteName` / `og:locale` survive. The same replacement drops the file-based
 * `opengraph-image` (Next applies it only to the segment's own metadata), so the share image is set here too: without it
 * every page except the locale home shared as a "large card" with no picture.
 */
export function localeMetadata(locale: string, href: string, { title, description, image }: PageCopy): Metadata {
  const tags = (localeTags as Record<string, (typeof localeTags)[keyof typeof localeTags]>)[locale] ?? localeTags[routing.defaultLocale];
  return {
    alternates: localeAlternates(locale, href),
    title,
    description,
    openGraph: {
      title, description, siteName: "Ninja Labs", type: "website", locale: tags.ogLocale, url: localizedPath(locale, href),
      images: image ? [{ url: image }] : [{ url: siteCardPath(locale), ...SITE_CARD_SIZE }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image ?? siteCardPath(locale)] },
  };
}
