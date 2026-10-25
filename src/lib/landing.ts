import type { Bounty, NoticePreview } from './types';
import { getRuntimeBounties } from './bounties';
import { getRuntimeNotices } from './notices';
import { emptyHallOfFame, getRuntimeHallOfFame, type HallStatKey } from './hall-of-fame';

// Hero copy (eyebrow, title, description, CTA labels) lives in messages `landing.hero`;
// CTA `labelKey` and stat `labelKey` resolve there and under `hallOfFame.stats`.
type LandingData = {
  hero: {
    primaryCta: { labelKey: 'getStarted'; href: string };
    secondaryCta: { labelKey: 'browseBounties'; href: string };
    stats: Array<{ value: string; labelKey: HallStatKey }>;
    portfolio: {
      handle: string;
      memberSince: number;
      completed: string[];
      totalCompleted: number;
    };
  };
  bounties: Bounty[];
  news: NoticePreview[];
};

/**
 * Static hero fixture. Bounties, news, and stats are never read from here:
 * `getRuntimeLanding` derives them from the bounty/notice/hall-of-fame sources
 * so the landing page cannot drift from the list pages.
 */
export const landing: Pick<LandingData, 'hero'> = {
  hero: {
    primaryCta: { labelKey: 'getStarted', href: '/signup' },
    secondaryCta: { labelKey: 'browseBounties', href: '/bounties' },
    stats: [],
    portfolio: { handle: 'ninja.inj', memberSince: 2026, completed: [], totalCompleted: 0 },
  },
};

export type RuntimeLanding = LandingData & {
  /** Sections whose API source failed; the page renders an unavailable state instead of throwing. */
  unavailable: { bounties: boolean; news: boolean; stats: boolean };
};

const settledValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

export async function getRuntimeLanding(locale: string): Promise<RuntimeLanding> {
  const [bountiesResult, noticesResult, hallResult] = await Promise.allSettled([
    getRuntimeBounties(locale),
    getRuntimeNotices(),
    getRuntimeHallOfFame(locale),
  ]);
  const bounties = settledValue(bountiesResult, []);
  const notices = settledValue(noticesResult, []);
  const hall = settledValue(hallResult, emptyHallOfFame);
  const completed = bounties.filter((bounty) => bounty.completed).slice(0, 5);
  return {
    hero: {
      ...landing.hero,
      stats: hall.stats.map(({ value, labelKey }) => ({ value, labelKey })),
      portfolio: {
        handle: landing.hero.portfolio.handle,
        memberSince: landing.hero.portfolio.memberSince,
        completed: completed.map((bounty) => bounty.title),
        totalCompleted: Number(hall.stats[0]?.value ?? 0),
      },
    },
    bounties: bounties.filter((bounty) => bounty.status === 'active').slice(0, 4),
    news: notices.slice(0, 3),
    unavailable: {
      bounties: bountiesResult.status === 'rejected',
      news: noticesResult.status === 'rejected',
      stats: hallResult.status === 'rejected',
    },
  };
}
