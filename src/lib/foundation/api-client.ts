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
    applyToBounty: async () => { throw new Error("Bounty application API is unavailable."); },
    submitBounty: async () => { throw new Error("Bounty submission API is unavailable."); },
    registerAgent: async () => {
      throw new Error("Agent API is unavailable.");
    },
    verifyAgent: async () => {
      throw new Error("Agent API is unavailable.");
    },
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
    getAdminUsers: async () => [],
    uploadAdminMedia: async () => { throw new Error("Admin media API is unavailable."); },
    setAdminMember: async () => { throw new Error("Admin API is unavailable."); },
    getAdminBounties: async () => [],
    saveAdminBounty: async () => { throw new Error("Admin API is unavailable."); },
    transitionAdminBounty: async () => { throw new Error("Admin API is unavailable."); },
    deleteAdminBounty: async () => { throw new Error("Admin API is unavailable."); },
    getAdminPosts: async () => [],
    saveAdminPost: async () => { throw new Error("Admin API is unavailable."); },
    deleteAdminPost: async () => { throw new Error("Admin API is unavailable."); },
    getAdminHighlights: async () => [],
    saveAdminHighlight: async () => { throw new Error("Admin API is unavailable."); },
    deleteAdminHighlight: async () => { throw new Error("Admin API is unavailable."); },
  };
}
