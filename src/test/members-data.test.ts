import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatUtcDate } from "@/lib/api/codecs";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", () => ({
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { getRuntimeProfile, toCompletionReward } = await import("@/lib/members");
const { loadRuntimeHallOfFame } = await import("@/lib/hall-of-fame");

const previousTimeZone = process.env.TZ;

// UTC+14: 23:30Z on the last day of a month is already the next month locally, so an unpinned
// toLocaleDateString(locale) would print the wrong month/day.
beforeAll(() => {
  process.env.TZ = "Pacific/Kiritimati";
  expect(new Date("2026-05-31T23:30:00Z").getMonth()).toBe(5);
});
afterAll(() => {
  if (previousTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimeZone;
});

describe("formatUtcDate", () => {
  it("pins the display date to UTC like src/i18n/request.ts and yields empty for bad input", () => {
    expect(formatUtcDate("2026-05-31T23:30:00Z", "en", { year: "numeric", month: "long", day: "numeric" })).toBe("May 31, 2026");
    expect(formatUtcDate("2026-05-31T23:30:00Z", "ko", { year: "numeric", month: "long" })).toBe("2026년 5월");
    expect(formatUtcDate(null, "en", { year: "numeric" })).toBe("");
    expect(formatUtcDate("garbage", "en", { year: "numeric" })).toBe("");
  });
});

describe("public profile dates", () => {
  it("formats joinedAt and completedAt in UTC regardless of the server time zone", async () => {
    fetchPublicJson.mockResolvedValueOnce({
      nickname: "ninja.inj", bio: "", created_at: "2026-05-31T23:30:00Z", tags: ["DEV"],
      completedBounties: [{ id: "b1", title: "Widget", category: "DEV", completed_at: "2026-06-30T23:59:00Z", rewards: [{ amount: "1000000000000000000", symbol: "INJ" }] }],
      agents: [], nfts: [],
    });
    const profile = await getRuntimeProfile("ninja.inj", "en");
    expect(profile?.joinedAt).toBe("May 2026");
    expect(profile?.completions[0]?.completedAt).toBe("June 30, 2026");
  });
});

describe("public profile payout status", () => {
  const paid = [{ amount: "1000000000000000000", symbol: "INJ" }];
  const posted = [{ amount: "500000000", symbol: "USDC" }];

  it("shows the paid payout when PAID", () => {
    expect(toCompletionReward({ rewards: paid, postedRewards: posted, payoutStatus: "PAID" })).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" });
  });

  it("shows the posted reward flagged as pending when PENDING", () => {
    expect(toCompletionReward({ rewards: [], postedRewards: posted, payoutStatus: "PENDING" })).toEqual({ reward: { amount: 500, currency: "USDC" }, payoutStatus: "PENDING" });
  });

  it("shows nothing when NONE, even if the bounty posted a reward", () => {
    expect(toCompletionReward({ rewards: [], postedRewards: posted, payoutStatus: "NONE" })).toEqual({ reward: null, payoutStatus: "NONE" });
  });

  it("falls back to `rewards` when an older BE omits payoutStatus/postedRewards", () => {
    expect(toCompletionReward({ rewards: paid })).toEqual({ reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" });
    expect(toCompletionReward({ rewards: [] })).toEqual({ reward: null, payoutStatus: "NONE" });
  });

  it("maps the profile rows end to end", async () => {
    fetchPublicJson.mockResolvedValueOnce({
      nickname: "ninja.inj", bio: "", created_at: "2026-05-31T23:30:00Z", tags: ["DEV"],
      completedBounties: [
        { id: "b1", title: "Paid", category: "DEV", completed_at: "2026-06-30T23:59:00Z", rewards: paid, postedRewards: paid, payoutStatus: "PAID" },
        { id: "b2", title: "Pending", category: "DESIGN", completed_at: "2026-06-29T23:59:00Z", rewards: [], postedRewards: posted, payoutStatus: "PENDING" },
        { id: "b3", title: "None", category: "CONTENT", completed_at: "2026-06-28T23:59:00Z", rewards: [], postedRewards: posted, payoutStatus: "NONE" },
      ],
      agents: [], nfts: [],
    });
    const profile = await getRuntimeProfile("ninja.inj", "en");
    expect(profile?.completions.map(({ reward, payoutStatus }) => ({ reward, payoutStatus }))).toEqual([
      { reward: { amount: 1, currency: "INJ" }, payoutStatus: "PAID" },
      { reward: { amount: 500, currency: "USDC" }, payoutStatus: "PENDING" },
      { reward: null, payoutStatus: "NONE" },
    ]);
  });
});

describe("hall of fame milestone dates", () => {
  it("formats published_at in UTC and keeps an empty date for unpublished rows", async () => {
    fetchPublicJson.mockImplementation(async (path: string) =>
      path.endsWith("/stats")
        ? { completedBounties: 0, builders: 0, completionNfts: 0, sponsors: 0 }
        : [
            { id: "m1", type: "MILESTONE", title: "Launch", description: "", image_url: null, link_url: null, published_at: "2026-05-31T23:30:00Z" },
            { id: "m2", type: "MILESTONE", title: "Soon", description: "", image_url: null, link_url: null, published_at: null },
          ],
    );
    const { hallOfFame } = await loadRuntimeHallOfFame("en");
    expect(hallOfFame.milestones.map((milestone) => milestone.date)).toEqual(["May 31, 2026", ""]);
  });
});
