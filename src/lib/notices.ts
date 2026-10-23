import type { Notice } from "@/lib/types";
import { formatIsoDate, toNoticeCategoryLabel } from "@/lib/api/codecs";
import { fetchAllPublicPages } from "@/lib/api/paging";
import { fetchPublicJson, loadFromRuntime } from "@/lib/api/public";

export const notices: Notice[] = [
  {
    slug: "ninja-labs-injective-builder-hackathon",
    title: "Ninja Labs joins the Injective builder hackathon",
    excerpt:
      "Three bounty tracks will help new teams ship wallets, widgets, and educational content.",
    bodyMarkdown:
      "Three bounty tracks will help new teams ship wallets, widgets, and educational content. Each track pairs builders with clear scopes so first-time contributors can land meaningful work on Injective.\n\n- **Wallets**: ship wallet flows and integrations for Injective users\n- **Widgets**: build reusable, embeddable widgets for Injective data\n- **Educational content**: create guides and primers that onboard new builders",
    category: "Ninja Labs",
    publishedAt: "2026.06.20",
    thumbnail: "",
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
    thumbnail: "",
    related: [
      { label: "Browse active bounty tracks", href: "/bounties" },
      { label: "View a public portfolio", href: "/members/jaemin" },
    ],
  },
  {
    slug: "july-bounty-sponsor-review-call",
    title: "Community review call for July bounty sponsors",
    excerpt: "Ninja Labs will walk through application intake, review status, and reward release timing.",
    bodyMarkdown:
      "Ninja Labs will walk through **application intake**, review status, and reward release timing with the sponsors lined up for July.\n\n- How apply-type bounties move from application to approval\n- What reviewers check before a reward is released\n- When child Bounty NFTs are minted after final approval",
    category: "Events",
    publishedAt: "2026.06.12",
    thumbnail: "",
  },
  {
    slug: "public-profiles-show-child-bounty-nfts",
    title: "Public profiles now show child Bounty NFTs",
    excerpt: "Completed work now appears under each builder's parent Ninja NFT portfolio grid.",
    bodyMarkdown:
      "Completed work now appears under each builder's parent Ninja NFT portfolio grid. Every approved bounty mints a child NFT that attaches to the builder's Ninja NFT and shows up on their public profile.\n\nProfiles are shareable without login, so sponsors can review a builder's track record before approving an application.",
    category: "Ninja Labs",
    publishedAt: "2026.06.08",
    thumbnail: "",
  },
];

// Display-label keys (messages `notices.categories`); the category value itself stays English for matching.
export const noticeCategoryKeys: Record<Notice["category"], string> = {
  "Ninja Labs": "ninjaLabs",
  "Injective ecosystem": "injectiveEcosystem",
  Events: "events",
  Recruitment: "recruitment",
  Other: "other",
};

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

function toNotice(row: NoticeRow): Notice {
  return {
    slug: row.id,
    title: row.title,
    excerpt: row.summary ?? "",
    bodyMarkdown: row.body ?? row.summary ?? "",
    category: toNoticeCategoryLabel(row.category) ?? "Other",
    // Stable `YYYY.MM.DD` (not localized): the Figma date label, and sitemap.ts parses it back into a Date.
    publishedAt: formatIsoDate(row.published_at).replaceAll("-", "."),
    thumbnail: row.thumbnail_url ?? "",
    coverImage: row.thumbnail_url ?? undefined,
    externalUrl: row.external_url ?? undefined,
  };
}

export function getRuntimeNotices(): Promise<Notice[]> {
  return loadFromRuntime({
    mock: getNotices,
    api: async () => (await fetchAllPublicPages<NoticeRow>("/notices")).map(toNotice),
  });
}

export function getRuntimeNotice(id: string): Promise<Notice | undefined> {
  return loadFromRuntime({
    mock: () => getNotice(id),
    api: async () => {
      try {
        return toNotice(await fetchPublicJson<NoticeRow>(`/notices/${encodeURIComponent(id)}`));
      } catch {
        return undefined;
      }
    },
  });
}
