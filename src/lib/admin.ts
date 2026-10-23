import { HIGHLIGHT_TYPE_LABELS, toHighlightTypeCode, type HighlightTypeCode } from "./api/codecs";
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
  submissionMode: "direct" | "agent";
  coverImage: string | null;
  status: "draft" | "funding" | "active" | "reviewing" | "closed";
  /** BE `submission_deadline` ISO 원문. mock fixture도 ISO — `bountyToForm`은 ISO가 아닌 값을 조용히 받지 않는다. */
  deadline: string;
  /** BE `application_deadline` — 폼에 입력란이 없으므로 수정 시 그대로 되돌려 준다 */
  applicationDeadline: string | null;
  /** BE `max_winners` — PATCH는 불러온 값을 유지하고, 신규는 1을 보낸다 (폼에 입력란 없음) */
  maxWinners: number;
  tags: Array<"Dev" | "Design" | "Content" | "Other">;
  description: string;
  submissionGuide: string;
  /**
   * BE `requirements` 원문(markdown). `deliverables`는 이 값에서 표시용으로만 파생한다 — PATCH는 어드민이 산출물/제출 가이드
   * 입력란을 고치지 않은 한 이 문자열을 바이트 그대로 되돌려 보낸다 (줄바꿈/들여쓰기를 잃는 join/split 왕복 금지).
   */
  requirements: string;
  /** 표시용: `requirements`의 비어 있지 않은 줄 (trim). 저장은 `requirements`가 기준이다. */
  deliverables: string[];
  reviewProcess: string;
};

/**
 * `type`은 BE 코드 그대로 (`MILESTONE` … `OTHER`, `lib/api/codecs.ts HIGHLIGHT_TYPE_LABELS`). 모르는 코드도 원문을 유지한다:
 * 화면은 코드를 그대로 보여 주고, PATCH는 어드민이 유형을 바꾼 경우에만 `type`을 보낸다.
 */
export type AdminHighlight = {
  id: string;
  type: HighlightTypeCode | (string & {});
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

/**
 * `publish` option for `saveAdminPost`: always sent on create (derived from the chosen status); on edit only when the
 * status toggled. A plain edit omits it so the BE keeps the existing `published_at` - omission is the contract.
 */
export function publishOptionFor(
  previousStatus: AdminPost["status"] | undefined,
  nextStatus: AdminPost["status"],
  mode: "create" | "edit",
): { publish: boolean } | undefined {
  if (mode === "edit" && previousStatus === nextStatus) return undefined;
  return { publish: nextStatus === "published" };
}

/** Same contract for highlights (`is_published` boolean): `publish` only on create or when the published state toggled. */
export function highlightPublishOptionFor(
  previousPublished: boolean | undefined,
  nextPublished: boolean,
  mode: "create" | "edit",
): { publish: boolean } | undefined {
  const toStatus = (published: boolean | undefined): AdminPost["status"] | undefined =>
    published === undefined ? undefined : published ? "published" : "draft";
  return publishOptionFor(toStatus(previousPublished), toStatus(nextPublished) ?? "draft", mode);
}

// Message keys (admin namespace `hallOfFame.highlights.types`) for displayed enum labels; the codes themselves stay API-facing.
export const highlightTypeLabelKeys: Record<HighlightTypeCode, string> = {
  MILESTONE: "milestone",
  FEATURED_BOUNTY: "featuredBounty",
  PROJECT: "project",
  PARTNERSHIP: "partnership",
  AWARD: "award",
  OTHER: "other",
};

/** Message key for a highlight type code, or null for a code this FE does not know (render the raw code instead). */
export function highlightTypeLabelKey(type: string): string | null {
  return type in HIGHLIGHT_TYPE_LABELS ? highlightTypeLabelKeys[type as HighlightTypeCode] : null;
}

/** Deliverables shown for a BE `requirements` string: its non-empty lines, trimmed. Display only - never re-joined for saving. */
export function deliverablesFromRequirements(requirements: string): string[] {
  return requirements.split("\n").map((line) => line.trim()).filter(Boolean);
}

export const postCategoryLabelKeys: Record<AdminPost["category"], string> = {
  "Ninja Labs": "ninjaLabs",
  "Injective ecosystem": "injectiveEcosystem",
  Events: "events",
  Recruitment: "recruitment",
  Other: "other",
};

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
      status: overlay.status ?? bounty.status,
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
