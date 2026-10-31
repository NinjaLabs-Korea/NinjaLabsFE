import { formatUtcDate, toCategoryLabel, toMemberRoleLabel, toPayoutStatus, toRewards, type RewardRow } from "./api/codecs";
import type { Completion, Member, PayoutStatus, Profile, Reward } from "./types";
import { nicknameInitials } from "./nickname";
import { onboardingLog } from "./onboarding-log";
import { cache } from "react";
import { fetchPublicJson, isPublicNotFound, loadFromRuntime, PUBLIC_DETAIL_FETCH, PUBLIC_LIST_REVALIDATE_SECONDS } from "./api/public";

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
  jinyoung: { slug: "jinyoung", handle: "jinyoung.inj", initials: "JP", teamRole: "Core", bio: "Product lead building the bounty marketplace for the Injective ecosystem.", skills: ["Dev", "Design"], joinedAt: "May 2026", completions: [], nfts: [], agents: [] },
  juho: { slug: "juho", handle: "juho.inj", initials: "JK", teamRole: "Dev", bio: "Protocol engineer making on-chain proof useful for every builder.", skills: ["Dev"], joinedAt: "May 2026", completions: [], nfts: [], agents: [] },
  mina: { slug: "mina", handle: "mina.inj", initials: "MS", teamRole: "Design", bio: "Experience designer creating clear paths from first task to lasting proof.", skills: ["Design"], joinedAt: "June 2026", completions: [], nfts: [], agents: [] },
  ara: { slug: "ara", handle: "ara.inj", initials: "AR", teamRole: "Ops", bio: "Community operator supporting builders and the work around them.", skills: ["Content"], joinedAt: "June 2026", completions: [], nfts: [], agents: [] },
};

export function getMembers() { return members.filter((member) => member.isMember); }
// Own keys only: `slug` comes from the URL, and `profiles["constructor"]` / `["__proto__"]` would otherwise resolve to Object.prototype members.
export function getProfile(slug: string): Profile | undefined { return Object.hasOwn(profiles, slug) ? profiles[slug] : undefined; }

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
  const rows = await fetchPublicJson<MemberRow[]>("/members", { revalidateSeconds: PUBLIC_LIST_REVALIDATE_SECONDS });
  return rows.map((row) => ({
    slug: row.nickname,
    name: row.nickname,
    initials: nicknameInitials(row.nickname),
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
  /** Official team member flag and role (absent on an older BE) */
  is_member?: boolean;
  member_role?: string | null;
  created_at: string;
  tags: string[];
  completedBounties: Array<{
    id: string;
    title: string;
    category: string;
    completed_at: string;
    /** payouts actually PAID for this submission (older BE: the only reward field) */
    rewards: RewardRow[];
    /** the bounty's posted rewards - shown while the payout is PENDING (absent on older BE) */
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

/** The primary (first displayable) reward plus how many further displayable ones the row carries (multi-token bounties). */
const rewardSummary = (rows: readonly RewardRow[] | undefined): { reward: Reward | null; moreRewards?: number } => {
  const [reward = null, ...rest] = toRewards(rows ?? []);
  return rest.length > 0 ? { reward, moreRewards: rest.length } : { reward };
};

/**
 * `payoutStatus` + `postedRewards` are newer BE fields: PAID shows the paid payout, PARTIALLY_PAID the paid payout so far
 * (badge), PENDING the posted reward (badge), NONE nothing - unless paid `rewards` exist, which renders as PAID. An unknown value is read as PENDING. An older BE only sends
 * `rewards` (paid payouts), so a missing `payoutStatus` is derived from whether anything was paid.
 * A bounty can pay several tokens (one payout row each): the first is shown and `moreRewards` counts the rest, like the
 * `+N` on a bounty card, so a profile never reads as if only one token was paid.
 */
export function toCompletionReward(row: Pick<PublicProfileResponse["completedBounties"][number], "rewards" | "postedRewards" | "payoutStatus">): Pick<Completion, "reward" | "moreRewards" | "payoutStatus"> {
  const paid = rewardSummary(row.rewards);
  const status: PayoutStatus = toPayoutStatus(row.payoutStatus) ?? (paid.reward ? "PAID" : "NONE");
  if (status === "PAID" || (status === "NONE" && paid.reward)) return { ...paid, payoutStatus: paid.reward ? "PAID" : "NONE" };
  if (status === "PARTIALLY_PAID") return { ...paid, payoutStatus: "PARTIALLY_PAID" };
  if (status === "PENDING") return { ...rewardSummary(row.postedRewards), payoutStatus: "PENDING" };
  return { reward: null, payoutStatus: "NONE" };
}

export { payoutBadge } from "./payout";

function teamRoleField(code: string): { teamRole?: Member["role"] } {
  const teamRole = toMemberRoleLabel(code);
  return teamRole ? { teamRole } : {};
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
    initials: nicknameInitials(data.nickname),
    bio: data.bio,
    ...(data.is_member && data.member_role ? teamRoleField(data.member_role) : {}),
    skills: data.tags.flatMap((tag) => {
      const category = toCategoryLabel(tag);
      return category ? [category] : [];
    }),
    joinedAt: formatUtcDate(data.created_at, locale, { year: "numeric", month: "long" }),
    completions,
    nfts: data.nfts.map((nft) => ({
      id: nft.id,
      type: nft.nft_type === "NINJA_PARENT" ? "parent" : "completion",
      // "" when the NFT's bounty was deleted: the page shows a localized fallback (a literal here would be English on every locale).
      title: nft.bounty_title ?? "",
      status: nft.status,
      contractAddress: nft.contract_address,
      tokenId: nft.token_id,
      mintTxHash: nft.mint_tx_hash,
    })),
    // The BE sends every non-deleted agent of the owner; the public card only lists live ones. A pending registration
    // (unproven wallet) or a revoked agent is not "my verified agent" and must not put its wallet on a public page.
    agents: data.agents.filter((agent) => agent.status === "ACTIVE").map((agent) => ({
      name: agent.name,
      wallet: agent.wallet_address,
      verified: true,
      completedBounties: agent.completed_bounties.length,
    })),
  };
}

/** Label key under `members.nftStatus` for a public NFT tile; `null` = no label (fully attached). */
export type PublicNftStatusKey = "minting" | "minted";

/**
 * Visitors only need "in progress" vs "done". PENDING, MINTING, ATTACHING, FAILED and any status the BE adds later all read as
 * "minting"; a FAILED mint is handled by operators in /admin/nft-jobs, not shown to visitors. ATTACHED is the normal tile: no label.
 */
export function publicNftStatusKey(status: string): PublicNftStatusKey | null {
  if (status === "ATTACHED") return null;
  if (status === "MINTED") return "minted";
  return "minting";
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
