import type { MetadataRoute } from "next";

import { settle } from "@/lib/api/public";
import { getRuntimeBounties } from "@/lib/bounties";
import { getRuntimeMembers } from "@/lib/members";
import { getRuntimeNotices } from "@/lib/notices";
import { localeTags, routing } from "@/i18n/routing";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origin } = loadRuntimeConfig();
  // A failing API source drops only its detail URLs; static routes are always listed.
  const [{ value: bounties }, { value: members }, { value: notices }] = await Promise.all([
    settle(getRuntimeBounties(routing.defaultLocale), []), settle(getRuntimeMembers(), []), settle(getRuntimeNotices(), []),
  ]);
  const url = (path: string) => path;
  // Nicknames may hold non-ASCII letters (`한글.inj`); sitemap URLs must be percent-encoded.
  const segment = encodeURIComponent;

  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/about"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/recruit"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/bounties"), changeFrequency: "daily", priority: 0.9 },
    ...bounties.map(({ slug }) => ({
      url: url(`/bounties/${segment(slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: url("/bounties/apply"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/hall-of-fame"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/members"), changeFrequency: "weekly", priority: 0.7 },
    ...members.map(({ slug }) => ({
      url: url(`/members/${segment(slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: url("/notices"), changeFrequency: "weekly", priority: 0.7 },
    ...notices.map(({ slug, publishedAt }) => {
      // `publishedAt` is "" when the BE row had no parseable date (lib/notices.ts); such entries carry no lastModified.
      const lastModified = new Date(publishedAt.replaceAll(".", "-"));
      return {
        url: url(`/notices/${segment(slug)}`),
        ...(Number.isNaN(lastModified.getTime()) ? {} : { lastModified }),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      };
    }),
    { url: url("/signup"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/agents/register"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];

  // One entry per locale, each listing every language variant as an alternate.
  const localized = (locale: string, path: string) => `${origin}/${locale}${path === "/" ? "" : path}`;
  return entries.flatMap((entry) =>
    routing.locales.map((locale) => ({
      ...entry,
      url: localized(locale, entry.url),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [localeTags[l].htmlLang, localized(l, entry.url)]),
        ),
      },
    })),
  );
}
