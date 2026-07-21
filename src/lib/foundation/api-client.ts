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
  };
}
