import type { Account, AccountAgent, AccountApplication } from "@/lib/contracts/account";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

const applications: readonly AccountApplication[] = [
  {
    id: "application-1",
    source: "application",
    bountySlug: "contract-security-audit",
    bountyTitle: "Smart contract audit for reward vault",
    category: "Dev",
    appliedAt: "2026-07-12T09:00:00.000Z",
    note: "Summarized audit approach with CosmWasm experience.",
    status: "open",
    agent: null,
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "NONE",
  },
  {
    id: "application-2",
    source: "application",
    bountySlug: "wallet-onboarding-states",
    bountyTitle: "Design a wallet onboarding flow",
    category: "Design",
    appliedAt: "2026-07-08T09:00:00.000Z",
    note: "Proposed state-machine driven onboarding screens.",
    status: "approved",
    agent: null,
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "NONE",
  },
  // Agent-made application: the owner sees it in My applications and the bounty detail treats it as "already applied".
  {
    id: "application-3",
    source: "application",
    bountySlug: "neptune-api-docs",
    bountyTitle: "Neptune API docs structure",
    category: "Design",
    appliedAt: "2026-07-14T09:00:00.000Z",
    note: "Proposed a navigation restructure with verified request examples.",
    status: "open",
    agent: { id: "agent-1", name: "market-scout-agent" },
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "NONE",
  },
  // Approved work whose reward an admin marked not paid (BE scripts/forfeit-award.js): submission REJECTED + comment `forfeited: <reason>`.
  {
    id: "application-4",
    source: "application",
    bountySlug: "quest-copy-refresh",
    bountyTitle: "Quest copy refresh",
    category: "Content",
    appliedAt: "2026-06-20T09:00:00.000Z",
    note: "Rewrote the onboarding quests with a shorter first-step flow.",
    status: "notAccepted",
    agent: null,
    reviewComment: "forfeited: winner wallet never connected",
    reviewNote: null,
    paymentStatus: "NONE",
  },
  // Approved work the reviewer sent back: submission REVISION_REQUESTED + comment; the bounty detail offers the resubmit form.
  {
    id: "application-5",
    source: "application",
    bountySlug: "agent-skill-benchmark",
    bountyTitle: "Agent skill benchmark suite",
    category: "Dev",
    appliedAt: "2026-06-26T09:00:00.000Z",
    note: "Proposed a harness with reproducible task definitions.",
    status: "revisionRequested",
    agent: null,
    reviewComment: "Please add the scoring rules to the README.",
    reviewNote: null,
    paymentStatus: "NONE",
  },
  // Completed work with a partial payout (the public profile shows the same status for it).
  {
    id: "application-6",
    source: "application",
    bountySlug: "hydro-liquidity-explainer",
    bountyTitle: "Hydro liquidity explainer",
    category: "Content",
    appliedAt: "2026-06-10T09:00:00.000Z",
    note: "Wrote the staking, vaults and incentives guide.",
    status: "completed",
    agent: null,
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "PARTIALLY_PAID",
  },
];

const agents: readonly AccountAgent[] = [
  {
    id: "agent-1",
    name: "market-scout-agent",
    walletAddress: "inj1…9k4d",
    status: "ACTIVE",
    verified: true,
    completedBounties: 3,
    apiKeyMasked: "nl_live_····…3f2a",
    keyExpiresAt: daysFromNow(60),
    keyStatus: "ACTIVE",
    registeredAt: "2026-06-28T09:00:00.000Z",
  },
  // Key expiring within the 14-day warning window (exercises the rotate prompt).
  {
    id: "agent-2",
    name: "proof-collector",
    walletAddress: "inj1…4r2m",
    status: "ACTIVE",
    verified: true,
    completedBounties: 2,
    apiKeyMasked: "nl_live_····…8c1d",
    keyExpiresAt: daysFromNow(7),
    keyStatus: "ACTIVE",
    registeredAt: "2026-07-02T09:00:00.000Z",
  },
];

export const previewUser: Account["user"] = Object.freeze({
  id: "jaemin",
  handle: "jaemin.inj",
  initials: "JM",
  profileSlug: "jaemin",
  walletAddress: "inj1…9k4d",
});

export type MockAccountFixtures = {
  mode: "session-preview";
  account: Account;
  applications: readonly AccountApplication[];
  agents: readonly AccountAgent[];
};

export const mockFixtureSeed: MockAccountFixtures = Object.freeze({
  mode: "session-preview" as const,
  account: Object.freeze({ user: previewUser }),
  applications: Object.freeze(applications.map((application) => Object.freeze({ ...application }))),
  agents: Object.freeze(agents.map((agent) => Object.freeze({ ...agent }))),
});

export function createMockFixtures(seed: string): MockAccountFixtures {
  if (seed !== "default") {
    throw new Error(`Unsupported mock fixture seed: ${seed}`);
  }
  return getMockFixtureSnapshot(mockFixtureSeed);
}

export function getMockFixtureSnapshot(seed: MockAccountFixtures = mockFixtureSeed): MockAccountFixtures {
  return {
    mode: "session-preview",
    account: { user: { ...seed.account.user } },
    applications: seed.applications.map((application) => ({ ...application })),
    agents: seed.agents.map((agent) => ({ ...agent })),
  };
}
