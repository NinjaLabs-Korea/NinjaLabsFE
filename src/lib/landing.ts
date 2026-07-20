import type { Bounty, NoticePreview } from './types';

type LandingData = {
  hero: {
    eyebrow: 'Built on Injective';
    title: string;
    description: string;
    primaryCta: { label: 'Get Started'; href: string };
    secondaryCta: { label: 'Browse Bounties'; href: '/bounties' };
    stats: Array<{ value: '128' | '412' | '10+'; label: string }>;
    portfolio: {
      handle: 'ninja.inj';
      memberSince: 2026;
      completed: string[];
      totalCompleted: 5;
    };
  };
  bounties: Bounty[];
  news: NoticePreview[];
};

export const landing: LandingData = {
  hero: {
    eyebrow: 'Built on Injective',
    title: 'Complete bounties. Collect proof. Own your track record.',
    description:
      'A builder community and bounty marketplace for the Injective ecosystem. Every task you finish mints an on-chain NFT — together they become a portfolio you truly own.',
    primaryCta: { label: 'Get Started', href: '/signup' },
    secondaryCta: { label: 'Browse Bounties', href: '/bounties' },
    stats: [
      { value: '128', label: 'Bounties run' },
      { value: '412', label: 'Builders onboarded' },
      { value: '10+', label: 'Ecosystem partners' },
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
    },
    {
      category: 'Injective ecosystem',
      publishedAt: '2026.06.15',
      title: 'New iAsset modules explained for bounty builders',
      excerpt: 'A primer on price feeds, market metadata, and integration patterns for upcoming tasks.',
      slug: 'iasset-modules-for-bounty-builders',
    },
    {
      category: 'Events',
      publishedAt: '2026.06.12',
      title: 'Community review call for July bounty sponsors',
      excerpt: 'A live walkthrough of application intake, review status, and reward release timing.',
      slug: 'july-bounty-sponsor-review-call',
    },
  ],
};
