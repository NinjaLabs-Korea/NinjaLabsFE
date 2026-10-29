export type Reward = { amount: number; currency: 'INJ' | 'USDC' };

export type BountyCategory = 'Dev' | 'Design' | 'Content' | 'Other';

export type Bounty = {
  slug: string;
  title: string;
  summary: string;
  category: BountyCategory;
  /** `reviewing` = BE SUBMISSION_CLOSED | IN_REVIEW: no new applications/submissions, but a requested revision can still be resubmitted. */
  status: 'active' | 'reviewing' | 'closed';
  /** Why a `closed` bounty is closed (`lib/bounty-status.ts toClosedReason`): finished work, a cancellation, or only its deadline having passed. Omitted while `active` / `reviewing`. */
  closedReason?: 'completed' | 'cancelled' | 'deadline';
  /** Primary reward (first funded token); shown on cards. */
  reward: Reward;
  /** Every reward token the bounty pays, primary first. Omitted when only `reward` exists. */
  rewards?: Reward[];
  sponsor: string;
  /** `"Closed"` sentinel for every bounty that no longer accepts work; open bounties carry `daysLeft` instead. */
  deadline: string;
  /** Days until the submission deadline (open bounties only); cards render it through `bounties.card.daysLeft`. */
  daysLeft?: number;
  // Figma 14 (list card) shows the D-7 label; Figma 15 (detail meta cell) shows the full UTC deadline
  deadlineDetail?: string;
  coverImage: string;
  /** Markdown (rendered by ui/Markdown): supported subset is p/a/strong/em/ul/ol/li/h2/h3/code/pre/blockquote/br/del. Tables, images, and task lists are unsupported by design. */
  descriptionMarkdown?: string;
  /** Markdown; same ui/Markdown subset as descriptionMarkdown. Renders a "Submission guide" section on non-application bounty detail. */
  submissionGuideMarkdown?: string;
  deliverables?: string[];
  reviewProcess?: string;
  submissionMode?: 'direct' | 'agent';
  // Figma 15v apply-variant driver
  applicationRequired?: boolean;
  /** Figma 15v renders variant-specific masthead/description copy without changing list copy. */
  applicationTitle?: string;
  applicationDescription?: string;
  /** Application-required bounty whose `application_deadline` has passed: new applications are refused (BE `APPLICATION_DEADLINE_PASSED`); approved applicants can still submit. */
  applicationClosed?: boolean;
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
  /** Event date (`YYYY-MM-DD`, BE `event_date`): when the activity happened, set by the operator; absent for plain announcements. */
  eventDate?: string;
  related?: { label: string; href: string }[];
};
export type NoticePreview = Pick<Notice, "slug" | "title" | "excerpt" | "category" | "publishedAt" | "thumbnail" | "eventDate">;

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

/**
 * BE `/users/:nickname` `completedBounties[].payoutStatus` and `/submissions/me` `payment_status` (same rule): PAID = every
 * owed payout PAID, PARTIALLY_PAID = some PAID and some still open, PENDING = nothing paid yet, NONE = nothing is owed:
 * no reward, a cancelled award, an exhausted pool (other winners took it all), a winner who withdrew without requesting, or a
 * refunded reward. NONE can still come with paid `rewards` (e.g. after a refund); the FE then shows them as PAID.
 * Older BE rows omit it (derived from `rewards`); an unknown value is read as PENDING (`lib/api/codecs.ts toPayoutStatus`).
 */
export type PayoutStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'NONE';

export type Completion = {
  bountySlug?: string;
  title: string;
  category: BountyCategory;
  completedAt: string;
  /**
   * PAID → the paid payout; PARTIALLY_PAID → the paid payout so far (shown with a "partially paid" badge); PENDING → the
   * posted bounty reward (shown with a "payout pending" badge); NONE → null (nothing shown).
   */
  reward: Reward | null;
  /** How many further reward tokens the bounty pays beyond `reward` (multi-token bounties); the profile shows `+N`. */
  moreRewards?: number;
  payoutStatus: PayoutStatus;
  childNft?: { tokenId: string };
};

export type ProfileNft = {
  id: string;
  type: 'parent' | 'completion';
  title: string;
  status: 'PENDING' | 'MINTING' | 'MINTED' | 'ATTACHING' | 'ATTACHED' | 'FAILED';
  contractAddress: string;
  tokenId: string | null;
  mintTxHash: string | null;
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
  nfts: ProfileNft[];
  agents: Agent[];
};
