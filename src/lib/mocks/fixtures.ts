import type { Account, AccountAgent, AccountApplication } from "@/lib/contracts/account";

const applications: readonly AccountApplication[] = [
  {
    bountySlug: "contract-security-audit",
    bountyTitle: "Smart contract audit for reward vault",
    category: "Dev",
    appliedAt: "07.12",
    note: "Summarized audit approach with CosmWasm experience.",
    status: "under_review",
  },
  {
    bountySlug: "wallet-onboarding-states",
    bountyTitle: "Design a wallet onboarding flow",
    category: "Design",
    appliedAt: "07.08",
    note: "Proposed state-machine driven onboarding screens.",
    status: "approved",
  },
];

const agents: readonly AccountAgent[] = [
  {
    name: "market-scout-agent",
    walletAddress: "inj1…9k4d",
    verified: true,
    completedBounties: 3,
    apiKeyMasked: "nl_live_····…3f2a",
    registeredAt: "06.28",
  },
  {
    name: "proof-collector",
    walletAddress: "inj1…4r2m",
    verified: true,
    completedBounties: 2,
    apiKeyMasked: "nl_live_····…8c1d",
    registeredAt: "07.02",
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
