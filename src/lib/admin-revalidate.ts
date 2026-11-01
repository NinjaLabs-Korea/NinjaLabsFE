"use server";

import { updateTag } from "next/cache";
import { PUBLIC_LIST_RESOURCES, publicListTag, type PublicListResource } from "@/lib/api/public";
import { bearerMe } from "@/lib/bearer-me";

/**
 * After an admin write, expire the cached public lists at once (`updateTag`: immediate expiry, not stale-while-revalidate), so
 * `/notices`, `/bounties` and the hub show the change on the very next visit instead of up to 30s later and pointing at a 404 detail.
 *
 * A server action is a public POST endpoint, so the caller proves it is an admin: the bearer token is checked against the BE
 * (`GET /auth/me`, `isAdmin`). Anyone else, or any failure, changes nothing. Never throws: the admin write already succeeded.
 */
export async function refreshPublicLists(resources: readonly PublicListResource[], accessToken: string | null): Promise<boolean> {
  try {
    if (!Array.isArray(resources)) return false;
    const me = await bearerMe(accessToken);
    if (me?.isAdmin !== true) return false;
    const allowed = new Set<string>(PUBLIC_LIST_RESOURCES);
    for (const resource of new Set(resources)) if (allowed.has(resource)) updateTag(publicListTag(resource));
    return true;
  } catch (error) {
    console.error("refreshPublicLists failed", error);
    return false;
  }
}
