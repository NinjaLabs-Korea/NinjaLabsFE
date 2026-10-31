import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, MEMBER_ROLE_LABELS, toCategoryLabel, toMemberRoleLabel } from "@/lib/api/codecs";
import { BOUNTY_CATEGORIES, isBountyCategory } from "@/lib/bounty-categories";
import { parseBountyFilters } from "@/lib/bounty-filter-params";
import { MEMBER_ROLES } from "@/lib/member-roles";

const LOCALES = ["en", "ko", "zh"] as const;
const messages = (locale: string, ns: string) => JSON.parse(readFileSync(`messages/${locale}/${ns}.json`, "utf8"));

function sourceFiles(dir = "src"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path.split(sep).includes("test") ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative(process.cwd(), path).split(sep).join("/")] : [];
  });
}

describe("bounty categories: one list (lib/bounty-categories.ts)", () => {
  it("keeps today's display order", () => {
    expect(BOUNTY_CATEGORIES).toEqual(["Dev", "Design", "Content", "Other"]);
  });

  it("is exactly the set the BE codec maps to", () => {
    expect(Object.values(CATEGORY_LABELS)).toEqual([...BOUNTY_CATEGORIES]);
    expect(toCategoryLabel("DESIGN")).toBe("Design");
  });

  it("has a message for every category under the keys the views read", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(messages(locale, "bounties").categories)).toEqual([...BOUNTY_CATEGORIES]);
      expect(Object.keys(messages(locale, "admin").bounties.tags)).toEqual([...BOUNTY_CATEGORIES]);
      expect(Object.keys(messages(locale, "members").profile.categories)).toEqual(BOUNTY_CATEGORIES.map((category) => category.toLowerCase()));
    }
  });

  it("reads a URL category only when it is a known one", () => {
    expect(isBountyCategory("Content")).toBe(true);
    expect(isBountyCategory("content")).toBe(false);
    expect(parseBountyFilters("?category=Design").category).toBe("Design");
    expect(parseBountyFilters("?category=toString").category).toBe("All");
  });
});

describe("member roles: one list (lib/member-roles.ts)", () => {
  it("keeps today's display order and matches the BE codec", () => {
    expect(MEMBER_ROLES).toEqual(["Core", "Dev", "Design", "Ops"]);
    expect(Object.values(MEMBER_ROLE_LABELS)).toEqual([...MEMBER_ROLES]);
    expect(toMemberRoleLabel("OPS")).toBe("Ops");
  });

  it("has a message for every role under the keys the views read", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(messages(locale, "members").roles)).toEqual(MEMBER_ROLES.map((role) => role.toLowerCase()));
      expect(Object.keys(messages(locale, "admin").users.roles)).toEqual([...MEMBER_ROLES]);
    }
  });
});

describe("no second copy of either list", () => {
  // A literal list (or union) of these labels outside the owning module is the duplication this guard removed.
  const patterns = [
    { owner: "src/lib/bounty-categories.ts", re: /["']Dev["']\s*[,|]\s*["']Design["']\s*[,|]\s*["']Content["']/ },
    { owner: "src/lib/member-roles.ts", re: /["']Core["']\s*[,|]\s*["']Dev["']\s*[,|]\s*["']Design["']/ },
  ];
  it.each(patterns)("only $owner spells the list", ({ owner, re }) => {
    const offenders = sourceFiles().filter((file) => file !== owner && re.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
