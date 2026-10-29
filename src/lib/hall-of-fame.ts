import { formatUnits } from "viem";
import { formatUtcDate, safeHttpUrl, toHighlightTypeLabel, type HighlightTypeLabel } from "@/lib/api/codecs";
import { fetchPublicJson, loadFromRuntime } from "@/lib/api/public";
import { formatTokenAmount } from "@/lib/format";

// Stat labels are UI copy: `labelKey` resolves under messages `hallOfFame.stats`.
export type HallStatKey =
  | "bountiesRun"
  | "buildersOnboarded"
  | "ecosystemPartners"
  | "rewardsPaid"
  | "bountiesCompleted"
  | "buildersRewarded"
  | "completionNfts";

/** One `GET /hall-of-fame/stats` `paidTotals` entry: PAID payouts summed per token, `amount` in base units. */
export type PaidTotalRow = { symbol: string; tokenType: string; decimals: number | null; amount: string };

export const hallOfFame = {
  stats: [
    { value: "128", labelKey: "bountiesRun" },
    { value: "412", labelKey: "buildersOnboarded" },
  ],
  /** Mock-mode `paidTotals`, shaped like the API so both modes share `formatPaidTotals`. */
  paidTotals: [
    { symbol: "USDC", tokenType: "ERC20", decimals: 6, amount: "12500000000" },
    { symbol: "INJ", tokenType: "NATIVE", decimals: 18, amount: "300000000000000000000" },
  ] satisfies PaidTotalRow[],
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
type StatsRow = {
  completedBounties: number;
  builders: number;
  completionNfts: number;
  sponsors: number;
  /** Optional so an older BE without the field still renders (the stat is just hidden). */
  paidTotals?: PaidTotalRow[];
};

/**
 * Display form of a stat value: a plain count gets the locale's digit grouping ("1,234"), the already-formatted paid total
 * ("12,500 USDC · 300 INJ") passes through. One rule for the landing hero and the Hall of Fame stat cards, which read the same stats.
 */
export function formatStatValue(value: string, locale: string): string {
  return /^\d+$/.test(value) ? new Intl.NumberFormat(locale).format(Number(value)) : value;
}

/** A stat value with no non-zero digit ("0", "0 USDC", "") counts as zero. */
export function isZeroStatValue(value: string): boolean {
  return !/[1-9]/.test(value);
}

/**
 * Stats to show: none while every value is zero, so a brand-new platform does not open on a row of zeros. The block comes
 * back on its own as soon as one value is above zero. One rule for the bounty hero, the Intro/About achievements and the Hall of Fame.
 */
export function visibleStats<T extends { value: string }>(stats: readonly T[]): T[] {
  return stats.every((stat) => isZeroStatValue(stat.value)) ? [] : [...stats];
}

/** Paid totals show with at most this many fraction digits - a headline stat, not a ledger. */
const PAID_TOTAL_FRACTION_DIGITS = 2;

/**
 * `paidTotals` → one display string, e.g. "12,500 USDC · 300 INJ" (API order). Entries the client cannot scale
 * (unknown `decimals`, non-integer amount, zero) are skipped rather than shown in the wrong unit; null when nothing is left,
 * so the "Rewards paid" stat is hidden instead of showing a placeholder.
 * The BE groups by (symbol, token type), so one symbol can arrive twice (e.g. INJ as NATIVE and CW20). The display has no
 * token type, so entries with the same symbol and decimals are summed into one part instead of rendering "300 INJ · 5 INJ".
 */
export function formatPaidTotals(rows: readonly PaidTotalRow[] | undefined, locale: string): string | null {
  const totals = new Map<string, { symbol: string; decimals: number; amount: bigint }>();
  for (const { symbol, decimals, amount } of rows ?? []) {
    if (decimals === null || !Number.isInteger(decimals) || decimals < 0 || !/^\d+$/.test(amount)) continue;
    const key = `${symbol}\u0000${decimals}`;
    const entry = totals.get(key) ?? { symbol, decimals, amount: BigInt(0) };
    entry.amount += BigInt(amount);
    totals.set(key, entry);
  }
  const parts = [...totals.values()]
    .filter(({ amount }) => amount > BigInt(0))
    .map(({ symbol, decimals, amount }) => `${formatTokenAmount(formatUnits(amount, decimals), locale, PAID_TOTAL_FRACTION_DIGITS)} ${symbol}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function withPaidTotal(stats: RuntimeHallOfFame["stats"], rows: readonly PaidTotalRow[] | undefined, locale: string): RuntimeHallOfFame["stats"] {
  const value = formatPaidTotals(rows, locale);
  return value ? [...stats, { value, labelKey: "rewardsPaid" }] : stats;
}

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
  return loadFromRuntime({ mock: () => mockHallOfFame(locale), api: () => fetchHallOfFame(locale) });
}

function mockHallOfFame(locale: string): RuntimeHallOfFame {
  return {
    stats: withPaidTotal([...hallOfFame.stats], hallOfFame.paidTotals, locale),
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
    stats: withPaidTotal(
      [
        { value: String(stats.completedBounties), labelKey: "bountiesCompleted" },
        { value: String(stats.builders), labelKey: "buildersRewarded" },
        { value: String(stats.completionNfts), labelKey: "completionNfts" },
      ],
      stats.paidTotals,
      locale,
    ),
    // Admin-entered link/image URLs are rendered as href/src on the page: unsafe ones fall back to no link / placeholder.
    // A partnership with a logo is shown on the partner wall only, so a long partner list does not flood the cards.
    highlights: rows.filter((row) => !partnerLogo(row)).map((row) => ({
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
      const logo = partnerLogo(row);
      return logo ? [{ name: row.title, logo, href: safeHttpUrl(row.link_url) }] : [];
    }),
  };
}

function partnerLogo(row: HighlightRow): string | null {
  return row.type === "PARTNERSHIP" ? safeHttpUrl(row.image_url) : null;
}
