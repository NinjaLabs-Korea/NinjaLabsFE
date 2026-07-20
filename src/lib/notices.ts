import type { Notice } from "@/lib/types";

export const notices: Notice[] = [
  {
    slug: "ninja-labs-injective-builder-hackathon",
    title: "Ninja Labs joins the Injective builder hackathon",
    excerpt:
      "Three bounty tracks will help new teams ship wallets, widgets, and educational content.",
    bodyMarkdown:
      "Ninja Labs joins the Injective builder hackathon.\n\nThree bounty tracks will help new teams ship wallets, widgets, and educational content.",
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
      "New iAsset modules explained for bounty builders.\n\nA primer on price feeds, market metadata, and integration patterns for upcoming tasks.\n\nBuild a reusable price widget for Injective iAssets.",
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
    bodyMarkdown: "Injective EVM community workshop.",
    category: "Events",
    publishedAt: "2026.06.12",
    thumbnail: "injective-evm-community-workshop.png",
  },
  {
    slug: "ninja-bounty-prove-to-earn-campaign",
    title: "Ninja Bounty: Prove to Earn campaign",
    excerpt: "Ninja Bounty: Prove to Earn campaign.",
    bodyMarkdown: "Ninja Bounty: Prove to Earn campaign.",
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
