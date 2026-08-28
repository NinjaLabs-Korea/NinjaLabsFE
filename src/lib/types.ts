export type Reward = { amount: number; currency: 'INJ' | 'USDC' };

export type BountyCategory = 'Dev' | 'Design' | 'Content' | 'Other';

export type Bounty = {
  slug: string;
  title: string;
  summary: string;
  category: BountyCategory;
  status: 'active' | 'closed';
  reward: Reward;
  sponsor: string;
  deadline: string;
  // 19:1480 shows D-7 label; 19:1739 shows full UTC deadline
  deadlineDetail?: string;
  coverImage: string;
  /** Markdown (rendered by ui/Markdown): supported subset is p/a/strong/em/ul/ol/li/h2/h3/code/pre/blockquote/br/del — tables, images, and task lists are unsupported by design. */
  descriptionMarkdown?: string;
  /** Markdown; same ui/Markdown subset as descriptionMarkdown. Renders a "Submission guide" section on non-application bounty detail. */
  submissionGuideMarkdown?: string;
  deliverables?: string[];
  reviewProcess?: string;
  submissionMode?: 'direct' | 'agent';
  completionSteps?: string[];
  // 19:1911 apply variant driver
  applicationRequired?: boolean;
  /** 19:1911 renders variant-specific masthead/description copy without changing list copy. */
  applicationTitle?: string;
  applicationDescription?: string;
};

export type Notice = {
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown; same ui/Markdown subset as Bounty.descriptionMarkdown. */
  bodyMarkdown: string;
  category: 'Ninja Labs' | 'Injective ecosystem' | 'Events' | 'Recruitment' | 'Other';
  publishedAt: string;
  thumbnail: string;
  coverImage?: string;
  externalUrl?: string;
  related?: { label: string; href: string }[];
};
export type NoticePreview = Pick<Notice, "slug" | "title" | "excerpt" | "category" | "publishedAt">;

export type Member = {
  slug: string;
  name: string;
  initials: string;
  role: 'Core' | 'Dev' | 'Design' | 'Ops';
  title: string;
  bio: string;
  photo?: string;
  isMember: boolean;
  links: Partial<Record<'profile' | 'posts' | 'agents' | 'bounties' | 'notices', string>>;
};

export type Completion = {
  title: string;
  category: BountyCategory;
  completedAt: string;
  reward: Reward;
  childNft?: { tokenId: string };
};

export type Agent = {
  name: string;
  wallet: string;
  verified: boolean;
  completedBounties: number;
};

export type Profile = {
  slug: string;
  handle: string;
  initials: string;
  bio: string;
  skills: BountyCategory[];
  joinedAt: string;
  completions: Completion[];
  childNfts: { title: string }[];
  agents: Agent[];
};
