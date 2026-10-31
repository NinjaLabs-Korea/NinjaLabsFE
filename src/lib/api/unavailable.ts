// Leaf module: the read-failure reason shared by the account client (`api-client.ts`) and the cohort client (`cohorts.ts`).
// It lived in `api-client.ts`, which also imports `cohorts.ts`, so the two modules imported each other.
import type { ApiUnavailable } from "@/lib/contracts/api";
import { ApiHttpError } from "@/lib/api/http";

/**
 * Why an account read is unavailable: `unauthorized` when the BE still answers 401/403 after `ApiHttp` tried the
 * refresh (the session is gone - views show a sign-in prompt), `server-error` for any other BE answer (5xx, 429,
 * a 4xx the FE did not expect), `network-error` when nothing answered (fetch failure, or `REFRESH_UNAVAILABLE`
 * carrying status 0 from a refresh that never reached the BE).
 */
export function unavailableReason(error: unknown): ApiUnavailable["reason"] {
  if (!(error instanceof ApiHttpError)) return "network-error";
  if (error.status === 401 || error.status === 403) return "unauthorized";
  return error.status === 0 ? "network-error" : "server-error";
}
