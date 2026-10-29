import type { Bounty, NoticePreview } from './types';
import { getRuntimeBounties } from './bounties';
import { settle } from './api/public';
import { getRuntimeNotices } from './notices';
import { emptyHallOfFame, getRuntimeHallOfFame, visibleStats, type HallStatKey } from './hall-of-fame';

// Two surfaces read this module. The signed-in home (`/home`) takes `getRuntimeLanding` (open bounties + latest notices). The
// bounty hero at the top of `/bounties` (headline, CTAs, NFT portfolio showcase, stats) takes `getBountyHero`; its copy is
// messages `bounties.hero`, the stat `labelKey` resolves under `hallOfFame.stats`. The Intro (`/`) is community copy
// (`landing.hero`) and has no data fixture; its bounty preview takes `getRuntimeOpenBounties`.

export type BountyHero = {
  stats: Array<{ value: string; labelKey: HallStatKey }>;
  portfolio: {
    handle: string;
    memberSince: number;
    completed: string[];
    totalCompleted: number;
  };
  /** The Hall of Fame stats read failed: the hero hides the stats and the "N completed" line instead of showing zeros. */
  statsUnavailable: boolean;
};

/** Showcase fixture of the NFT portfolio card; the completed titles and the count are filled from live data. */
const showcase = { handle: 'ninja.inj', memberSince: 2026 } as const;

export type RuntimeLanding = {
  bounties: Bounty[];
  news: NoticePreview[];
  /** Sections whose API source failed; the page renders an unavailable state instead of throwing. */
  unavailable: { bounties: boolean; news: boolean; stats: boolean };
};

export async function getRuntimeLanding(locale: string): Promise<RuntimeLanding> {
  const [bountiesResult, noticesResult, hallResult] = await Promise.all([
    settle(getRuntimeBounties(locale), []),
    settle(getRuntimeNotices(), []),
    settle(getRuntimeHallOfFame(locale), emptyHallOfFame),
  ]);
  return {
    bounties: bountiesResult.value.filter((bounty) => bounty.status === 'active').slice(0, 4),
    news: noticesResult.value.slice(0, 3),
    unavailable: {
      bounties: bountiesResult.unavailable,
      news: noticesResult.unavailable,
      stats: hallResult.unavailable,
    },
  };
}

/** Open bounties for the hub preview: at most four `active` ones; `[]` when there are none or the API failed (the section then shows its single call to action instead). */
export async function getRuntimeOpenBounties(locale: string): Promise<Bounty[]> {
  const { value: bounties } = await settle(getRuntimeBounties(locale), []);
  return bounties.filter((bounty) => bounty.status === 'active').slice(0, 4);
}

/**
 * The bounty hero data: stats (hidden while every value is zero, shown on their own once one is above zero) and the portfolio
 * card, derived from the bounty list the page already loaded plus the Hall of Fame stats. A failed stats read hides them
 * instead of throwing.
 */
export async function getBountyHero(locale: string, bounties: Bounty[]): Promise<BountyHero> {
  const hall = await settle(getRuntimeHallOfFame(locale), emptyHallOfFame);
  return {
    stats: visibleStats(hall.value.stats).map(({ value, labelKey }) => ({ value, labelKey })),
    portfolio: {
      ...showcase,
      completed: bounties.filter((bounty) => bounty.closedReason === "completed").slice(0, 5).map((bounty) => bounty.title),
      totalCompleted: Number(hall.value.stats[0]?.value ?? 0),
    },
    statsUnavailable: hall.unavailable,
  };
}
