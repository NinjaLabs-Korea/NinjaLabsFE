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
    const landing = await getRuntimeLanding("en");
    expect(landing.unavailable).toEqual({ bounties: false, news: true, stats: true });
    expect(landing.bounties).toEqual([bounty]);
    expect(landing.news).toEqual([]);
    expect(landing.hero.stats).toEqual([]);
  });

  it("passes the hall of fame stats, including the rewards paid total, through to the hero", async () => {
    sources.bounties.mockResolvedValue([]);
    sources.notices.mockResolvedValue([]);
    const stats = [
      { value: "3", labelKey: "bountiesCompleted" },
      { value: "12,500 USDC · 300 INJ", labelKey: "rewardsPaid" },
    ];
    sources.hall.mockResolvedValue({ stats, highlights: [], milestones: [], partners: [] });
    const landing = await getRuntimeLanding("en");
    expect(landing.hero.stats).toEqual(stats);
    expect(landing.hero.portfolio.totalCompleted).toBe(3);
  });

  it("shows only completed bounties as finished work in the hero, not cancelled or expired ones", async () => {
    const done = { slug: "done", title: "Done", status: "closed", completed: true };
    sources.bounties.mockResolvedValue([done, { slug: "cancelled", title: "Cancelled", status: "closed" }, bounty]);
    sources.notices.mockResolvedValue([]);
    sources.hall.mockResolvedValue({ stats: [], highlights: [], milestones: [], partners: [] });
    const landing = await getRuntimeLanding("en");
    expect(landing.hero.portfolio.completed).toEqual(["Done"]);
  });

  it("lists static routes and the sources that loaded", async () => {
    sources.bounties.mockRejectedValue(new Error("down"));
    sources.members.mockResolvedValue([{ slug: "ninja" }]);
    sources.notices.mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://ninja.test/en/bounties");
    expect(urls).toContain("https://ninja.test/en/members/ninja");
    expect(urls.some((url) => url.includes("/bounties/b"))).toBe(false);
  });

  it("lists the community pages (about, recruit) but not the signed-in home", async () => {
    sources.bounties.mockResolvedValue([]);
    sources.members.mockResolvedValue([]);
    sources.notices.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual(expect.arrayContaining(["https://ninja.test/en/about", "https://ninja.test/ko/recruit"]));
    expect(urls.some((url) => url.endsWith("/home"))).toBe(false);
  });

  it("percent-encodes non-ASCII member nicknames in sitemap URLs", async () => {
    sources.bounties.mockResolvedValue([]);
    sources.members.mockResolvedValue([{ slug: "한글.inj" }]);
    sources.notices.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://ninja.test/en/members/%ED%95%9C%EA%B8%80.inj");
    expect(urls.some((url) => url.includes("한글"))).toBe(false);
  });

  it("lists a notice without a parseable published date, just without lastModified", async () => {
    sources.bounties.mockResolvedValue([]);
    sources.members.mockResolvedValue([]);
    sources.notices.mockResolvedValue([{ slug: "dated", publishedAt: "2026.06.20" }, { slug: "undated", publishedAt: "" }]);
    const entries = await sitemap();
    const dated = entries.find((entry) => entry.url === "https://ninja.test/en/notices/dated");
    const undated = entries.find((entry) => entry.url === "https://ninja.test/en/notices/undated");
    expect(dated?.lastModified).toEqual(new Date("2026-06-20"));
    expect(undated).toBeDefined();
    expect(undated).not.toHaveProperty("lastModified");
  });
});
