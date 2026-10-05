import type { MetadataRoute } from "next";

import { getRuntimeBounties } from "@/lib/bounties";
import { getRuntimeMembers } from "@/lib/members";
import { getRuntimeNotices } from "@/lib/notices";
import { localeTags, routing } from "@/i18n/routing";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { origin } = loadRuntimeConfig();
  const [bounties, members, notices] = await Promise.all([
    getRuntimeBounties(), getRuntimeMembers(), getRuntimeNotices(),
  ]);
  const url = (path: string) => path;

  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/bounties"), changeFrequency: "daily", priority: 0.9 },
    ...bounties.map(({ slug }) => ({
      url: url(`/bounties/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: url("/bounties/apply"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/hall-of-fame"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/members"), changeFrequency: "weekly", priority: 0.7 },
    ...members.map(({ slug }) => ({
      url: url(`/members/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: url("/notices"), changeFrequency: "weekly", priority: 0.7 },
    ...notices.map(({ slug, publishedAt }) => ({
      url: url(`/notices/${slug}`),
      lastModified: new Date(publishedAt.replaceAll(".", "-")),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: url("/signup"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/agents/register"), changeFrequency: "monthly", priority: 0.5 },
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
