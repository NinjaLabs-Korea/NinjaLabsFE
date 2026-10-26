import { emptyHallOfFame, getRuntimeHallOfFame, type RuntimeHallOfFame } from "@/lib/hall-of-fame";
import { getRuntimeMembers } from "@/lib/members";
import { getRuntimeNotices } from "@/lib/notices";
import type { Member, Notice } from "@/lib/types";

/** How many cards each community section shows. */
export const COMMUNITY_EVENT_LIMIT = 3;
export const COMMUNITY_NEWS_LIMIT = 3;
export const COMMUNITY_MEMBER_LIMIT = 4;
export const COMMUNITY_HIGHLIGHT_LIMIT = 3;

export type CommunityData = {
  /** EVENT notices, newest event date first (undated events last). */
  events: Notice[];
  /** Latest published notices of every category. */
  news: Notice[];
  hall: RuntimeHallOfFame;
  members: Member[];
  /** Sections whose source failed; the section renders an unavailable state instead of throwing. */
  unavailable: { notices: boolean; hall: boolean; members: boolean };
};

const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T => (result.status === "fulfilled" ? result.value : fallback);

/** `publishedAt` is the fixed `YYYY.MM.DD` label, so a string compare orders it; `Array#sort` is stable, ties keep the BE order. */
const newestPublishedFirst = (a: Notice, b: Notice) => b.publishedAt.localeCompare(a.publishedAt);

/**
 * An event dated after today (UTC calendar day). The landing section is "Past activities / what we have done together", so an
 * announced event must not appear there before it happened; it stays in the notices list. Undated events are kept (nothing says
 * they are in the future).
 */
export function isUpcomingEvent(notice: { eventDate?: string | null }, now: Date = new Date()): boolean {
  return Boolean(notice.eventDate) && /^\d{4}-\d{2}-\d{2}$/.test(notice.eventDate!) && notice.eventDate! > now.toISOString().slice(0, 10);
}

/**
 * The data behind the community sections shared by the Intro (`/`) and `/about`. One notices read serves both the
 * activities (BE `sort=eventDate`) and the news (re-sorted by publish date), so the page costs one notice list, not two.
 */
export async function getRuntimeCommunity(locale: string): Promise<CommunityData> {
  const [noticesResult, hallResult, membersResult] = await Promise.allSettled([
    getRuntimeNotices({ sort: "eventDate" }),
    getRuntimeHallOfFame(locale),
    getRuntimeMembers(),
  ]);
  const notices = settled(noticesResult, []);
  return {
    events: notices.filter((notice) => notice.category === "Events" && !isUpcomingEvent(notice)).slice(0, COMMUNITY_EVENT_LIMIT),
    news: [...notices].sort(newestPublishedFirst).slice(0, COMMUNITY_NEWS_LIMIT),
    hall: settled(hallResult, emptyHallOfFame),
    members: settled(membersResult, []).slice(0, COMMUNITY_MEMBER_LIMIT),
    unavailable: {
      notices: noticesResult.status === "rejected",
      hall: hallResult.status === "rejected",
      members: membersResult.status === "rejected",
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
