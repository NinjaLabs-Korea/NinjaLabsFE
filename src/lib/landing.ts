import type { Bounty, NoticePreview } from './types';
import { getRuntimeBounties } from './bounties';
import { settle } from './api/public';
import { getRuntimeNotices } from './notices';
import { emptyHallOfFame, getRuntimeHallOfFame, visibleStats, type HallStatKey } from './hall-of-fame';

// Two surfaces read this module. The signed-in home (`/home`) takes `getRuntimeLanding` (open bounties + latest notices). The
// light masthead at the top of `/bounties` (`bounties/BountyMasthead`) takes `getBountyMastheadData` for its stat tiles; its copy is
// messages `bounties.list`, the stat `labelKey` resolves under `hallOfFame.stats`. The Intro (`/`) is community copy
// (`landing.hero`) and has no data fixture; its bounty preview takes `getRuntimeOpenBounties`.

/** The `/bounties` masthead data: the Hall of Fame stat tiles, already filtered to the ones worth showing. */
export type BountyMastheadData = {
  stats: Array<{ value: string; labelKey: HallStatKey }>;
};

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
 * The `/bounties` masthead stats (hidden while every value is zero, shown on their own once one is above zero). A failed Hall of Fame
 * read hides them instead of throwing.
 */
export async function getBountyMastheadData(locale: string): Promise<BountyMastheadData> {
  const hall = await settle(getRuntimeHallOfFame(locale), emptyHallOfFame);
  return { stats: visibleStats(hall.value.stats).map(({ value, labelKey }) => ({ value, labelKey })) };
}
