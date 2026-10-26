import { afterEach, describe, expect, it, vi } from "vitest";

const sources = { notices: vi.fn(), hall: vi.fn(), members: vi.fn() };
vi.mock("@/lib/notices", () => ({ getRuntimeNotices: (options?: unknown) => sources.notices(options) }));
vi.mock("@/lib/hall-of-fame", () => ({
  getRuntimeHallOfFame: () => sources.hall(),
  emptyHallOfFame: { stats: [], highlights: [], milestones: [], partners: [] },
}));
vi.mock("@/lib/members", () => ({ getRuntimeMembers: () => sources.members() }));

const { formatEventDate, getRuntimeCommunity, isUpcomingEvent } = await import("@/lib/community");
const notice = (slug: string, category: string, publishedAt: string, eventDate?: string) => ({ slug, category, publishedAt, ...(eventDate ? { eventDate } : {}) });

describe("getRuntimeCommunity", () => {
  afterEach(() => Object.values(sources).forEach((source) => source.mockReset()));

  it("asks for the notices once, sorted by event date, and derives both the activities and the news from it", async () => {
    sources.notices.mockResolvedValue([
      notice("e-new", "Events", "2026.05.01", "2026-09-01"),
      notice("e-old", "Events", "2026.08.01", "2026-01-01"),
      notice("announce", "Ninja Labs", "2026.10.01"),
      notice("e-undated", "Events", "2026.03.01"),
      notice("e-extra", "Events", "2026.02.01"),
    ]);
    sources.hall.mockResolvedValue({ stats: [{ value: "1", labelKey: "bountiesCompleted" }], highlights: [], milestones: [], partners: [] });
    sources.members.mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({ slug: `m${index}` })));
    const community = await getRuntimeCommunity("en");
    expect(sources.notices).toHaveBeenCalledTimes(1);
    expect(sources.notices).toHaveBeenCalledWith({ sort: "eventDate" });
    expect(community.events.map((item) => item.slug)).toEqual(["e-new", "e-old", "e-undated"]);
    expect(community.news.map((item) => item.slug)).toEqual(["announce", "e-old", "e-new"]);
    expect(community.members).toHaveLength(4);
    expect(community.unavailable).toEqual({ notices: false, hall: false, members: false });
  });

  it("leaves events dated in the future out of the past activities, but keeps undated ones", async () => {
    sources.notices.mockResolvedValue([
      notice("future", "Events", "2026.05.01", "2999-01-01"),
      notice("past", "Events", "2026.05.01", "2026-01-01"),
      notice("undated", "Events", "2026.03.01"),
    ]);
    sources.hall.mockResolvedValue({ stats: [], highlights: [], milestones: [], partners: [] });
    sources.members.mockResolvedValue([]);
    const community = await getRuntimeCommunity("en");
    expect(community.events.map((item) => item.slug)).toEqual(["past", "undated"]);
  });

  it("keeps what loaded and flags what did not", async () => {
    sources.notices.mockRejectedValue(new Error("down"));
    sources.hall.mockResolvedValue({ stats: [], highlights: [], milestones: [], partners: [] });
    sources.members.mockRejectedValue(new Error("down"));
    const community = await getRuntimeCommunity("en");
    expect(community.events).toEqual([]);
    expect(community.news).toEqual([]);
    expect(community.unavailable).toEqual({ notices: true, hall: false, members: true });
  });
});

describe("isUpcomingEvent", () => {
  it("is true only for a valid date after today (UTC), today itself is already a past activity", () => {
    const now = new Date("2026-10-26T23:00:00Z");
    expect(isUpcomingEvent({ eventDate: "2026-10-27" }, now)).toBe(true);
    expect(isUpcomingEvent({ eventDate: "2026-10-26" }, now)).toBe(false);
    expect(isUpcomingEvent({ eventDate: "2026-01-01" }, now)).toBe(false);
    for (const eventDate of [undefined, null, "", "soon"]) expect(isUpcomingEvent({ eventDate }, now)).toBe(false);
  });
});

describe("formatEventDate", () => {
  it("turns an ISO date into the YYYY.MM.DD label and ignores anything else", () => {
    expect(formatEventDate("2026-06-18")).toBe("2026.06.18");
    for (const bad of [undefined, "", "June 18", "2026-06-18T00:00:00Z"]) expect(formatEventDate(bad)).toBe("");
  });
});
