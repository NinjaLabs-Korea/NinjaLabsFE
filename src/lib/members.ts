import type { Member, Profile } from "./types";

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
    childNfts: ["iAsset widget", "Wallet flow", "Audit report", "Docs revamp", "Hydro guide", "Helix card", "Quest copy"].map((title) => ({ title })),
    agents: [{ name: "market-scout-agent", wallet: "inj1...9k4d", verified: true, completedBounties: 3 }, { name: "proof-collector", wallet: "inj1...4r2m", verified: true, completedBounties: 2 }],
  },
  sora: { slug: "sora", handle: "sora.inj", initials: "SK", bio: "A new builder preparing to contribute to the Injective ecosystem.", skills: ["Dev", "Content"], joinedAt: "July 2026", completions: [], childNfts: [], agents: [] },
  jinyoung: { slug: "jinyoung", handle: "jinyoung.inj", initials: "JP", bio: "Product lead building the bounty marketplace for the Injective ecosystem.", skills: ["Dev", "Design"], joinedAt: "May 2026", completions: [], childNfts: [], agents: [] },
  juho: { slug: "juho", handle: "juho.inj", initials: "JK", bio: "Protocol engineer making on-chain proof useful for every builder.", skills: ["Dev"], joinedAt: "May 2026", completions: [], childNfts: [], agents: [] },
  mina: { slug: "mina", handle: "mina.inj", initials: "MS", bio: "Experience designer creating clear paths from first task to lasting proof.", skills: ["Design"], joinedAt: "June 2026", completions: [], childNfts: [], agents: [] },
  ara: { slug: "ara", handle: "ara.inj", initials: "AR", bio: "Community operator supporting builders and the work around them.", skills: ["Content"], joinedAt: "June 2026", completions: [], childNfts: [], agents: [] },
};

export function getMembers() { return members.filter((member) => member.isMember); }
export function getProfile(slug: string) { return profiles[slug]; }
