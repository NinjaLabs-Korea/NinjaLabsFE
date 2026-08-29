import type { Member, Profile } from "./types";
import { loadRuntimeConfig } from "./runtime/config";
import { onboardingLog } from "./onboarding-log";
import { fetchPublicJson } from "./api/public";

export const PROFILE_EMPTY_ID = "sora";

const members: Member[] = [
  { slug: "jinyoung", name: "Jinyoung Park", initials: "JP", role: "Core", title: "Product lead", bio: "Building the bounty marketplace for the Injective ecosystem.", isMember: true, links: { profile: "/members/jinyoung", posts: "/notices" } },
  { slug: "juho", name: "Juho Kim", initials: "JK", role: "Dev", title: "Protocol engineer", bio: "Making on-chain proof useful for every builder.", isMember: true, links: { profile: "/members/juho", agents: "/members/juho" } },
  { slug: "mina", name: "Mina Seo", initials: "MS", role: "Design", title: "Experience", bio: "Designing clear paths from first task to lasting proof.", isMember: true, links: { profile: "/members/mina", bounties: "/bounties" } },
  { slug: "ara", name: "Ara Choi", initials: "AR", role: "Ops", title: "Community", bio: "Supporting builders and the community around their work.", isMember: true, links: { profile: "/members/ara", notices: "/notices" } },
];

export const profiles: Record<string, Profile> = {
  jaemin: {
    slug: "jaemin", handle: "jaemin.inj", initials: "JM", bio: "Builder focused on useful tools and thoughtful experiences for the Injective ecosystem.", skills: ["Dev", "Design"], joinedAt: "May 2026",
    completions: [
      { title: "iAsset widget", category: "Dev", completedAt: "June 18, 2026", reward: { amount: 500, currency: "INJ" } },
      { title: "Wallet flow", category: "Design", completedAt: "June 10, 2026", reward: { amount: 300, currency: "USDC" } },
      { title: "Hydro guide", category: "Content", completedAt: "May 28, 2026", reward: { amount: 180, currency: "INJ" } },
      { title: "Audit report", category: "Dev", completedAt: "May 21, 2026", reward: { amount: 0, currency: "INJ" } },
      { title: "Docs revamp", category: "Content", completedAt: "May 14, 2026", reward: { amount: 0, currency: "INJ" } },
      { title: "Helix card", category: "Design", completedAt: "May 8, 2026", reward: { amount: 0, currency: "INJ" } },
      { title: "Quest copy", category: "Content", completedAt: "May 1, 2026", reward: { amount: 0, currency: "INJ" } },
    ],
    nfts: ["iAsset widget", "Wallet flow", "Audit report", "Docs revamp", "Hydro guide", "Helix card", "Quest copy"].map((title, index) => ({ id: `preview-nft-${index}`, type: "completion" as const, title, status: "ATTACHED" as const, contractAddress: "preview", tokenId: String(index + 1), mintTxHash: null })),
    agents: [{ name: "market-scout-agent", wallet: "inj1...9k4d", verified: true, completedBounties: 3 }, { name: "proof-collector", wallet: "inj1...4r2m", verified: true, completedBounties: 2 }],
  },
  sora: { slug: "sora", handle: "sora.inj", initials: "SK", bio: "A new builder preparing to contribute to the Injective ecosystem.", skills: ["Dev", "Content"], joinedAt: "July 2026", completions: [], nfts: [], agents: [] },
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

const memberRoleLabels = { CORE: "Core", DEV: "Dev", DESIGN: "Design", OPS: "Ops" } as const;

export async function getRuntimeMembers(): Promise<Member[]> {
  if (loadRuntimeConfig().runtimeMode === "mock") return getMembers();
  const rows = await fetchPublicJson<MemberRow[]>("/members");
  return rows.map((row) => ({
    slug: row.nickname,
    name: row.nickname,
    initials: row.nickname.slice(0, 2).toUpperCase(),
    role: memberRoleLabels[row.member_role] ?? "Core",
    title: "Ninja Labs member",
    bio: row.bio || "Building in the Injective ecosystem.",
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
    rewards: Array<{ amount: string; symbol: string }>;
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

const categoryMap = {
  DEV: "Dev",
  DESIGN: "Design",
  CONTENT: "Content",
  OTHER: "Other",
} as const;

function toProfile(data: PublicProfileResponse): Profile {
  const completions = data.completedBounties.flatMap((completion) => {
    const category = categoryMap[completion.category as keyof typeof categoryMap];
    if (!category) return [];
    const reward = completion.rewards[0];
    const currency: "USDC" | "INJ" = reward?.symbol === "USDC" ? "USDC" : "INJ";
    const decimals = currency === "USDC" ? 6 : 18;
    return [{
      bountySlug: completion.id,
      title: completion.title,
      category,
      completedAt: new Date(completion.completed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      reward: {
        amount: reward ? Number(reward.amount) / 10 ** decimals : 0,
        currency,
      },
    }];
  });

  return {
    slug: data.nickname,
    handle: data.nickname,
    initials: data.nickname.slice(0, 2).toUpperCase(),
    bio: data.bio,
    skills: data.tags.flatMap((tag) => {
      const category = categoryMap[tag as keyof typeof categoryMap];
      return category ? [category] : [];
    }),
    joinedAt: new Date(data.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    }),
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

export async function getRuntimeProfile(slug: string): Promise<Profile | undefined> {
  const config = loadRuntimeConfig();
  if (config.runtimeMode === "mock") {
    onboardingLog("public-profile.mock.resolved", { slug, found: Boolean(getProfile(slug)) });
    return getProfile(slug);
  }

  try {
    onboardingLog("public-profile.fetch.started", { slug });
    const response = await fetch(
      `${config.apiUrl!.replace(/\/$/, "")}/users/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    onboardingLog("public-profile.fetch.completed", { slug, status: response.status });
    if (!response.ok) return undefined;
    return toProfile((await response.json()) as PublicProfileResponse);
  } catch (caught) {
    onboardingLog("public-profile.fetch.failed", {
      slug,
      errorName: caught instanceof Error ? caught.name : "UnknownError",
    });
    return undefined;
  }
}
