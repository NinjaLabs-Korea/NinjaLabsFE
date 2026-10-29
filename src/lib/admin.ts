import { toHighlightTypeCode } from "./api/codecs";
import { getBounties } from "./bounties";
import { hallOfFame } from "./hall-of-fame";
import { getMembers, profiles } from "./members";
import { getNotices } from "./notices";
import type { Member } from "./types";
import type { AdminBounty, AdminHighlight, AdminPost, AdminUser } from "./admin-helpers";

export * from "./admin-helpers";

const adminUserSlugs = ["jaemin", "sora", "jinyoung", "juho", "mina", "ara"] as const;

const userOverlays: Record<
  (typeof adminUserSlugs)[number],
  Pick<AdminUser, "email" | "joinedAt" | "walletAddress" | "walletStatus">
> = {
  // joinedAt: the same `YYYY-MM-DD` the api adapter derives with formatIsoDate(created_at).
  jaemin: { email: "jaemin@example.com", joinedAt: "2026-05-01", walletAddress: "inj1...9k4d", walletStatus: "linked" },
  sora: { email: "sora@example.com", joinedAt: "2026-07-01", walletAddress: null, walletStatus: null },
  jinyoung: { email: "jinyoung@example.com", joinedAt: "2026-05-03", walletAddress: "inj1...2p8m", walletStatus: "linked" },
  juho: { email: "juho@example.com", joinedAt: "2026-05-12", walletAddress: "inj1...7n3q", walletStatus: "linked" },
  mina: { email: "mina@example.com", joinedAt: "2026-06-04", walletAddress: "inj1...5w6r", walletStatus: "linked" },
  ara: { email: "ara@example.com", joinedAt: "2026-06-20", walletAddress: "inj1...8c1v", walletStatus: "linked" },
};

// deadline: ISO like the BE `submission_deadline`, so the form/table code paths are identical in mock and api mode.
const bountyOverlays: Record<
  string,
  { deadline: string; status?: "reviewing" }
> = {
  "iasset-price-widget": { deadline: "2026-07-14T23:59:00.000Z" },
  "wallet-onboarding-states": { deadline: "2026-07-12T23:59:00.000Z", status: "reviewing" },
  "contract-security-audit": { deadline: "2026-07-19T23:59:00.000Z" },
  "injective-dev-tutorial": { deadline: "2026-07-16T23:59:00.000Z" },
  "helix-volume-analytics": { deadline: "2026-07-21T23:59:00.000Z" },
  "hydro-liquidity-explainer": { deadline: "2026-07-17T23:59:00.000Z" },
  "neptune-api-docs": { deadline: "2026-07-23T23:59:00.000Z" },
  "agent-skill-benchmark": { deadline: "2026-07-10T23:59:00.000Z" },
  "design-system-build": { deadline: "2026-07-03T23:59:00.000Z" },
  "quest-copy-refresh": { deadline: "2026-07-01T23:59:00.000Z" },
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
      // Intake = 지원형 여부. API 모드의 `application_required`와 같은 값이므로 바운티 데이터에서 가져온다.
      intakeEnabled: bounty.applicationRequired ?? false,
      submissionMode: bounty.submissionMode ?? "direct",
      coverImage: bounty.coverImage || null,
      // The public status has no draft/funding/cancelled; a finished public bounty is a completed one.
      status: overlay.status ?? (bounty.status === "closed" ? "completed" : bounty.status),
      deadline: overlay.deadline,
      applicationDeadline: null,
      maxWinners: 1,
      tags: bounty.slug === "iasset-price-widget" ? [bounty.category, "Other"] : [bounty.category],
      description: bounty.descriptionMarkdown ?? bounty.summary,
      submissionGuide: bounty.submissionGuideMarkdown ?? "",
      requirements: (bounty.deliverables ?? []).join("\n"),
      deliverables: [...(bounty.deliverables ?? [])],
      reviewProcess: bounty.reviewProcess ?? "",
    };
  });
}

export function getAdminHighlights(): AdminHighlight[] {
  return hallOfFame.highlights.map((highlight, index) => ({
    id: `highlight-${index + 1}`,
    type: toHighlightTypeCode(highlight.category),
    title: highlight.title,
    description: highlight.body,
    order: index + 1,
    image: null,
    published: true,
    ...(highlight.category === "Featured bounty" ? { link: "/bounties/helix-volume-analytics" } : {}),
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
      eventDate: notice.eventDate ?? null,
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
      eventDate: null,
    },
  ];
}
