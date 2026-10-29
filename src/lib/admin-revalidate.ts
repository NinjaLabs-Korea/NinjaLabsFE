"use server";

import { updateTag } from "next/cache";
import { PUBLIC_FETCH_TIMEOUT_MS, PUBLIC_LIST_RESOURCES, publicListTag, type PublicListResource } from "@/lib/api/public";
import { loadRuntimeConfig } from "@/lib/runtime/config";

/**
 * After an admin write, expire the cached public lists at once (`updateTag`: immediate expiry, not stale-while-revalidate), so
 * `/notices`, `/bounties` and the hub show the change on the very next visit instead of up to 30s later and pointing at a 404 detail.
 *
 * A server action is a public POST endpoint, so the caller proves it is an admin: the bearer token is checked against the BE
 * (`GET /auth/me`, `isAdmin`). Anyone else, or any failure, changes nothing. Never throws: the admin write already succeeded.
 */
export async function refreshPublicLists(resources: readonly PublicListResource[], accessToken: string | null): Promise<boolean> {
  try {
    if (!accessToken || typeof accessToken !== "string" || !Array.isArray(resources)) return false;
    const config = loadRuntimeConfig();
    if (config.runtimeMode !== "api" || !config.apiUrl) return false;
    const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const me = (await response.json()) as { isAdmin?: unknown };
    if (me.isAdmin !== true) return false;
    const allowed = new Set<string>(PUBLIC_LIST_RESOURCES);
    for (const resource of new Set(resources)) if (allowed.has(resource)) updateTag(publicListTag(resource));
    return true;
  } catch (error) {
    console.error("refreshPublicLists failed", error);
    return false;
  }
}
