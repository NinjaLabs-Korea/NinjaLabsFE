import { afterEach, describe, expect, it, vi } from "vitest";
import { localeAlternates } from "@/i18n/alternates";
import { loadMessages, loadNamespace, namespaces, pickMessages } from "@/i18n/messages";
import { localeTags, routing, stripLocale, withLocaleOf } from "@/i18n/routing";

const runtime = vi.hoisted(() => ({ config: { runtimeMode: "api", apiUrl: "https://api.example/" } as { runtimeMode: string; apiUrl?: string } }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => runtime.config }));

const { fetchAllPublicPages, PUBLIC_MAX_PAGES, PUBLIC_PAGE_SIZE } = await import("@/lib/api/paging");
const { fetchPublicJson, loadFromRuntime } = await import("@/lib/api/public");

afterEach(() => {
  runtime.config = { runtimeMode: "api", apiUrl: "https://api.example/" };
  vi.unstubAllGlobals();
});

describe("locale path helpers", () => {
  it.each([
    ["/ko/signup/wallet", "/signup/wallet"],
    ["/en", "/"],
    ["/zh/", "/"],
    ["/signup", "/signup"],
    ["/fr/signup", "/fr/signup"],
    ["/", "/"],
    ["/english/x", "/english/x"],
  ])("stripLocale(%s) = %s", (pathname, expected) => {
    expect(stripLocale(pathname)).toBe(expected);
  });

  it.each([
    ["/ko/bounties", "/signup/wallet", "/ko/signup/wallet"],
    ["/zh", "/", "/zh/"],
    ["/bounties", "/signup", "/signup"],
    ["/kor/x", "/signup", "/signup"],
  ])("withLocaleOf(%s, %s) = %s", (current, path, expected) => {
    expect(withLocaleOf(current, path)).toBe(expected);
  });

  it("emits hreflang keys from localeTags for every routed locale", () => {
    const { languages } = localeAlternates("zh", "/members/ninja.inj");
    expect(Object.keys(languages ?? {})).toEqual(routing.locales.map((locale) => localeTags[locale].htmlLang));
    expect(languages).toMatchObject({ "zh-CN": "/zh/members/ninja.inj", ko: "/ko/members/ninja.inj" });
  });
});

describe("message loading and picking", () => {
  it("picks only the named namespaces that exist, in the order asked", () => {
    const messages = { common: { a: 1 }, signup: { b: 2 }, admin: { c: 3 } };
    expect(pickMessages(messages, ["signup", "common"])).toEqual({ signup: { b: 2 }, common: { a: 1 } });
    expect(Object.keys(pickMessages(messages, ["signup", "common"]))).toEqual(["signup", "common"]);
    expect(pickMessages(messages, ["bounties"])).toEqual({});
    expect(pickMessages(messages, [])).toEqual({});
  });

  it("loads every registered namespace for every locale, keyed by namespace", async () => {
    for (const locale of routing.locales) {
      const messages = await loadMessages(locale);
      expect(Object.keys(messages)).toEqual([...namespaces]);
      for (const ns of namespaces) {
        expect(messages[ns], `${locale}/${ns}`).toEqual(await loadNamespace(locale, ns));
        expect(Object.keys(messages[ns] as object).length, `${locale}/${ns}`).toBeGreaterThan(0);
      }
    }
  });

  it("serves different text per locale (no locale silently falls back to English)", async () => {
    const [en, ko, zh] = await Promise.all(routing.locales.map((locale) => loadNamespace(locale, "common")));
    expect(JSON.stringify(ko)).not.toBe(JSON.stringify(en));
    expect(JSON.stringify(zh)).not.toBe(JSON.stringify(en));
  });
});

describe("public list paging", () => {
  type Page = { items: Array<{ id: string }>; total: number };

  function stubPages(total: number, rowsFor: (page: number) => string[] = (page) => [`p${page}`]) {
    const request = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return Response.json({ items: rowsFor(page).map((id) => ({ id })), total } satisfies Page);
    });
    vi.stubGlobal("fetch", request);
    return request;
  }
  const requested = (request: ReturnType<typeof vi.fn>) => request.mock.calls.map(([url]) => url as string);

  it("asks for pageSize 50 and appends to an existing query with &", async () => {
    const request = stubPages(120);
    await expect(fetchAllPublicPages("/notices?category=EVENT")).resolves.toEqual([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
    expect(requested(request)).toEqual([
      `https://api.example/notices?category=EVENT&page=1&pageSize=${PUBLIC_PAGE_SIZE}`,
      `https://api.example/notices?category=EVENT&page=2&pageSize=${PUBLIC_PAGE_SIZE}`,
      `https://api.example/notices?category=EVENT&page=3&pageSize=${PUBLIC_PAGE_SIZE}`,
    ]);
  });

  it.each([
    [0, 1],
    [1, 1],
    [50, 1],
    [51, 2],
    [100_000, PUBLIC_MAX_PAGES],
  ])("total %i -> %i request(s)", async (total, expected) => {
    const request = stubPages(total);
    await fetchAllPublicPages("/bounties");
    expect(request).toHaveBeenCalledTimes(expected);
    expect(requested(request)[0]).toBe(`https://api.example/bounties?page=1&pageSize=${PUBLIC_PAGE_SIZE}`);
  });

  it("reads every page through the Data Cache window, so list views do not each cost ceil(total/50) BE calls", async () => {
    const request = stubPages(120);
    await fetchAllPublicPages("/bounties");
    for (const [, init] of request.mock.calls as unknown as Array<[string, RequestInit & { next?: { revalidate: number } }]>) {
      expect(init.next).toEqual({ revalidate: 30, tags: ["public:bounties"] }); // tagged so an admin write can expire it at once
      expect(init.cache).toBeUndefined();
    }
  });

  it("drops rows that shifted onto a later page while loading", async () => {
    stubPages(60, (page) => (page === 1 ? ["a", "b"] : ["b", "c"]));
    await expect(fetchAllPublicPages("/bounties")).resolves.toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("fails the whole list when a later page fails (no silently partial list)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      new URL(url).searchParams.get("page") === "2" ? new Response(null, { status: 500 }) : Response.json({ items: [{ id: "a" }], total: 80 })));
    await expect(fetchAllPublicPages("/bounties")).rejects.toThrow("Public API 500: /bounties?page=2&pageSize=50");
  });
});

describe("public fetcher and runtime source selection", () => {
  it("refuses to fetch in mock mode or without an API URL", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    runtime.config = { runtimeMode: "mock" };
    await expect(fetchPublicJson("/bounties")).rejects.toThrow("Public API is unavailable in mock mode.");
    runtime.config = { runtimeMode: "api" };
    await expect(fetchPublicJson("/bounties")).rejects.toThrow("Public API is unavailable in mock mode.");
    expect(request).not.toHaveBeenCalled();
  });

  it("fetches uncached and reports the status on failure", async () => {
    const request = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", request);
    await expect(fetchPublicJson("/notices/x")).rejects.toThrow("Public API 404: /notices/x");
    expect(request).toHaveBeenCalledWith("https://api.example/notices/x", { cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it("runs only the source for the current mode", async () => {
    const mock = vi.fn(() => "mock");
    const api = vi.fn(async () => "api");
    await expect(loadFromRuntime({ mock, api })).resolves.toBe("api");
    runtime.config = { runtimeMode: "mock" };
    await expect(loadFromRuntime({ mock, api })).resolves.toBe("mock");
    expect(mock).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledTimes(1);
  });
});
