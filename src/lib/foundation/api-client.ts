import type { ApiClient, ApiResult } from "@/lib/contracts/api";

const unavailable = <T>(): ApiResult<T> => ({
  status: "unavailable",
  reason: "api-mode-placeholder",
});

// This intentionally has no transport implementation. API mode must not make
// network requests until a backend-backed client is introduced.
export function createUnavailableApiClient(): ApiClient {
  return {
    getAccount: async () => unavailable(),
    getApplications: async () => unavailable(),
    getAgents: async () => unavailable(),
    createWalletChallenge: async () => {
      throw new Error("Wallet API is unavailable.");
    },
    verifyWallet: async () => {
      throw new Error("Wallet API is unavailable.");
    },
    completeProfile: async () => {
      throw new Error("Profile API is unavailable.");
    },
    completeOnboarding: async () => {
      throw new Error("Onboarding API is unavailable.");
    },
  };
}
