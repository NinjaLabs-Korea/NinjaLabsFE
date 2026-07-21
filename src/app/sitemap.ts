import type { MetadataRoute } from "next";

import { bounties } from "@/lib/bounties";
import { profiles } from "@/lib/members";
import { getNotices } from "@/lib/notices";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const { origin } = loadRuntimeConfig();
  const url = (path: string) => `${origin}${path}`;

  return [
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
    ...Object.keys(profiles).map((slug) => ({
      url: url(`/members/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: url("/notices"), changeFrequency: "weekly", priority: 0.7 },
    ...getNotices().map(({ slug, publishedAt }) => ({
      url: url(`/notices/${slug}`),
      lastModified: new Date(publishedAt.replaceAll(".", "-")),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: url("/signup"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/agents/register"), changeFrequency: "monthly", priority: 0.5 },
  ];
}
