import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockFixtures, getMockFixtureSnapshot, type MockAccountFixtures } from "@/lib/mocks/fixtures";

function isFixtureOwner(auth: AuthSnapshot, fixtures: MockAccountFixtures): boolean {
  return auth.status === "signed-in" && auth.user.id === fixtures.account.user.id;
}

export function createMockApiClient(seed = "default"): ApiClient {
  const fixtureSnapshot = createMockFixtures(seed);
  return {
    getAccount: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: null };
      }

      return { status: "available", data: getMockFixtureSnapshot(fixtureSnapshot).account };
    },
    getApplications: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: getMockFixtureSnapshot(fixtureSnapshot).applications };
    },
    getAgents: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: getMockFixtureSnapshot(fixtureSnapshot).agents };
    },
    createWalletChallenge: async (address) => ({ message: `Preview challenge for ${address}` }),
    verifyWallet: async () => undefined,
    completeProfile: async () => undefined,
    completeOnboarding: async () => undefined,
  };
}
