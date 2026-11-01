import { PUBLIC_FETCH_TIMEOUT_MS } from "@/lib/api/public";
import { loadRuntimeConfig } from "@/lib/runtime/config";

/**
 * Server-only: who owns this bearer token, asked of the BE (`GET /auth/me`). The cache-expiry server actions
 * (`admin-revalidate.ts`, `member-revalidate.ts`) are public POST endpoints, so each proves its caller with this before
 * touching a cache tag. `null` for a missing or rejected token, a mock deployment, or any failure (the caller then does nothing).
 */
export async function bearerMe(accessToken: unknown): Promise<{ isAdmin?: unknown; isMember?: unknown } | null> {
  if (!accessToken || typeof accessToken !== "string") return null;
  const config = loadRuntimeConfig();
  if (config.runtimeMode !== "api" || !config.apiUrl) return null;
  const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return (await response.json()) as { isAdmin?: unknown; isMember?: unknown };
}
