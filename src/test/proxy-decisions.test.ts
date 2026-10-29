import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ mode: "mock" as "mock" | "api" }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: runtime.mode, apiUrl: "https://api.example" }) }));

const { default: proxy } = await import("@/proxy");

const ORIGIN = "https://ninjalabs.example";
const uuid = "4f2c3f0e-9d2a-4a5b-8c6d-1e2f3a4b5c6d";

async function run(pathname: string, headers: Record<string, string> = {}) {
  const response = await proxy(new NextRequest(new URL(pathname, ORIGIN), { headers }));
  const rewrite = response.headers.get("x-middleware-rewrite");
  const location = response.headers.get("location");
  return {
    status: response.status,
    rewrite: rewrite ? new URL(rewrite).pathname : null,
    location: location ? new URL(location, ORIGIN).pathname : null,
    response,
  };
}

afterEach(() => {
  runtime.mode = "mock";
});

describe("proxy: unprefixed paths get a locale", () => {
  it.each([
    ["/", {}, "/en"],
    ["/bounties", {}, "/en/bounties"],
    ["/members/ninja.inj", {}, "/en/members/ninja.inj"],
    ["/bounties", { "accept-language": "ko-KR,ko;q=0.9" }, "/ko/bounties"],
    ["/notices", { "accept-language": "zh-CN" }, "/zh/notices"],
    ["/notices", { cookie: "NEXT_LOCALE=ko", "accept-language": "zh-CN" }, "/ko/notices"],
    ["/notices", { "accept-language": "fr-FR" }, "/en/notices"],
  ])("%s %o -> %s", async (pathname, headers, location) => {
    const result = await run(pathname, headers);
    expect(result.status).toBeGreaterThanOrEqual(300);
    expect(result.status).toBeLessThan(400);
    expect(result.location).toBe(location);
  });
});

describe("proxy: in-locale routes (mock mode)", () => {
  it.each([
    "/en",
    "/ko/bounties",
    "/zh/bounties/apply",
    "/en/bounties/iasset-price-widget",
    "/ko/members/jaemin",
    "/en/notices/july-bounty-sponsor-review-call",
    "/en/admin/users",
    "/ko/auth/callback",
    "/en/signup/get-started",
    "/en/opengraph-image/social",
  ])("serves %s as is", async (pathname) => {
    const result = await run(pathname);
    expect(result.status).toBe(200);
    expect(result.location).toBeNull();
    expect(result.rewrite).not.toBe(pathname.replace(/^\/(\w+).*/, "/$1/page-not-found"));
  });

  it.each([
    ["/ko/nope", "/ko/page-not-found"],
    ["/en/bounties/apply/extra", "/en/page-not-found"],
    ["/zh/admin/unknown", "/zh/page-not-found"],
    ["/en/page-not-found", "/en/page-not-found"],
    ["/en/bounties/does-not-exist", "/en/page-not-found"],
    ["/ko/members/nobody-here", "/ko/page-not-found"],
    ["/en/notices/%00", "/en/page-not-found"],
    ["/en/bounties/%E0%A4%A", "/en/page-not-found"],
  ])("rewrites %s to %s with status 404", async (pathname, target) => {
    const result = await run(pathname);
    expect(result.status).toBe(404);
    expect(result.rewrite).toBe(target);
  });
});

describe("proxy: 404 rewrite keeps a CSP on nonce routes", () => {
  it.each(["/en/agents/xyz", "/en/account/foo", "/en/admin/zzz", "/en/auth/callback/x", "/ko/agents/00000000-0000-0000-0000-000000000000"])(
    "%s carries the public (non-nonce) policy",
    async (pathname) => {
      const { status, response } = await run(pathname);
      expect(status).toBe(404);
      const csp = response.headers.get("content-security-policy") ?? response.headers.get("content-security-policy-report-only");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).not.toContain("nonce-");
    },
  );
});

describe("proxy: detail ids in api mode (shape only, no BE call)", () => {
  it("lets well-formed ids through and 404s malformed or reserved ones", async () => {
    runtime.mode = "api";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      expect((await run(`/en/bounties/${uuid}`)).status).toBe(200);
      expect((await run(`/ko/notices/${uuid.toUpperCase()}`)).status).toBe(200);
      expect((await run("/en/members/ninja.inj")).status).toBe(200);
      expect((await run("/en/members/%EB%8B%8C%EC%9E%90")).status).toBe(200);
      for (const pathname of ["/en/bounties/iasset-price-widget", "/en/notices/123", "/en/members/me", "/en/members/ADMIN", "/en/members/a%2Fb", "/en/members/a%20b"]) {
        const result = await run(pathname);
        expect(result.status, pathname).toBe(404);
        expect(result.rewrite, pathname).toBe("/en/page-not-found");
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("proxy: locale cookie on the 404 rewrite", () => {
  it("keeps every Set-Cookie the locale middleware produced", async () => {
    const plain = await run("/ko/bounties");
    const notFound = await run("/ko/nope");
    expect(notFound.response.headers.getSetCookie()).toEqual(plain.response.headers.getSetCookie());
  });
});

describe("proxy: the hub is never skipped", () => {
  it.each(["/en", "/ko/", "/zh"])("serves %s to everyone, even with a stale ninja_home cookie from an older release", async (pathname) => {
    for (const cookie of [undefined, "ninja_home=1", "ninja_home=0"]) {
      const result = await run(pathname, cookie ? { cookie } : {});
      expect(result.status, `${pathname} ${cookie}`).toBe(200);
      expect(result.location, `${pathname} ${cookie}`).toBeNull();
    }
  });

  it("does not set or read any ninja_home cookie", async () => {
    const result = await run("/en", { cookie: "ninja_home=1" });
    expect(result.response.headers.getSetCookie().join(";")).not.toContain("ninja_home");
  });

  it("serves the new public pages in api mode too", async () => {
    runtime.mode = "api";
    for (const pathname of ["/en/about", "/ko/recruit", "/zh/home", "/en/admin/recruitment"]) expect((await run(pathname)).status, pathname).toBe(200);
  });
});

describe("proxy: hreflang has one source", () => {
  it.each(["/ko/notices", "/en", "/zh/bounties"])("%s carries no next-intl Link alternate header (the head and the sitemap own hreflang)", async (pathname) => {
    const { response } = await run(pathname);
    expect(response.headers.get("link")).toBeNull();
  });
});
