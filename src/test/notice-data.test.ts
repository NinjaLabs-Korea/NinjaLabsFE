import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", () => ({
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { getRuntimeNotices } = await import("@/lib/notices");

const row = (id: string, published_at = "2026-06-20T15:30:00Z") => ({
  id, title: id, summary: null, category: "NINJALABS", thumbnail_url: null, external_url: null, published_at,
});

describe("notice list loading", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("loads every page like the bounty list and de-duplicates rows", async () => {
    fetchPublicJson.mockImplementation(async (path: string) => {
      const params = new URLSearchParams(path.split("?")[1]);
      expect(params.get("pageSize")).toBe("50");
      const page = Number(params.get("page"));
      const items = page === 1 ? Array.from({ length: 50 }, (_, index) => row(`n${index}`)) : [row("n49"), row("n50")];
      return { items, page, pageSize: 50, total: 51 };
    });
    const notices = await getRuntimeNotices();
    expect(fetchPublicJson).toHaveBeenCalledTimes(2);
    expect(fetchPublicJson.mock.calls.map(([path]) => path)).toEqual([
      "/notices?page=1&pageSize=50",
      "/notices?page=2&pageSize=50",
    ]);
    expect(notices).toHaveLength(51);
    expect(notices.at(-1)?.slug).toBe("n50");
  });

  it("keeps the list when one row has no parseable published_at", async () => {
    fetchPublicJson.mockResolvedValue({
      items: [row("n1", "2026-06-20T23:30:00Z"), { ...row("n2"), published_at: null }, row("n3", "garbage")],
      page: 1, pageSize: 50, total: 3,
    });
    const notices = await getRuntimeNotices();
    expect(notices.map(({ slug, publishedAt }) => [slug, publishedAt])).toEqual([["n1", "2026.06.20"], ["n2", ""], ["n3", ""]]);
  });

  it("keeps the stable YYYY.MM.DD label that sitemap.ts parses back", async () => {
    fetchPublicJson.mockResolvedValue({ items: [row("n1", "2026-06-20T23:30:00Z")], page: 1, pageSize: 50, total: 1 });
    const [notice] = await getRuntimeNotices();
    expect(notice.publishedAt).toBe("2026.06.20");
    expect(new Date(notice.publishedAt.replaceAll(".", "-")).toISOString()).toBe("2026-06-20T00:00:00.000Z");
  });
});
