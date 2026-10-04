import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", () => ({ fetchPublicJson: (path: string) => fetchPublicJson(path) }));
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
    const { hallOfFame, unavailable } = await loadRuntimeHallOfFame();
    expect(unavailable).toBe(false);
    expect(hallOfFame.partners).toEqual([{ name: "Injective", logo: "/media/injective.png", href: "https://injective.com" }]);
  });

  it("returns an empty, unavailable result when the API fails", async () => {
    fetchPublicJson.mockRejectedValue(new Error("down"));
    const { hallOfFame, unavailable } = await loadRuntimeHallOfFame();
    expect(unavailable).toBe(true);
    expect(hallOfFame.partners).toEqual([]);
    expect(hallOfFame.stats).toEqual([]);
  });
});
