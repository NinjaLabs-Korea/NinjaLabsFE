import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public")>()),
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { PublicApiError } = await import("@/lib/api/public");
const { getRuntimeNotice, getRuntimeNotices } = await import("@/lib/notices");

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

describe("notice detail loader failure modes", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("maps the detail row and requests the encoded id", async () => {
    fetchPublicJson.mockResolvedValueOnce({ ...row("n1"), body: "B" });
    await expect(getRuntimeNotice("n 1")).resolves.toMatchObject({ slug: "n1", bodyMarkdown: "B" });
    expect(fetchPublicJson).toHaveBeenCalledWith("/notices/n%201");
  });

  it("returns undefined (→ notFound) only when the BE answers 404", async () => {
    fetchPublicJson.mockRejectedValueOnce(new PublicApiError(404, "/notices/x"));
    await expect(getRuntimeNotice("x")).resolves.toBeUndefined();
  });

  it.each([
    ["a BE 500", new PublicApiError(500, "/notices/x")],
    ["the 8s timeout", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["a network failure", new TypeError("fetch failed")],
  ])("rethrows %s", async (_label, failure) => {
    fetchPublicJson.mockRejectedValueOnce(failure);
    await expect(getRuntimeNotice("x")).rejects.toBe(failure);
  });
});

describe("notice event date and event-date sort", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("maps event_date (YYYY-MM-DD) to eventDate, and leaves it off for null, missing or malformed values", async () => {
    fetchPublicJson.mockResolvedValue({
      items: [{ ...row("n1"), event_date: "2026-06-18" }, { ...row("n2"), event_date: null }, row("n3"), { ...row("n4"), event_date: "June 18" }],
      page: 1, pageSize: 50, total: 4,
    });
    const notices = await getRuntimeNotices();
    expect(notices.map(({ slug, eventDate }) => [slug, eventDate])).toEqual([["n1", "2026-06-18"], ["n2", undefined], ["n3", undefined], ["n4", undefined]]);
  });

  it("asks the BE for sort=eventDate and keeps its order (event date newest first, undated last)", async () => {
    fetchPublicJson.mockResolvedValue({ items: [{ ...row("new"), event_date: "2026-09-01" }, { ...row("old"), event_date: "2026-01-01" }, row("undated")], page: 1, pageSize: 50, total: 3 });
    const notices = await getRuntimeNotices({ sort: "eventDate" });
    expect(fetchPublicJson).toHaveBeenCalledWith("/notices?sort=eventDate&page=1&pageSize=50");
    expect(notices.map((notice) => notice.slug)).toEqual(["new", "old", "undated"]);
  });
});
