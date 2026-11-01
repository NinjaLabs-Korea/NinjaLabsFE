"use server";

import { updateTag } from "next/cache";
import { publicListTag } from "@/lib/api/public";
import { bearerMe } from "@/lib/bearer-me";

/**
 * After a member changed their own profile photo, expire the cached public member list (`public:members`: `/members` and
 * the hub preview) at once, so it does not keep showing the old photo, whose `/media` row the BE just deleted, for up to 30s.
 *
 * A server action is a public POST endpoint, so the caller proves who they are: the bearer token is checked against the BE
 * (`GET /auth/me`) and only an official member (`isMember`, the only people that list shows) may expire it. Anyone else, or
 * any failure, changes nothing. Never throws: the photo change already succeeded. The public profile page reads fresh
 * (`PUBLIC_DETAIL_FETCH`), so it needs no expiry.
 */
export async function refreshMemberLists(accessToken: string | null): Promise<boolean> {
  try {
    const me = await bearerMe(accessToken);
    if (me?.isMember !== true) return false;
    updateTag(publicListTag("members"));
    return true;
  } catch (error) {
    console.error("refreshMemberLists failed", error);
    return false;
  }
}
