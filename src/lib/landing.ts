import type { Bounty, NoticePreview } from './types';
import { getRuntimeBounties } from './bounties';
import { getRuntimeNotices } from './notices';
import { getRuntimeHallOfFame, type HallStatKey } from './hall-of-fame';

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

export const landing: LandingData = {
  hero: {
    primaryCta: { labelKey: 'getStarted', href: '/signup' },
    secondaryCta: { labelKey: 'browseBounties', href: '/bounties' },
    stats: [
      { value: '128', labelKey: 'bountiesRun' },
      { value: '412', labelKey: 'buildersOnboarded' },
      { value: '10+', labelKey: 'ecosystemPartners' },
    ],
    portfolio: {
      handle: 'ninja.inj',
      memberSince: 2026,
      completed: [
        'Frontend widget',
        'Contract audit',
        'Design system',
        'Docs revamp',
        'Bug bounty',
      ],
      totalCompleted: 5,
    },
  },
  bounties: [
    {
      slug: 'iasset-price-widget',
      title: 'Build an iAsset price widget',
      summary: 'Build a reusable price widget for Injective iAssets.',
      category: 'Dev',
      status: 'active',
      reward: { amount: 500, currency: 'INJ' },
      sponsor: 'Injective',
      deadline: 'D-7',
      coverImage: '',
    },
    {
      slug: 'wallet-onboarding-flow',
      title: 'Design a wallet onboarding flow',
      summary: 'Create a clear wallet onboarding experience for new builders.',
      category: 'Design',
      status: 'active',
      reward: { amount: 300, currency: 'USDC' },
      sponsor: 'Helix',
      deadline: 'D-5',
      coverImage: '',
    },
    {
      slug: 'contract-security-audit',
      title: 'Smart contract security audit',
      summary: 'Review an Injective smart contract for security issues.',
      category: 'Dev',
      status: 'active',
      reward: { amount: 800, currency: 'USDC' },
      sponsor: 'Ninja Labs',
      deadline: 'D-12',
      coverImage: '',
    },
    {
      slug: 'injective-dev-tutorial',
      title: 'Write an Injective dev tutorial',
      summary: 'Write an educational tutorial for the Injective developer community.',
      category: 'Content',
      status: 'active',
      reward: { amount: 250, currency: 'INJ' },
      sponsor: 'Injective',
      deadline: 'D-9',
      coverImage: '',
    },
  ],
  news: [
    {
      category: 'Ninja Labs',
      publishedAt: '2026.06.20',
      title: 'Ninja Labs joins the Injective builder hackathon',
      excerpt: 'Three bounty tracks will help new teams ship wallets, widgets, and educational content.',
      slug: 'ninja-labs-injective-builder-hackathon',
      thumbnail: '',
    },
    {
      category: 'Injective ecosystem',
      publishedAt: '2026.06.15',
      title: 'New iAsset modules explained for bounty builders',
      excerpt: 'A primer on price feeds, market metadata, and integration patterns for upcoming tasks.',
      slug: 'iasset-modules-for-bounty-builders',
      thumbnail: '',
    },
    {
      category: 'Events',
      publishedAt: '2026.06.12',
      title: 'Community review call for July bounty sponsors',
      excerpt: 'A live walkthrough of application intake, review status, and reward release timing.',
      slug: 'july-bounty-sponsor-review-call',
      thumbnail: '',
    },
  ],
};

export async function getRuntimeLanding(): Promise<LandingData> {
  const [bounties, notices, hall] = await Promise.all([
    getRuntimeBounties(),
    getRuntimeNotices(),
    getRuntimeHallOfFame(),
  ]);
  const completed = bounties.filter((bounty) => bounty.status === 'closed').slice(0, 5);
  return {
    hero: {
      ...landing.hero,
      stats: hall.stats.map(({ value, labelKey }) => ({ value, labelKey })),
      portfolio: {
        handle: 'Ninja Labs',
        memberSince: 2026,
        completed: completed.map((bounty) => bounty.title),
        totalCompleted: Number(hall.stats[0]?.value ?? 0),
      },
    },
    bounties: bounties.filter((bounty) => bounty.status === 'active').slice(0, 4),
    news: notices.slice(0, 3),
  };
}
