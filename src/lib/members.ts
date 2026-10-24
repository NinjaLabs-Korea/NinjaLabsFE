import { formatUtcDate, toCategoryLabel, toMemberRoleLabel, toPayoutStatus, toReward, type RewardRow } from "./api/codecs";
import type { Completion, Member, PayoutStatus, Profile, ProfileNft, Reward } from "./types";
import { onboardingLog } from "./onboarding-log";
import { cache } from "react";
import { fetchPublicJson, isPublicNotFound, loadFromRuntime, PUBLIC_DETAIL_FETCH } from "./api/public";

/** Mock fixture slugs used by demo affordances (Figma 05 / 05-Empty). */
export const PROFILE_FILLED_EXAMPLE_ID = "jaemin";
export const PROFILE_EMPTY_ID = "sora";

const members: Member[] = [
  { slug: "jinyoung", name: "Jinyoung Park", initials: "JP", role: "Core", title: "Product lead", bio: "Sets bounty quality standards and coordinates sponsor review loops.", isMember: true, links: { profile: "/members/jinyoung", posts: "/notices" } },
  { slug: "juho", name: "Juho Kim", initials: "JK", role: "Dev", title: "Protocol engineer", bio: "Reviews CosmWasm deliverables and supports agent verification design.", isMember: true, links: { profile: "/members/juho", agents: "/members/juho" } },
  { slug: "mina", name: "Mina Seo", initials: "MS", role: "Design", title: "Experience", bio: "Shapes onboarding, badge states, and public profile presentation.", isMember: true, links: { profile: "/members/mina", bounties: "/bounties" } },
  { slug: "ara", name: "Ara Choi", initials: "AR", role: "Ops", title: "Community", bio: "Publishes notices and keeps member, sponsor, and builder updates current.", isMember: true, links: { profile: "/members/ara", notices: "/notices" } },
];

export const profiles: Record<string, Profile> = {
  jaemin: {
    slug: "jaemin", handle: "jaemin.inj", initials: "JM", bio: "Frontend builder focused on wallet onboarding, market data surfaces, and developer tools for Injective teams. Ships small, polished interfaces that sponsors can adopt without a long handoff.", skills: ["Dev", "Design"], joinedAt: "May 2026",
    completions: [
      { bountySlug: "iasset-price-widget", title: "Build an iAsset price widget", category: "Dev", completedAt: "July 2, 2026", reward: { amount: 500, currency: "INJ" }, payoutStatus: "PAID" },
      // Some payouts PAID, one still open: the paid amount so far shows with the "partially paid" badge (FE-designed, like PENDING).
      { bountySlug: "helix-volume-analytics", title: "Helix volume analytics", category: "Dev", completedAt: "June 28, 2026", reward: { amount: 250, currency: "INJ" }, payoutStatus: "PARTIALLY_PAID" },
      { bountySlug: "wallet-onboarding-states", title: "Design wallet onboarding states", category: "Design", completedAt: "June 24, 2026", reward: { amount: 300, currency: "USDC" }, payoutStatus: "PAID" },
      // Approved but not paid out yet: the posted reward shows with the "payout pending" badge (Figma 05 has no such state; FE-designed).
      { bountySlug: "hydro-liquidity-explainer", title: "Hydro liquidity explainer", category: "Content", completedAt: "June 18, 2026", reward: { amount: 180, currency: "INJ" }, payoutStatus: "PENDING" },
      { title: "Audit report", category: "Dev", completedAt: "May 21, 2026", reward: null, payoutStatus: "NONE" },
      { title: "Docs revamp", category: "Content", completedAt: "May 14, 2026", reward: null, payoutStatus: "NONE" },
      { title: "Helix card", category: "Design", completedAt: "May 8, 2026", reward: null, payoutStatus: "NONE" },
      { title: "Quest copy", category: "Content", completedAt: "May 1, 2026", reward: null, payoutStatus: "NONE" },
    ],
    nfts: ["iAsset widget", "Wallet flow", "Audit report", "Docs revamp", "Hydro guide", "Helix card", "Quest copy"].map((title, index) => ({ id: `preview-nft-${index}`, type: "completion" as const, title, status: "ATTACHED" as const, contractAddress: "preview", tokenId: String(index + 1), mintTxHash: null })),
    agents: [{ name: "market-scout-agent", wallet: "inj1...9k4d", verified: true, completedBounties: 3 }, { name: "docs-runner-agent", wallet: "inj1...x7ab", verified: true, completedBounties: 2 }],
  },
  sora: { slug: "sora", handle: "sora.inj", initials: "SK", bio: "New Injective builder exploring market data tasks, documentation bounties, and small UI components. This public profile is ready to become a portfolio as work is completed.", skills: ["Dev", "Content"], joinedAt: "July 2026", completions: [], nfts: [{ id: "sora-parent", type: "parent", title: "Ninja NFT", status: "MINTED", contractAddress: "preview", tokenId: "1", mintTxHash: null }], agents: [] },
  jinyoung: { slug: "jinyoung", handle: "jinyoung.inj", initials: "JP", bio: "Product lead building the bounty marketplace for the Injective ecosystem.", skills: ["Dev", "Design"], joinedAt: "May 2026", completions: [], nfts: [], agents: [] },
  juho: { slug: "juho", handle: "juho.inj", initials: "JK", bio: "Protocol engineer making on-chain proof useful for every builder.", skills: ["Dev"], joinedAt: "May 2026", completions: [], nfts: [], agents: [] },
  mina: { slug: "mina", handle: "mina.inj", initials: "MS", bio: "Experience designer creating clear paths from first task to lasting proof.", skills: ["Design"], joinedAt: "June 2026", completions: [], nfts: [], agents: [] },
  ara: { slug: "ara", handle: "ara.inj", initials: "AR", bio: "Community operator supporting builders and the work around them.", skills: ["Content"], joinedAt: "June 2026", completions: [], nfts: [], agents: [] },
};

export function getMembers() { return members.filter((member) => member.isMember); }
export function getProfile(slug: string) { return profiles[slug]; }

type MemberRow = {
  id: string;
  nickname: string;
  bio: string;
  member_role: "CORE" | "DEV" | "DESIGN" | "OPS";
  links: Array<{ type: string; url: string }>;
};

export function getRuntimeMembers(): Promise<Member[]> {
  return loadFromRuntime({ mock: getMembers, api: fetchMembers });
}

async function fetchMembers(): Promise<Member[]> {
  const rows = await fetchPublicJson<MemberRow[]>("/members");
  return rows.map((row) => ({
    slug: row.nickname,
    name: row.nickname,
    initials: row.nickname.slice(0, 2).toUpperCase(),
    role: toMemberRoleLabel(row.member_role) ?? "Core",
    // Empty title/bio fall back to localized defaults in MemberCard.
    title: "",
    bio: row.bio,
    isMember: true,
    links: { profile: `/members/${row.nickname}` },
  }));
}

type PublicProfileResponse = {
  nickname: string;
  bio: string;
  created_at: string;
  tags: string[];
  completedBounties: Array<{
    id: string;
    title: string;
    category: string;
    completed_at: string;
    /** payouts actually PAID for this submission (older BE: the only reward field) */
    rewards: RewardRow[];
    /** the bounty's posted rewards — shown while the payout is PENDING (absent on older BE) */
    postedRewards?: RewardRow[];
    /** `PayoutStatus`; typed as string because a newer BE may add values (read as PENDING) */
    payoutStatus?: string;
  }>;
  agents: Array<{
    name: string;
    status: string;
    wallet_address: string;
    completed_bounties: unknown[];
  }>;
  nfts: Array<{
    id: string;
    nft_type: "NINJA_PARENT" | "BOUNTY_COMPLETION_CHILD";
    status: "PENDING" | "MINTING" | "MINTED" | "ATTACHING" | "ATTACHED" | "FAILED";
    contract_address: string;
    token_id: string | null;
    mint_tx_hash: string | null;
    bounty_title: string | null;
  }>;
};

const firstReward = (rows: readonly RewardRow[] | undefined): Reward | null => (rows?.[0] ? toReward(rows[0]) : null);

/**
 * `payoutStatus` + `postedRewards` are newer BE fields: PAID shows the paid payout, PARTIALLY_PAID the paid payout so far
 * (badge), PENDING the posted reward (badge), NONE nothing. An unknown value is read as PENDING. An older BE only sends
 * `rewards` (paid payouts), so a missing `payoutStatus` is derived from whether anything was paid.
 */
export function toCompletionReward(row: Pick<PublicProfileResponse["completedBounties"][number], "rewards" | "postedRewards" | "payoutStatus">): Pick<Completion, "reward" | "payoutStatus"> {
  const paid = firstReward(row.rewards);
  const status: PayoutStatus = toPayoutStatus(row.payoutStatus) ?? (paid ? "PAID" : "NONE");
  if (status === "PAID") return { reward: paid, payoutStatus: paid ? "PAID" : "NONE" };
  if (status === "PARTIALLY_PAID") return { reward: paid, payoutStatus: "PARTIALLY_PAID" };
  if (status === "PENDING") return { reward: firstReward(row.postedRewards), payoutStatus: "PENDING" };
  return { reward: null, payoutStatus: "NONE" };
}

/** Badge under a completion card: an unfinished payout is flagged so a shown amount is never read as fully paid. */
export function payoutBadge(status: PayoutStatus): { variant: "warning"; key: "payoutPending" | "payoutPartial" } | null {
  if (status === "PENDING") return { variant: "warning", key: "payoutPending" };
  if (status === "PARTIALLY_PAID") return { variant: "warning", key: "payoutPartial" };
  return null;
}

function toProfile(data: PublicProfileResponse, locale: string): Profile {
  const completions = data.completedBounties.flatMap((completion) => {
    const category = toCategoryLabel(completion.category);
    if (!category) return [];
    return [{
      bountySlug: completion.id,
      title: completion.title,
      category,
      completedAt: formatUtcDate(completion.completed_at, locale, { year: "numeric", month: "long", day: "numeric" }),
      ...toCompletionReward(completion),
    }];
  });

  return {
    slug: data.nickname,
    handle: data.nickname,
    initials: data.nickname.slice(0, 2).toUpperCase(),
    bio: data.bio,
    skills: data.tags.flatMap((tag) => {
      const category = toCategoryLabel(tag);
      return category ? [category] : [];
    }),
    joinedAt: formatUtcDate(data.created_at, locale, { year: "numeric", month: "long" }),
    completions,
    nfts: data.nfts.map((nft) => ({
      id: nft.id,
      type: nft.nft_type === "NINJA_PARENT" ? "parent" : "completion",
      title: nft.bounty_title ?? "Ninja NFT",
      status: nft.status,
      contractAddress: nft.contract_address,
      tokenId: nft.token_id,
      mintTxHash: nft.mint_tx_hash,
    })),
    agents: data.agents.map((agent) => ({
      name: agent.name,
      wallet: agent.wallet_address,
      verified: agent.status === "ACTIVE",
      completedBounties: agent.completed_bounties.length,
    })),
  };
}

export type ParentNftState = "minted" | "pending" | "none";

/**
 * Where the member's parent Ninja NFT stands, from the public profile's NFT list. Only a parent that is on chain
 * (MINTED, or further along) counts as minted; PENDING/MINTING is in progress; no parent row or FAILED is "not minted".
 */
export function parentNftState(nfts: readonly Pick<ProfileNft, "type" | "status">[]): ParentNftState {
  const parents = nfts.filter((nft) => nft.type === "parent");
  if (parents.some((nft) => nft.status === "MINTED" || nft.status === "ATTACHING" || nft.status === "ATTACHED")) return "minted";
  if (parents.some((nft) => nft.status === "PENDING" || nft.status === "MINTING")) return "pending";
  return "none";
}

/** `members.profile.portfolio.*` key for the portfolio intro paragraph. */
export function portfolioBodyKey(completed: boolean, parent: ParentNftState) {
  if (completed) return "bodyCompleted" as const;
  return parent === "minted" ? ("bodyEmpty" as const) : parent === "pending" ? ("bodyEmptyPending" as const) : ("bodyEmptyNotMinted" as const);
}

/**
 * `locale` formats API dates for display and comes from the server page; see `getRuntimeBounties` for why it is a parameter.
 * `undefined` only on a BE 404, otherwise rethrows; `cache()` shares one BE request per render (see `getRuntimeBounty`).
 */
export const getRuntimeProfile = cache((slug: string, locale: string): Promise<Profile | undefined> =>
  loadFromRuntime({
    mock: () => {
      onboardingLog("public-profile.mock.resolved", { slug, found: Boolean(getProfile(slug)) });
      return getProfile(slug);
    },
    api: async () => {
      try {
        onboardingLog("public-profile.fetch.started", { slug });
        const data = await fetchPublicJson<PublicProfileResponse>(`/users/${encodeURIComponent(slug)}`, PUBLIC_DETAIL_FETCH);
        onboardingLog("public-profile.fetch.completed", { slug });
        return toProfile(data, locale);
      } catch (caught) {
        const notFound = isPublicNotFound(caught);
        onboardingLog("public-profile.fetch.failed", {
          slug,
          notFound,
          errorName: caught instanceof Error ? caught.name : "UnknownError",
        });
        if (notFound) return undefined;
        throw caught;
      }
    },
  }),
);
