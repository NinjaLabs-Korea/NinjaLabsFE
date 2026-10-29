import { emptyHallOfFame, getRuntimeHallOfFame, type RuntimeHallOfFame } from "@/lib/hall-of-fame";
import { getRuntimeMembers } from "@/lib/members";
import { getRuntimeNotices } from "@/lib/notices";
import { settle } from "@/lib/api/public";
import type { Member, Notice } from "@/lib/types";

/** How many cards each community section shows. */
export const COMMUNITY_EVENT_LIMIT = 3;
export const COMMUNITY_UPCOMING_LIMIT = 3;
export const COMMUNITY_MEMBER_LIMIT = 4;
export const COMMUNITY_HIGHLIGHT_LIMIT = 3;

export type CommunityData = {
  /** Past EVENT notices ("지난 활동"), newest event date first (undated events last). */
  events: Notice[];
  /** EVENT notices dated today or later ("진행 중·예정 행사"), soonest first. Empty hides the section. */
  upcoming: Notice[];
  hall: RuntimeHallOfFame;
  members: Member[];
  /** Sections whose source failed; the section renders an unavailable state instead of throwing. */
  unavailable: { notices: boolean; hall: boolean; members: boolean };
};

/** Today as the `YYYY-MM-DD` UTC calendar day (the same day basis for both hub event sections). */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * An event dated today or later: "in progress or upcoming" ("진행 중·예정 행사"). The event date has no end date, so an event
 * stays here for its whole UTC calendar day and moves to the past activities the next day. Undated events are never upcoming
 * (nothing says they are in the future); they stay in the past activities.
 */
export function isUpcomingEvent(notice: { eventDate?: string | null }, now: Date = new Date()): boolean {
  return Boolean(notice.eventDate) && /^\d{4}-\d{2}-\d{2}$/.test(notice.eventDate!) && notice.eventDate! >= utcDay(now);
}

/**
 * The data behind the community sections shared by the hub (`/`) and `/about`: in-progress/upcoming events, past activities (EVENT notices, BE
 * `sort=eventDate`), the Hall of Fame and the member preview.
 */
export async function getRuntimeCommunity(locale: string): Promise<CommunityData> {
  const [noticesResult, hallResult, membersResult] = await Promise.all([
    settle(getRuntimeNotices({ sort: "eventDate" }), []),
    settle(getRuntimeHallOfFame(locale), emptyHallOfFame),
    settle(getRuntimeMembers(), []),
  ]);
  const events = noticesResult.value.filter((notice) => notice.category === "Events");
  return {
    events: events.filter((notice) => !isUpcomingEvent(notice)).slice(0, COMMUNITY_EVENT_LIMIT),
    // The BE lists newest event date first; the upcoming ones read soonest first.
    upcoming: events
      .filter((notice) => isUpcomingEvent(notice))
      .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))
      .slice(0, COMMUNITY_UPCOMING_LIMIT),
    hall: hallResult.value,
    members: membersResult.value.slice(0, COMMUNITY_MEMBER_LIMIT),
    unavailable: {
      notices: noticesResult.unavailable,
      hall: hallResult.unavailable,
      members: membersResult.unavailable,
    },
  };
}

/**
 * The event date label a notice may show: only `Events` notices have an event date (the BE stores whatever it is given, so
 * an old `Other` notice can still carry one; it must not read as "Event date" on a non-event). `""` when none.
 */
export function noticeEventDateLabel(notice: { category: string; eventDate?: string | null }): string {
  return notice.category === "Events" ? formatEventDate(notice.eventDate ?? undefined) : "";
}

/** `2026-06-18` -> `2026.06.18` (the Figma date label used by every notice date); anything else yields `""`. */
export function formatEventDate(eventDate: string | undefined): string {
  return eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate.replaceAll("-", ".") : "";
}
