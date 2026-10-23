import { formatUtcDate, safeHttpUrl, toHighlightTypeLabel, type HighlightTypeLabel } from "@/lib/api/codecs";
import { fetchPublicJson, loadFromRuntime } from "@/lib/api/public";

// Stat labels are UI copy: `labelKey` resolves under messages `hallOfFame.stats`.
export type HallStatKey =
  | "bountiesRun"
  | "buildersOnboarded"
  | "ecosystemPartners"
  | "rewardsPaid"
  | "bountiesCompleted"
  | "buildersRewarded"
  | "completionNfts";

export const hallOfFame = {
  stats: [
    { value: "128", labelKey: "bountiesRun" },
    { value: "412", labelKey: "buildersOnboarded" },
    { value: "$-", labelKey: "rewardsPaid" },
  ],
  highlights: [
    { category: "Milestone", title: "100th builder onboarded", body: "New sign-ups completed Google, wallet, NFT, and profile setup in one month.", href: "/notices" },
    { category: "Featured bounty", title: "Helix analytics module shipped", body: "A bounty deliverable became a reusable market activity card for the DEX team.", href: "/bounties/helix-volume-analytics" },
    { category: "Partnership", title: "Hydro opens content bounties", body: "New educational tasks bring liquidity, vaults, and staking content into the board.", href: "/notices" },
  ],
  milestones: [
    { title: "First bounty", date: "May 3, 2026", description: "Injective price widget posted for public builders." },
    { title: "100th builder", date: "June 11, 2026", description: "Verified profiles crossed the first community marker." },
    { title: "Partnership", date: "June 25, 2026", description: "Helix and Hydro opened recurring sponsor queues." },
  ],
} as const;

type HighlightRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  published_at: string | null;
};
type StatsRow = { completedBounties: number; builders: number; completionNfts: number; sponsors: number };

export type RuntimeHallOfFame = {
  stats: Array<{ value: string; labelKey: HallStatKey }>;
  /** `category` is the display label of a BE highlight type (`codecs.ts HIGHLIGHT_TYPE_LABELS`); an unknown code shows as "Other". */
  highlights: Array<{ category: HighlightTypeLabel; title: string; body: string; href: string; image: string | null }>;
  milestones: Array<{ title: string; date: string; description: string }>;
  /** Partner wall: published Partnership highlights that carry a logo image. Empty → the wall is hidden. */
  partners: Array<{ name: string; logo: string; href: string | null }>;
};

export const emptyHallOfFame: RuntimeHallOfFame = { stats: [], highlights: [], milestones: [], partners: [] };

/** `locale` formats API dates for display and comes from the server page; see `getRuntimeBounties` for why it is a parameter. */
export function getRuntimeHallOfFame(locale: string): Promise<RuntimeHallOfFame> {
  return loadFromRuntime({ mock: mockHallOfFame, api: () => fetchHallOfFame(locale) });
}

function mockHallOfFame(): RuntimeHallOfFame {
  return {
    stats: [...hallOfFame.stats],
    highlights: hallOfFame.highlights.map((item) => ({ ...item, image: null })),
    milestones: [...hallOfFame.milestones],
    partners: [],
  };
}

async function fetchHallOfFame(locale: string): Promise<RuntimeHallOfFame> {
  const [rows, stats] = await Promise.all([
    fetchPublicJson<HighlightRow[]>("/hall-of-fame"),
    fetchPublicJson<StatsRow>("/hall-of-fame/stats"),
  ]);
  const category = (type: string): HighlightTypeLabel => toHighlightTypeLabel(type) ?? "Other";
  return {
    stats: [
      { value: String(stats.completedBounties), labelKey: "bountiesCompleted" },
      { value: String(stats.builders), labelKey: "buildersRewarded" },
      { value: String(stats.completionNfts), labelKey: "completionNfts" },
    ],
    // Admin-entered link/image URLs are rendered as href/src on the page: unsafe ones fall back to no link / placeholder.
    highlights: rows.map((row) => ({
      category: category(row.type),
      title: row.title,
      body: row.description,
      href: safeHttpUrl(row.link_url) ?? "/notices",
      image: safeHttpUrl(row.image_url),
    })),
    milestones: rows.filter((row) => row.type === "MILESTONE").map((row) => ({
      title: row.title,
      date: formatUtcDate(row.published_at, locale, { year: "numeric", month: "long", day: "numeric" }),
      description: row.description,
    })),
    partners: rows.flatMap((row) => {
      const logo = row.type === "PARTNERSHIP" ? safeHttpUrl(row.image_url) : null;
      return logo ? [{ name: row.title, logo, href: safeHttpUrl(row.link_url) }] : [];
    }),
  };
}

/** Page-level loader: an unreachable API renders an unavailable state instead of the error boundary. */
export async function loadRuntimeHallOfFame(locale: string): Promise<{ hallOfFame: RuntimeHallOfFame; unavailable: boolean }> {
  try {
    return { hallOfFame: await getRuntimeHallOfFame(locale), unavailable: false };
  } catch {
    return { hallOfFame: emptyHallOfFame, unavailable: true };
  }
}
