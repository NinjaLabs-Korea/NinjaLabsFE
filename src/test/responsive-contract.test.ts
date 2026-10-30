import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(process.cwd(), "src");

function sourceFiles(dir = srcDir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/** Every class list in the source: `className="..."` and the static head of a `className={`...`}` template. */
function classLists(source: string): string[] {
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`$]*))/g)].map((match) => match[1] ?? match[2] ?? "");
}

describe("responsive layout contract", () => {
  // `grid` without a base `grid-cols-N` has one implicit `auto` column that is as wide as its widest item's min-content:
  // a long URL, nickname or agent name then stretches the whole page past the viewport (Hall of Fame timeline,
  // public profile, /agents). `grid-cols-1` makes the column `minmax(0, 1fr)`.
  it("gives every grid that turns into columns at a breakpoint a base grid-cols-N", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      for (const classes of classLists(readFileSync(file, "utf8"))) {
        const tokens = classes.split(/\s+/);
        const responsiveColumns = tokens.some((token) => /^(sm|md|lg|xl|2xl):grid-cols-/.test(token));
        const baseColumns = tokens.some((token) => /^grid-cols-/.test(token));
        if (tokens.includes("grid") && responsiveColumns && !baseColumns) offenders.push(`${file.replace(srcDir, "src")}: ${classes}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("makes Korean wrap between words and every block wrap unbroken runs", () => {
    const css = readFileSync(join(srcDir, "app/globals.css"), "utf8");
    expect(css).toMatch(/html:lang\(ko\)\s*\{[^}]*word-break:\s*keep-all/);
    expect(css).toMatch(/body\s*\{[^}]*overflow-wrap:\s*break-word/);
  });

  // The header (6 nav links + locale + Browse + user menu) does not fit 768px in English: it switches at xl, and the
  // mobile menu, the desktop nav, the user menu and the footer columns must all agree on that breakpoint.
  it("switches the header between the mobile menu and the desktop nav at one shared breakpoint", async () => {
    const read = (path: string) => readFileSync(join(srcDir, path), "utf8");
    const constants = await import("@/components/layout/nav-breakpoint");
    const prefixes = Object.values(constants).map((value) => {
      const match = value.match(/\b(sm|md|lg|xl|2xl):/);
      expect(match, value).not.toBeNull();
      return match![1];
    });
    expect(new Set(prefixes).size).toBe(1);
    for (const file of ["Header", "MobileMenu", "AuthArea"]) {
      const source = read(`components/layout/${file}.tsx`);
      expect(source, file).toContain('from "@/components/layout/nav-breakpoint"');
      expect(source, file).not.toMatch(/\b(sm|md|lg|xl|2xl):(flex|block|inline-block|hidden)\b/);
    }
  });

  // Touch targets: 44px on phones. Source-level pin; the rendered height is measured in integration flow 14.
  it("keeps the phone tap targets of the mobile menu, notice chips, recruit chips and footer legal links at 44px", () => {
    const read = (path: string) => readFileSync(join(srcDir, path), "utf8");
    expect(read("components/layout/NavLinks.tsx")).toContain("rounded-control px-3 py-3 text-sm");
    expect(read("components/notices/NoticeFilters.tsx")).not.toContain("max-sm:min-h-10");
    expect(read("components/notices/NoticeFilters.tsx")).toContain("max-sm:min-h-11");
    expect(read("components/recruit/ChoiceChip.tsx")).toContain("max-sm:min-h-11");
    expect(read("components/layout/useMenuButton.ts")).toContain("min-h-11");
    const authArea = read("components/layout/AuthArea.tsx");
    expect(authArea.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
    const footer = read("components/layout/Footer.tsx");
    for (const href of ["/privacy", "/terms"]) expect(footer).toMatch(new RegExp(`max-sm:min-h-11[^"]*" href="${href}"`));
  });
});
