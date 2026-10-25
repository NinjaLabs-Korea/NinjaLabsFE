import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { inLocaleMiss, localeRoutePatterns, matchesLocaleRoute, NOT_FOUND_SEGMENT } from "@/lib/locale-routes";

const localeDir = join(process.cwd(), "src/app/[locale]");

/** Route patterns derived from the file system: every page.tsx, plus `opengraph-image/[id]` for the image route. */
function routesOnDisk(dir = localeDir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return routesOnDisk(full);
    const route = `/${relative(localeDir, dir).split(sep).filter(Boolean).join("/")}`;
    if (entry.name === "page.tsx") return [route];
    if (entry.name === "opengraph-image.tsx") return [`${route === "/" ? "" : route}/opengraph-image/[id]`];
    return [];
  });
}

describe("in-locale route table (proxy 404 rewrite)", () => {
  it("lists exactly the routes under src/app/[locale] except the 404 document itself", () => {
    const onDisk = routesOnDisk().filter((route) => route !== `/${NOT_FOUND_SEGMENT}`).sort();
    expect([...localeRoutePatterns].sort()).toEqual(onDisk);
  });

  it("matches static and [id] routes and rejects unknown or deeper paths", () => {
    for (const path of ["/", "/bounties", "/bounties/apply", "/bounties/x", "/members/ninja.inj", "/opengraph-image/social"]) {
      expect(matchesLocaleRoute(path), path).toBe(true);
    }
    for (const path of ["/nope", "/bounties/x/y", "/admin/nope", `/${NOT_FOUND_SEGMENT}`, "/opengraph-image"]) {
      expect(matchesLocaleRoute(path), path).toBe(false);
    }
  });

  it("flags only in-locale misses", () => {
    expect(inLocaleMiss("/ko/nope")).toBe("ko");
    expect(inLocaleMiss("/en/bounties/x/y")).toBe("en");
    expect(inLocaleMiss(`/zh/${NOT_FOUND_SEGMENT}`)).toBe("zh");
    for (const pathname of ["/en", "/ko/bounties", "/en/members/ninja.inj", "/nope", "/fr/nope"]) {
      expect(inLocaleMiss(pathname), pathname).toBeNull();
    }
  });
});
