import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// One page gutter: every max-w-content wrapper (and the 768px legal article) uses px-gutter
// (16px below sm, 24px from sm; @utility in globals.css). Inner card paddings are not checked.
const FE1_PENDING = new Set(["src/components/recruit/RecruitView.tsx"]); // FE-1 converts it to px-gutter

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });
}

/** Class strings ("...") that make a page-level wrapper. */
export function wrapperClassStrings(src: string): string[] {
  return (src.match(/"[^"\n]*"/g) ?? []).filter((c) => c.includes("max-w-content") || /max-w-\[768px\][^"]*\bpy-16\b/.test(c));
}

export function badGutters(src: string): string[] {
  return wrapperClassStrings(src).filter((c) => !/(?<![\w-])px-gutter(?![\w-])/.test(c) || /(?<![\w-])px-[456](?![\w-])/.test(c));
}

describe("page gutter", () => {
  const root = process.cwd();
  const files = tsxFiles(join(root, "src")).map((f) => relative(root, f)).filter((f) => !f.startsWith("src/test"));

  it("detects a wrapper without px-gutter", () => {
    expect(badGutters('<div className="mx-auto max-w-content px-6">')).toHaveLength(1);
    expect(badGutters('<div className="mx-auto max-w-content px-gutter py-4">')).toEqual([]);
    expect(badGutters('<div className="max-w-content px-gutter px-4">')).toHaveLength(1);
  });

  it("defines px-gutter as 16px below sm and 24px from sm", () => {
    const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/@utility px-gutter \{\s*padding-inline: 1rem;\s*@media \(min-width: 40rem\) \{\s*padding-inline: 1\.5rem;/);
  });

  it("every max-w-content wrapper uses px-gutter (RecruitView is converted by FE-1)", () => {
    const offenders = files
      .filter((f) => !FE1_PENDING.has(f))
      .flatMap((f) => badGutters(readFileSync(join(root, f), "utf8")).map((c) => `${f}: ${c}`));
    expect(offenders).toEqual([]);
  });
});

describe("mobile tap targets", () => {
  const footer = readFileSync(join(process.cwd(), "src/components/layout/Footer.tsx"), "utf8");
  const header = readFileSync(join(process.cwd(), "src/components/layout/Header.tsx"), "utf8");
  it("footer links reserve a mobile hit area (40px nav links, 44px legal links)", () => {
    expect(footer.match(/inline-flex min-h-10 items-center sm:min-h-0/g)?.length).toBeGreaterThanOrEqual(2);
    expect(footer.match(/inline-flex max-sm:min-h-11 items-center/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("header logo link is at least 44x44", () => {
    expect(header).toContain("inline-flex min-h-11 items-center");
  });
});

describe("mobile menu panel and 44px text links", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("mobile nav panel scrolls inside a short viewport", () => {
    const header = read("src/components/layout/Header.tsx");
    expect(header).toMatch(/max-h-\[calc\(100dvh-4\.5rem\)\]/);
    expect(header).toContain("overflow-y-auto");
  });
  it.each([
    "src/app/[locale]/notices/[id]/page.tsx",
    "src/app/[locale]/agents/register/page.tsx",
    "src/components/cards/MemberCard.tsx",
    "src/components/home/HomeProfileCard.tsx",
  ])("%s text links reserve a 44px hit area", (file) => {
    expect(read(file)).toContain("inline-flex min-h-11 items-center");
  });
});
