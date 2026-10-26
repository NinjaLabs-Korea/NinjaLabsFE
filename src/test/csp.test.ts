import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routing } from "@/i18n/routing";
import {
  contentSecurityPolicy,
  createNonce,
  isNonceRoute,
  NONCE_ROUTE_HEADER_SOURCE,
  NONCE_ROUTE_PATTERNS,
} from "@/lib/csp";
import { matchesLocaleRoute } from "@/lib/locale-routes";

vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "mock", apiUrl: "https://api.example" }) }));

const { default: proxy } = await import("@/proxy");

const ORIGIN = "https://ninjalabs.example";
const NONCE_RE = /^[A-Za-z0-9+/]{22}==$/;

afterEach(() => {
  vi.unstubAllEnvs();
});

function directive(policy: string, name: string): string[] {
  return policy.split("; ").find((part) => part.startsWith(`${name} `))!.split(" ").slice(1);
}

describe("createNonce", () => {
  it("is 128 bits of base64 and differs per call", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(NONCE_RE);
  });
});

describe("isNonceRoute", () => {
  it.each(["/en/account", "/ko/admin", "/zh/admin/users", "/en/admin/operations", "/en/agents", "/en/agents/register", "/en/auth/callback", "/en/account/"])(
    "%s gets the nonce policy",
    (pathname) => expect(isNonceRoute(pathname)).toBe(true),
  );

  it.each([
    "/en",
    "/en/bounties",
    "/en/agentsx",
    "/en/agents-guide",
    "/en/administrators",
    "/en/accounts",
    "/en/signup",
    "/en/auth",
    "/en/members/account",
    "/account",
    "/fr/account",
    "/en/page-not-found",
  ])("%s keeps the public policy", (pathname) => expect(isNonceRoute(pathname)).toBe(false));

  it("only lists real locale routes", () => {
    for (const pattern of NONCE_ROUTE_PATTERNS) expect(matchesLocaleRoute(pattern) || matchesLocaleRoute(`${pattern}/users`)).toBe(true);
  });

  it("agrees with the next.config header source for every locale and route", () => {
    // The header source excludes exactly what the proxy nonces: a path must never get both policies, or neither.
    const excluded = new RegExp(`^${NONCE_ROUTE_HEADER_SOURCE.replace("/:path", "/")}$`);
    for (const locale of routing.locales) {
      for (const path of ["", "/account", "/admin", "/admin/users", "/agents", "/agents/register", "/auth/callback", "/bounties", "/signup"]) {
        const url = `/${locale}${path}`;
        expect(excluded.test(url), url).toBe(!isNonceRoute(url));
      }
    }
    expect(excluded.test("/")).toBe(true);
    expect(excluded.test("/skill.md")).toBe(true);
  });
});

describe("contentSecurityPolicy", () => {
  it("public policy keeps 'unsafe-inline' and has no nonce", () => {
    const policy = contentSecurityPolicy("enforce");
    expect(directive(policy, "script-src")).toEqual(["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"]);
    expect(policy).not.toContain("nonce-");
  });

  it("nonce policy swaps only 'unsafe-inline' for the nonce in script-src", () => {
    const nonce = createNonce();
    const policy = contentSecurityPolicy("enforce", nonce);
    expect(directive(policy, "script-src")).toEqual(["'self'", `'nonce-${nonce}'`, "https://challenges.cloudflare.com"]);
    expect(policy.replace(`'nonce-${nonce}'`, "'unsafe-inline'")).toBe(contentSecurityPolicy("enforce"));
  });

  it("keeps the Turnstile and (preview only) toolbar origins, and dev 'unsafe-eval', under a nonce", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(directive(contentSecurityPolicy("report-only", "abc"), "script-src")).toEqual([
      "'self'",
      "'nonce-abc'",
      "'unsafe-eval'",
      "https://challenges.cloudflare.com",
      "https://vercel.live",
    ]);
  });
});

describe("proxy CSP selection", () => {
  async function run(pathname: string, headers: Record<string, string> = {}) {
    return proxy(new NextRequest(new URL(pathname, ORIGIN), { headers }));
  }
  const cspOf = (response: Response) => response.headers.get("content-security-policy") ?? response.headers.get("content-security-policy-report-only");

  it.each(["/en/account", "/ko/admin/users", "/ko/agents", "/zh/agents/register", "/en/auth/callback"])("%s: nonce CSP on the response, request header and x-nonce agree", async (pathname) => {
    const response = await run(pathname);
    const csp = cspOf(response)!;
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    expect(nonce).toMatch(NONCE_RE);
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    // Next reads the nonce from the forwarded REQUEST headers (x-middleware-request-*), so they must carry it too.
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    const forwarded = response.headers.get("x-middleware-request-content-security-policy") ?? response.headers.get("x-middleware-request-content-security-policy-report-only");
    expect(forwarded).toBe(csp);
  });

  it("uses a different nonce per request", async () => {
    const a = cspOf(await run("/en/account"));
    const b = cspOf(await run("/en/account"));
    expect(a).not.toBe(b);
  });

  it("ignores a client-supplied CSP or nonce", async () => {
    const response = await run("/en/account", { "content-security-policy": "script-src 'nonce-EVIL'", "x-nonce": "EVIL" });
    expect(response.headers.get("x-middleware-request-x-nonce")).not.toBe("EVIL");
    expect(cspOf(response)).not.toContain("EVIL");
    expect(response.headers.get("x-middleware-request-content-security-policy") ?? response.headers.get("x-middleware-request-content-security-policy-report-only")).not.toContain("EVIL");
  });

  it.each(["/en", "/en/bounties", "/en/hall-of-fame", "/en/signup", "/en/members/ninja"])("%s: public page, no proxy CSP and no nonce (stays static)", async (pathname) => {
    const response = await run(pathname);
    expect(cspOf(response)).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
  });
});

describe("nonce routes render per request", () => {
  // A nonce is stamped during SSR; a prerendered page would ship without it and break under the nonce policy.
  const files = [
    "src/app/[locale]/account/page.tsx",
    "src/app/[locale]/admin/layout.tsx",
    "src/app/[locale]/agents/layout.tsx",
    "src/app/[locale]/agents/register/page.tsx",
    "src/app/[locale]/auth/callback/layout.tsx",
  ];
  it.each(files)("%s awaits connection()", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).toContain('from "next/server"');
    expect(source).toMatch(/await connection\(\)/);
  });
});
