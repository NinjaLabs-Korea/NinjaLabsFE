import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  settle: (await importOriginal<typeof import("@/lib/api/public")>()).settle,
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { settle } = await import("@/lib/api/public");
const { formatPaidTotals, hallOfFame: hallOfFameFixture, emptyHallOfFame, getRuntimeHallOfFame, isZeroStatValue, visibleStats } = await import("@/lib/hall-of-fame");

const highlight = (type: string, title: string, image_url: string | null, link_url: string | null = null) => ({
  id: title, type, title, description: "", image_url, link_url, published_at: null,
});

describe("hall of fame partner wall", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("builds the wall from partnership highlights that have a logo", async () => {
    fetchPublicJson.mockImplementation(async (path: string) =>
      path.endsWith("/stats")
        ? { completedBounties: 0, builders: 0, completionNfts: 0, sponsors: 0 }
        : [
            highlight("PARTNERSHIP", "Injective", "/media/injective.png", "https://injective.com"),
            highlight("PARTNERSHIP", "No logo yet", null),
            highlight("MILESTONE", "Launch", "/media/launch.png"),
          ],
    );
    const { value: hallOfFame, unavailable } = await settle(getRuntimeHallOfFame("en"), emptyHallOfFame);
    expect(unavailable).toBe(false);
    expect(hallOfFame.partners).toEqual([{ name: "Injective", logo: "/media/injective.png", href: "https://injective.com" }]);
    expect(hallOfFame.highlights.map((h) => h.title)).toEqual(["No logo yet", "Launch"]);
  });

  it("drops unsafe admin-entered link and image URLs instead of rendering them", async () => {
    fetchPublicJson.mockImplementation(async (path: string) =>
      path.endsWith("/stats")
        ? { completedBounties: 0, builders: 0, completionNfts: 0, sponsors: 0 }
        : [
            highlight("PARTNERSHIP", "Script link", "/media/ok.png", "javascript:alert(1)"),
            highlight("PARTNERSHIP", "Data logo", "data:image/svg+xml,<svg/>", "https://ok.test"),
            highlight("MILESTONE", "Protocol-relative", "//evil.test/x.png", "//evil.test"),
          ],
    );
    const { value: hallOfFame } = await settle(getRuntimeHallOfFame("en"), emptyHallOfFame);
    expect(hallOfFame.partners).toEqual([{ name: "Script link", logo: "/media/ok.png", href: null }]);
    // "Script link" has a safe logo, so it lives on the partner wall only.
    expect(hallOfFame.highlights.map(({ href, image }) => [href, image])).toEqual([
      ["https://ok.test", null],
      ["/notices", null],
    ]);
  });

  it("returns an empty, unavailable result when the API fails", async () => {
    fetchPublicJson.mockRejectedValue(new Error("down"));
    const { value: hallOfFame, unavailable } = await settle(getRuntimeHallOfFame("en"), emptyHallOfFame);
    expect(unavailable).toBe(true);
    expect(hallOfFame.partners).toEqual([]);
    expect(hallOfFame.stats).toEqual([]);
  });
});

const counts = { completedBounties: 3, builders: 5, completionNfts: 2, sponsors: 1 };
const usdc = { symbol: "USDC", tokenType: "ERC20", decimals: 6, amount: "12500000000" };
const inj = { symbol: "INJ", tokenType: "NATIVE", decimals: 18, amount: "300000000000000000000" };

describe("hall of fame rewards paid stat", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("formats per-token base-unit totals with their decimals and the locale", () => {
    expect(formatPaidTotals([usdc, inj], "en")).toBe("12,500 USDC · 300 INJ");
    expect(formatPaidTotals([{ ...inj, amount: "1234567800000000000000" }], "ko")).toBe("1,234.57 INJ");
    // beyond Number precision the integer part stays exact
    expect(formatPaidTotals([{ ...inj, amount: "123456789012345678901234567000000000000000000" }], "en")).toBe(
      "123,456,789,012,345,678,901,234,567 INJ",
    );
  });

  it("skips entries it cannot scale and returns null when nothing is left", () => {
    expect(formatPaidTotals([{ ...usdc, symbol: "ATOM", decimals: null }, inj], "en")).toBe("300 INJ");
    expect(formatPaidTotals([{ ...usdc, amount: "1.5" }, { ...inj, amount: "0" }], "en")).toBeNull();
    expect(formatPaidTotals([], "en")).toBeNull();
    expect(formatPaidTotals(undefined, "en")).toBeNull();
  });

  it("merges entries that share a symbol and decimals across token types instead of repeating the symbol", () => {
    const cw20Inj = { ...inj, tokenType: "CW20", amount: "5000000000000000000" };
    expect(formatPaidTotals([inj, cw20Inj, usdc], "en")).toBe("305 INJ · 12,500 USDC");
    // different decimals stay separate rather than being summed in mixed units
    expect(formatPaidTotals([inj, { ...cw20Inj, decimals: 6, amount: "5000000" }], "en")).toBe("300 INJ · 5 INJ");
  });

  it("appends the rewards paid stat after the counts when the API reports paid totals", async () => {
    fetchPublicJson.mockImplementation(async (path: string) => (path.endsWith("/stats") ? { ...counts, paidTotals: [usdc, inj] } : []));
    const { value: hallOfFame } = await settle(getRuntimeHallOfFame("en"), emptyHallOfFame);
    expect(hallOfFame.stats).toEqual([
      { value: "3", labelKey: "bountiesCompleted" },
      { value: "5", labelKey: "buildersRewarded" },
      { value: "2", labelKey: "completionNfts" },
      { value: "12,500 USDC · 300 INJ", labelKey: "rewardsPaid" },
    ]);
  });

  it("hides the stat when nothing has been paid or the BE predates the field", async () => {
    for (const stats of [{ ...counts, paidTotals: [] }, counts]) {
      fetchPublicJson.mockImplementation(async (path: string) => (path.endsWith("/stats") ? stats : []));
      const { value: hallOfFame } = await settle(getRuntimeHallOfFame("en"), emptyHallOfFame);
      expect(hallOfFame.stats.map((stat) => stat.labelKey)).not.toContain("rewardsPaid");
    }
  });

  it("ships an API-shaped mock fixture instead of a placeholder value", () => {
    expect(hallOfFameFixture.stats.map((stat) => stat.value)).not.toContain("$-");
    expect(formatPaidTotals(hallOfFameFixture.paidTotals, "en")).toBe("12,500 USDC · 300 INJ");
  });
});

describe("visibleStats (zero stats are hidden)", () => {
  const stat = (value: string) => ({ value, labelKey: "bountiesCompleted" as const });

  it("treats a value with no non-zero digit as zero", () => {
    for (const zero of ["0", "00", "0.0", "0 USDC", "0 USDC · 0 INJ", ""]) expect(isZeroStatValue(zero)).toBe(true);
    for (const some of ["1", "10", "0.5", "12,500 USDC · 300 INJ", "0 USDC · 3 INJ"]) expect(isZeroStatValue(some)).toBe(false);
  });

  it("hides the whole block while every value is zero", () => {
    expect(visibleStats([stat("0"), stat("0"), stat("0")])).toEqual([]);
    expect(visibleStats([])).toEqual([]);
  });

  it("shows the whole block as soon as one value is above zero, keeping the zero ones", () => {
    const stats = [stat("0"), stat("2"), stat("0")];
    expect(visibleStats(stats)).toEqual(stats);
  });
});
