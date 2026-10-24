import type { NextConfig } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

/** next.config.ts reads its env at module load: import a fresh copy per env. */
async function loadConfig(env: { NINJA_API_BASE_URL?: string; NINJA_APP_ORIGIN?: string }): Promise<NextConfig> {
  vi.resetModules();
  vi.stubEnv("NINJA_API_BASE_URL", env.NINJA_API_BASE_URL ?? "");
  vi.stubEnv("NINJA_APP_ORIGIN", env.NINJA_APP_ORIGIN ?? "");
  return (await import("../../next.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const apiEnv = { NINJA_API_BASE_URL: "https://api.ninjalabs.example/", NINJA_APP_ORIGIN: "https://ninjalabs.example" };

async function headerMap(config: NextConfig) {
  const rules = await config.headers!();
  expect(rules.map((rule) => rule.source)).toEqual(["/:path*"]);
  return Object.fromEntries(rules[0].headers.map((header) => [header.key, header.value]));
}

describe("rewrites", () => {
  it("proxies /media and the cookie-mode /api/auth to the BE, without a double slash", async () => {
    const config = await loadConfig(apiEnv);
    expect(await config.rewrites!()).toEqual([
      { source: "/media/:path*", destination: "https://api.ninjalabs.example/media/:path*" },
      { source: "/api/auth/:path*", destination: "https://api.ninjalabs.example/auth/:path*" },
    ]);
  });

  it("has no rewrite in mock mode (no API URL), so /api/auth is a plain 404", async () => {
    const config = await loadConfig({ NINJA_APP_ORIGIN: "http://localhost:3000" });
    expect(await config.rewrites!()).toEqual([]);
  });
});

describe("redirects", () => {
  it("permanently redirects the id-less og:image URL of every locale and nothing else", async () => {
    const config = await loadConfig(apiEnv);
    const redirects = await config.redirects!();
    expect(redirects).toEqual([{ source: "/:locale(en|ko|zh)/opengraph-image", destination: "/:locale/opengraph-image/social", permanent: true }]);
    const pattern = new RegExp(`^${redirects[0].source.replace(":locale", "")}$`);
    expect(["/en/opengraph-image", "/ko/opengraph-image", "/zh/opengraph-image"].every((path) => pattern.test(path))).toBe(true);
    expect(["/fr/opengraph-image", "/en/opengraph-image/social", "/opengraph-image"].some((path) => pattern.test(path))).toBe(false);
  });
});

describe("security headers", () => {
  it("sends the fixed hardening headers on every path", async () => {
    const headers = await headerMap(await loadConfig(apiEnv));
    expect(headers).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("lists the API origin (not its path) in connect-src and keeps framing and base-uri locked", async () => {
    const config = await loadConfig({ ...apiEnv, NINJA_API_BASE_URL: "https://api.ninjalabs.example/v1/" });
    const csp = (await headerMap(config))["Content-Security-Policy-Report-Only"].split("; ");
    const connect = csp.find((directive) => directive.startsWith("connect-src "))!.split(" ");
    expect(connect).toContain("https://api.ninjalabs.example");
    expect(connect).not.toContain("https://api.ninjalabs.example/v1");
    expect(connect[1]).toBe("'self'");
    expect(csp).toEqual(expect.arrayContaining(["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]));
  });

  it("leaves the API out of connect-src in mock mode or when the URL is not parseable", async () => {
    for (const env of [{ NINJA_APP_ORIGIN: "http://localhost:3000" }, { NINJA_API_BASE_URL: "not a url" }]) {
      const csp = (await headerMap(await loadConfig(env)))["Content-Security-Policy-Report-Only"];
      const connect = csp.split("; ").find((directive) => directive.startsWith("connect-src "))!;
      expect(connect).not.toMatch(/null|undefined|not a url/);
      expect(connect.split(" ")[1]).toBe("'self'");
    }
  });
});

describe("image optimizer allow-list", () => {
  it("allows exactly the API /media/ prefix and the app origin, and inlines the same prefixes for imageProps()", async () => {
    const config = await loadConfig(apiEnv);
    expect(config.env).toEqual({ NINJA_OPTIMIZED_IMAGE_PREFIXES: "https://api.ninjalabs.example/media/,https://ninjalabs.example/" });
    expect(config.images?.remotePatterns?.map((pattern) => (pattern as URL).href)).toEqual([
      "https://api.ninjalabs.example/media/**",
      "https://ninjalabs.example/**",
    ]);
  });

  it("allows nothing remote when neither URL is configured", async () => {
    const config = await loadConfig({});
    expect(config.env).toEqual({ NINJA_OPTIMIZED_IMAGE_PREFIXES: "" });
    expect(config.images?.remotePatterns).toEqual([]);
  });
});
