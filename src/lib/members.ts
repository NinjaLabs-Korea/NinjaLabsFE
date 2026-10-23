import { formatUtcDate, toCategoryLabel, toMemberRoleLabel, toReward, type RewardRow } from "./api/codecs";
import type { Completion, Member, PayoutStatus, Profile, Reward } from "./types";
import { onboardingLog } from "./onboarding-log";
import { fetchPublicJson, loadFromRuntime } from "./api/public";

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
  sora: { slug: "sora", handle: "sora.inj", initials: "SK", bio: "New Injective builder exploring market data tasks, documentation bounties, and small UI components. This public profile is ready to become a portfolio as work is completed.", skills: ["Dev", "Content"], joinedAt: "July 2026", completions: [], nfts: [], agents: [] },
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
    payoutStatus?: PayoutStatus;
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
 * `payoutStatus` + `postedRewards` are newer BE fields: PAID shows the paid payout, PENDING the posted reward (badge), NONE nothing.
 * An older BE only sends `rewards` (paid payouts), so a missing `payoutStatus` is derived from whether anything was paid.
 */
export function toCompletionReward(row: Pick<PublicProfileResponse["completedBounties"][number], "rewards" | "postedRewards" | "payoutStatus">): Pick<Completion, "reward" | "payoutStatus"> {
  const paid = firstReward(row.rewards);
  const status: PayoutStatus = row.payoutStatus ?? (paid ? "PAID" : "NONE");
  if (status === "PAID") return { reward: paid, payoutStatus: paid ? "PAID" : "NONE" };
  if (status === "PENDING") return { reward: firstReward(row.postedRewards), payoutStatus: "PENDING" };
  return { reward: null, payoutStatus: "NONE" };
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

/** `locale` formats API dates for display and comes from the server page; see `getRuntimeBounties` for why it is a parameter. */
export function getRuntimeProfile(slug: string, locale: string): Promise<Profile | undefined> {
  return loadFromRuntime({
    mock: () => {
      onboardingLog("public-profile.mock.resolved", { slug, found: Boolean(getProfile(slug)) });
      return getProfile(slug);
    },
    api: async () => {
      try {
        onboardingLog("public-profile.fetch.started", { slug });
        const data = await fetchPublicJson<PublicProfileResponse>(`/users/${encodeURIComponent(slug)}`);
        onboardingLog("public-profile.fetch.completed", { slug });
        return toProfile(data, locale);
      } catch (caught) {
        onboardingLog("public-profile.fetch.failed", {
          slug,
          errorName: caught instanceof Error ? caught.name : "UnknownError",
        });
        return undefined;
      }
    },
  });
}
