import { afterEach, describe, expect, it, vi } from "vitest";

const sources = {
  bounties: vi.fn(),
  notices: vi.fn(),
  hall: vi.fn(),
  members: vi.fn(),
};
vi.mock("@/lib/bounties", () => ({ getRuntimeBounties: () => sources.bounties() }));
vi.mock("@/lib/notices", () => ({ getRuntimeNotices: () => sources.notices() }));
vi.mock("@/lib/hall-of-fame", () => ({
  getRuntimeHallOfFame: () => sources.hall(),
  emptyHallOfFame: { stats: [], highlights: [], milestones: [], partners: [] },
}));
vi.mock("@/lib/members", () => ({ getRuntimeMembers: () => sources.members() }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api", origin: "https://ninja.test" }) }));

const { getRuntimeLanding } = await import("@/lib/landing");
const { default: sitemap } = await import("@/app/sitemap");

const bounty = { slug: "b1", title: "B1", status: "active" };

describe("landing and sitemap with a partially unavailable API", () => {
  afterEach(() => Object.values(sources).forEach((source) => source.mockReset()));

  it("keeps rendering the landing data that loaded and flags the failed sections", async () => {
    sources.bounties.mockResolvedValue([bounty]);
    sources.notices.mockRejectedValue(new Error("down"));
    sources.hall.mockRejectedValue(new Error("down"));
    const landing = await getRuntimeLanding();
    expect(landing.unavailable).toEqual({ bounties: false, news: true, stats: true });
    expect(landing.bounties).toEqual([bounty]);
    expect(landing.news).toEqual([]);
    expect(landing.hero.stats).toEqual([]);
  });

  it("lists static routes and the sources that loaded", async () => {
    sources.bounties.mockRejectedValue(new Error("down"));
    sources.members.mockResolvedValue([{ slug: "ninja" }]);
    sources.notices.mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://ninja.test/bounties");
    expect(urls).toContain("https://ninja.test/members/ninja");
    expect(urls.some((url) => url.startsWith("https://ninja.test/bounties/b"))).toBe(false);
  });
});
