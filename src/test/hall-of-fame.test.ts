import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", () => ({
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { loadRuntimeHallOfFame } = await import("@/lib/hall-of-fame");

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
    const { hallOfFame, unavailable } = await loadRuntimeHallOfFame("en");
    expect(unavailable).toBe(false);
    expect(hallOfFame.partners).toEqual([{ name: "Injective", logo: "/media/injective.png", href: "https://injective.com" }]);
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
    const { hallOfFame } = await loadRuntimeHallOfFame("en");
    expect(hallOfFame.partners).toEqual([{ name: "Script link", logo: "/media/ok.png", href: null }]);
    expect(hallOfFame.highlights.map(({ href, image }) => [href, image])).toEqual([
      ["/notices", "/media/ok.png"],
      ["https://ok.test", null],
      ["/notices", null],
    ]);
  });

  it("returns an empty, unavailable result when the API fails", async () => {
    fetchPublicJson.mockRejectedValue(new Error("down"));
    const { hallOfFame, unavailable } = await loadRuntimeHallOfFame("en");
    expect(unavailable).toBe(true);
    expect(hallOfFame.partners).toEqual([]);
    expect(hallOfFame.stats).toEqual([]);
  });
});
