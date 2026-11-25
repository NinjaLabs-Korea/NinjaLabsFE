import type { Account, AccountApplication } from "@/lib/contracts/account";

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
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "PARTIALLY_PAID",
    submissionId: "preview-submission-application-6",
    payoutAddress: null,
    payoutAddressEvm: null,
    payoutAddressUpdatedAt: null,
    payoutAddressEditable: true,
  },
];

export const previewUser: Account["user"] = Object.freeze({
  id: "jaemin",
  handle: "jaemin.inj",
  initials: "JM",
  profileSlug: "jaemin",
});

export type MockAccountFixtures = {
  mode: "session-preview";
  account: Account;
  applications: readonly AccountApplication[];
};

export const mockFixtureSeed: MockAccountFixtures = Object.freeze({
  mode: "session-preview" as const,
  account: Object.freeze({ user: previewUser }),
  applications: Object.freeze(applications.map((application) => Object.freeze({ ...application }))),
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
  };
}
