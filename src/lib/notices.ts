import type { Notice } from "@/lib/types";
import { fetchPublicJson } from "@/lib/api/public";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export const notices: Notice[] = [
  {
    slug: "ninja-labs-injective-builder-hackathon",
    title: "Ninja Labs joins the Injective builder hackathon",
    excerpt:
      "Three bounty tracks will help new teams ship wallets, widgets, and educational content.",
    bodyMarkdown:
      "Three bounty tracks will help new teams ship wallets, widgets, and educational content. Each track pairs builders with clear scopes so first-time contributors can land meaningful work on Injective.\n\n- **Wallets** — ship wallet flows and integrations for Injective users\n- **Widgets** — build reusable, embeddable widgets for Injective data\n- **Educational content** — create guides and primers that onboard new builders",
    category: "Ninja Labs",
    publishedAt: "2026.06.20",
    thumbnail: "ninja-api-forge-developer-campaign.png",
  },
  {
    slug: "iasset-modules-for-bounty-builders",
    title: "New iAsset modules explained for bounty builders",
    excerpt:
      "A primer on price feeds, market metadata, and integration patterns for upcoming tasks.",
    bodyMarkdown:
      "A primer on **price feeds**, market metadata, and integration patterns for upcoming tasks.\n\nBuild a reusable price widget for Injective iAssets. Start with the [iAsset overview](https://docs.injective.network) to understand the module surface before wiring anything up.",
    category: "Injective ecosystem",
    publishedAt: "2026.06.15",
    thumbnail: "injective-multivm-ecosystem-campaign.png",
    coverImage: "injective-multivm-ecosystem-campaign.png",
    related: [
      { label: "Browse active bounty tracks", href: "/bounties" },
      { label: "View a public portfolio", href: "/members/jaemin" },
    ],
  },
  {
    slug: "injective-evm-community-workshop",
    title: "Injective EVM community workshop",
    excerpt: "Injective EVM community workshop.",
    bodyMarkdown:
      "Details and participation info to follow — check back here for the schedule and how to join.",
    category: "Events",
    publishedAt: "2026.06.12",
    thumbnail: "injective-evm-community-workshop.png",
  },
  {
    slug: "ninja-bounty-prove-to-earn-campaign",
    title: "Ninja Bounty: Prove to Earn campaign",
    excerpt: "Ninja Bounty: Prove to Earn campaign.",
    bodyMarkdown:
      "Details and participation info to follow — keep an eye on this notice for eligibility and timelines.",
    category: "Ninja Labs",
    publishedAt: "2026.06.08",
    thumbnail: "ninja-bounty-prove-to-earn-campaign.png",
  },
];

export function getNotices() {
  return notices;
}

export function getNotice(slug: string) {
  return notices.find((notice) => notice.slug === slug);
}

type NoticeRow = {
  id: string;
  title: string;
  summary: string | null;
  body?: string;
  category: string;
  thumbnail_url: string | null;
  external_url: string | null;
  published_at: string;
};
type NoticeListResponse = { items: NoticeRow[] };

const categoryLabels = {
  NINJALABS: "Ninja Labs",
  INJECTIVE_ECOSYSTEM: "Injective ecosystem",
  EVENT: "Events",
  RECRUITMENT: "Recruitment",
  OTHER: "Other",
} as const;

function toNotice(row: NoticeRow): Notice {
  return {
    slug: row.id,
    title: row.title,
    excerpt: row.summary ?? "",
    bodyMarkdown: row.body ?? row.summary ?? "",
    category: categoryLabels[row.category as keyof typeof categoryLabels] ?? "Other",
    publishedAt: new Date(row.published_at).toLocaleDateString("en-CA").replaceAll("-", "."),
    thumbnail: row.thumbnail_url ?? "",
    coverImage: row.thumbnail_url ?? undefined,
    externalUrl: row.external_url ?? undefined,
  };
}

export async function getRuntimeNotices(): Promise<Notice[]> {
  if (loadRuntimeConfig().runtimeMode === "mock") return getNotices();
  const response = await fetchPublicJson<NoticeListResponse>("/notices?page=1&pageSize=50");
  return response.items.map(toNotice);
}

export async function getRuntimeNotice(id: string): Promise<Notice | undefined> {
  if (loadRuntimeConfig().runtimeMode === "mock") return getNotice(id);
  try {
    return toNotice(await fetchPublicJson<NoticeRow>(`/notices/${encodeURIComponent(id)}`));
  } catch {
    return undefined;
  }
}
