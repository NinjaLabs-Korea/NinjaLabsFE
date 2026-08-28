import { getBounties } from "./bounties";
import { hallOfFame } from "./hall-of-fame";
import { getMembers, profiles } from "./members";
import { getNotices } from "./notices";
import type { Member } from "./types";

export type AdminUser = {
  slug: string;
  nickname: string;
  email: string;
  joinedAt: string;
  walletAddress: string | null;
  walletStatus: "linked" | null;
  isMember: boolean;
  memberRole: "Core" | "Dev" | "Design" | "Ops" | null;
  memberDisplayOrder: number | null;
};

export type AdminBounty = {
  slug: string;
  title: string;
  sponsor: string;
  reward: { amount: number; currency: "INJ" | "USDC" };
  rewardContractAddress?: string;
  rewardChainId?: number;
  intakeEnabled: boolean;
  status: "draft" | "funding" | "active" | "reviewing" | "closed";
  deadline: string;
  tags: Array<"Dev" | "Design" | "Content" | "Other">;
  description: string;
  submissionGuide: string;
  deliverables: string[];
  reviewProcess: string;
};

export type AdminHighlight = {
  id: string;
  type: "Milestone" | "Featured bounty" | "Partnership";
  title: string;
  order: number;
  link?: string;
  image: string | null;
  description?: string;
  published?: boolean;
};

export type AdminPost = {
  slug: string;
  title: string;
  category: "Ninja Labs" | "Injective ecosystem" | "Events" | "Recruitment" | "Other";
  status: "draft" | "published";
  publishedAt: string | null;
  bodyMarkdown: string;
  thumbnail: string | null;
  externalUrl: string | null;
};

const adminUserSlugs = ["jaemin", "sora", "jinyoung", "juho", "mina", "ara"] as const;

const userOverlays: Record<
  (typeof adminUserSlugs)[number],
  Pick<AdminUser, "email" | "joinedAt" | "walletAddress" | "walletStatus">
> = {
  jaemin: { email: "jaemin@example.com", joinedAt: "05.01", walletAddress: "inj1...9k4d", walletStatus: "linked" },
  sora: { email: "sora@example.com", joinedAt: "07.01", walletAddress: null, walletStatus: null },
  jinyoung: { email: "jinyoung@example.com", joinedAt: "05.03", walletAddress: "inj1...2p8m", walletStatus: "linked" },
  juho: { email: "juho@example.com", joinedAt: "05.12", walletAddress: "inj1...7n3q", walletStatus: "linked" },
  mina: { email: "mina@example.com", joinedAt: "06.04", walletAddress: "inj1...5w6r", walletStatus: "linked" },
  ara: { email: "ara@example.com", joinedAt: "06.20", walletAddress: "inj1...8c1v", walletStatus: "linked" },
};

const bountyOverlays: Record<
  string,
  { intakeEnabled: boolean; deadline: string; status?: "reviewing" }
> = {
  "iasset-price-widget": { intakeEnabled: true, deadline: "07.14" },
  "wallet-onboarding-states": { intakeEnabled: false, deadline: "07.12", status: "reviewing" },
  "contract-security-audit": { intakeEnabled: false, deadline: "07.19" },
  "injective-dev-tutorial": { intakeEnabled: true, deadline: "07.16" },
  "helix-volume-analytics": { intakeEnabled: false, deadline: "07.21" },
  "hydro-liquidity-explainer": { intakeEnabled: false, deadline: "07.17" },
  "neptune-api-docs": { intakeEnabled: false, deadline: "07.23" },
  "design-system-build": { intakeEnabled: false, deadline: "07.03" },
  "quest-copy-refresh": { intakeEnabled: false, deadline: "07.01" },
};

export function getAdminUsers(): AdminUser[] {
  const membersBySlug = new Map<string, Member>(
    getMembers().map((member) => [member.slug, member]),
  );

  return adminUserSlugs.map((slug) => {
    const profile = profiles[slug];
    const member = membersBySlug.get(slug);
    const overlay = userOverlays[slug];

    return {
      slug,
      nickname: profile.handle.replace(".inj", ""),
      ...overlay,
      isMember: member?.isMember ?? false,
      memberRole: member?.role ?? null,
      memberDisplayOrder: member ? getMembers().findIndex(({ slug: memberSlug }) => memberSlug === slug) + 1 : null,
    };
  });
}

export function getAdminBounties(): AdminBounty[] {
  return getBounties().map((bounty) => {
    const overlay = bountyOverlays[bounty.slug];

    if (!overlay) {
      throw new Error(`Missing admin bounty overlay for ${bounty.slug}`);
    }

    return {
      slug: bounty.slug,
      title: bounty.title,
      sponsor: bounty.sponsor,
      reward: { ...bounty.reward },
      intakeEnabled: overlay.intakeEnabled,
      status: overlay.status ?? bounty.status,
      deadline: overlay.deadline,
      tags: bounty.slug === "iasset-price-widget" ? [bounty.category, "Other"] : [bounty.category],
      description: bounty.descriptionMarkdown ?? bounty.summary,
      submissionGuide: bounty.submissionGuideMarkdown ?? "",
      deliverables: [...(bounty.deliverables ?? [])],
      reviewProcess: bounty.reviewProcess ?? "",
    };
  });
}

export function getAdminHighlights(): AdminHighlight[] {
  return hallOfFame.highlights.map((highlight, index) => ({
    id: `highlight-${index + 1}`,
    type: highlight.category,
    title: highlight.title,
    order: index + 1,
    image: null,
    ...(highlight.category === "Featured bounty" ? { link: "/bounties/iasset-price-widget" } : {}),
  }));
}

export function getAdminPosts(): AdminPost[] {
  return [
    ...getNotices().map((notice) => ({
      slug: notice.slug,
      title: notice.title,
      category: notice.category,
      status: "published" as const,
      publishedAt: notice.publishedAt,
      bodyMarkdown: notice.bodyMarkdown,
      thumbnail: notice.thumbnail,
      externalUrl: notice.externalUrl ?? null,
    })),
    {
      slug: "q3-roadmap-preview",
      title: "Q3 roadmap preview",
      category: "Ninja Labs",
      status: "draft" as const,
      publishedAt: null,
      bodyMarkdown: "A preview of Ninja Labs' third-quarter roadmap.",
      thumbnail: null,
      externalUrl: null,
    },
  ];
}
