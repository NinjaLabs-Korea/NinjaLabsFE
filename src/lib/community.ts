import { emptyHallOfFame, getRuntimeHallOfFame, type RuntimeHallOfFame } from "@/lib/hall-of-fame";
import { getRuntimeMembers } from "@/lib/members";
import { getRuntimeNotices } from "@/lib/notices";
import type { Member, Notice } from "@/lib/types";

/** How many cards each community section shows. */
export const COMMUNITY_EVENT_LIMIT = 3;
export const COMMUNITY_MEMBER_LIMIT = 4;
export const COMMUNITY_HIGHLIGHT_LIMIT = 3;

export type CommunityData = {
  /** EVENT notices, newest event date first (undated events last). */
  events: Notice[];
  hall: RuntimeHallOfFame;
  members: Member[];
  /** Sections whose source failed; the section renders an unavailable state instead of throwing. */
  unavailable: { notices: boolean; hall: boolean; members: boolean };
};

const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T => (result.status === "fulfilled" ? result.value : fallback);

/**
 * The data behind the community sections shared by the Intro (`/`) and `/about`: past activities (EVENT notices, BE
 * `sort=eventDate`), the Hall of Fame and the member preview.
 */
export async function getRuntimeCommunity(locale: string): Promise<CommunityData> {
  const [noticesResult, hallResult, membersResult] = await Promise.allSettled([
    getRuntimeNotices({ sort: "eventDate" }),
    getRuntimeHallOfFame(locale),
    getRuntimeMembers(),
  ]);
  const notices = settled(noticesResult, []);
  return {
    events: notices.filter((notice) => notice.category === "Events").slice(0, COMMUNITY_EVENT_LIMIT),
    hall: settled(hallResult, emptyHallOfFame),
    members: settled(membersResult, []).slice(0, COMMUNITY_MEMBER_LIMIT),
    unavailable: {
      notices: noticesResult.status === "rejected",
      hall: hallResult.status === "rejected",
      members: membersResult.status === "rejected",
    },
  };
}

/** `2026-06-18` -> `2026.06.18` (the Figma date label used by every notice date); anything else yields `""`. */
export function formatEventDate(eventDate: string | undefined): string {
  return eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate.replaceAll("-", ".") : "";
}
