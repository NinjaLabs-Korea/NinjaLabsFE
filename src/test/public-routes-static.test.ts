import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The public pages are static (ISR, served from the CDN) only while every server read they make is cached: one `no-store` fetch,
// `searchParams`, `headers()`/`cookies()` or `connection()` turns the route dynamic again and every view pays the function-region
// round trip (production 2026-10-31: 0.7s TTFB for `/ko/bounties` vs 0.07s for a prerendered page). `next build` must keep
// printing `●` for these routes.
vi.mock("@/lib/runtime/config", () => ({
  loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "https://be.example" }),
}));

const { getRuntimeMembers } = await import("@/lib/members");
const { getRuntimeHallOfFame } = await import("@/lib/hall-of-fame");

afterEach(() => vi.unstubAllGlobals());

type Init = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

function stubFetch(bodies: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    const path = new URL(url).pathname;
    return Promise.resolve(new Response(JSON.stringify(bodies[path] ?? [])));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function inits(fetchMock: ReturnType<typeof stubFetch>): Array<[string, Init]> {
  return fetchMock.mock.calls.map((call) => call as unknown as [string, Init]);
}

describe("public list reads go through the Data Cache", () => {
  it("members", async () => {
    const fetchMock = stubFetch({ "/members": [] });
    await getRuntimeMembers();
    expect(inits(fetchMock)).toEqual([["https://be.example/members", expect.objectContaining({ next: { revalidate: 30, tags: ["public:members"] } })]]);
    expect(inits(fetchMock)[0][1].cache).toBeUndefined();
  });

  it("hall of fame highlights and stats", async () => {
    const fetchMock = stubFetch({ "/hall-of-fame": [], "/hall-of-fame/stats": { completedBounties: 0, builders: 0, completionNfts: 0, paidTotals: [] } });
    await getRuntimeHallOfFame("en");
    const calls = inits(fetchMock);
    expect(calls.map(([url]) => url).sort()).toEqual(["https://be.example/hall-of-fame", "https://be.example/hall-of-fame/stats"]);
    for (const [, init] of calls) {
      expect(init.next).toEqual({ revalidate: 30, tags: ["public:hall-of-fame"] });
      expect(init.cache).toBeUndefined();
    }
  });
});

describe("public list pages read no request-time API", () => {
  const pages = ["page.tsx", "about/page.tsx", "bounties/page.tsx", "members/page.tsx", "notices/page.tsx", "hall-of-fame/page.tsx", "home/page.tsx", "recruit/page.tsx"];
  it.each(pages)("%s", (page) => {
    const source = readFileSync(join(process.cwd(), "src/app/[locale]", page), "utf8");
    expect(source).not.toMatch(/\bsearchParams\b|\bheaders\(\)|\bcookies\(\)|\bconnection\(\)|force-dynamic|draftMode\(\)/);
  });
});
