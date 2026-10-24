import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({ default: () => () => undefined }));

const { config } = await import("@/proxy");
const { STATIC_FILE_EXTENSIONS } = await import("@/lib/static-extensions");

// Next compiles the matcher with path-to-regexp; for this single custom group the anchored RegExp is equivalent.
const matcher = new RegExp(`^${config.matcher[0]}$`);
const runsProxy = (pathname: string) => matcher.test(pathname);

describe("proxy matcher", () => {
  it("locale-redirects app paths, including dotted member handles", () => {
    for (const pathname of ["/", "/bounties", "/members/ninja.inj", "/members/first.last", "/ko/members/ninja.inj", "/notices/v1.2-release", "/skill.md.html", "/apiary", "/members/api"]) {
      expect(runsProxy(pathname), pathname).toBe(true);
    }
  });

  it("skips Next internals, persisted media, the unprefixed skill.md download, and real static files", () => {
    for (const pathname of [
      "/_next/static/chunks/app.js", "/_next/image?url=x", "/_vercel/insights/script.js", "/media/uploads/logo.png", "/skill.md",
      "/api/auth/refresh", "/api/auth/exchange", "/api/auth/logout",
      "/icon.png", "/favicon.ico", "/figma/injective-token.svg", "/robots.txt", "/sitemap.xml", "/manifest.json",
      "/fonts/inter.woff2", "/fonts/inter.woff", "/fonts/inter.ttf", "/app.css", "/app.js.map", "/photo.jpeg", "/photo.jpg", "/photo.gif", "/photo.webp", "/photo.avif",
    ]) {
      expect(runsProxy(pathname), pathname).toBe(false);
    }
  });

  it("keeps the literal extension group identical to lib/static-extensions.ts (the nickname rule's source)", () => {
    const group = /\.\*\\\.\(\?:([a-z0-9|]+)\)\$/.exec(config.matcher[0])?.[1];
    expect(group?.split("|")).toEqual([...STATIC_FILE_EXTENSIONS]);
    for (const extension of STATIC_FILE_EXTENSIONS) expect(runsProxy(`/members/ninja.${extension}`), extension).toBe(false);
  });
});
