import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// One mobile gutter: px-6 (24px) at every width, matching Header and Footer.
const owned = [
  "src/components/community/AboutSection.tsx",
  "src/components/community/AchievementsSection.tsx",
  "src/components/community/ActivitiesSection.tsx",
  "src/components/community/BountiesEntrySection.tsx",
  "src/components/community/MembersPreviewSection.tsx",
  "src/components/community/UpcomingEventsSection.tsx",
  "src/components/ui/HeroSurface.tsx",
  "src/app/[locale]/home/page.tsx",
  "src/components/home/HomeActivity.tsx",
  "src/components/home/HomeProfileCard.tsx",
  "src/components/home/HomeQuickLinks.tsx",
];

describe("mobile gutter", () => {
  it.each(owned)("%s has no 16px mobile gutter on a max-w-content wrapper", (file) => {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    const bad = src.split("\n").filter((l) => l.includes("max-w-content") && /\bpx-4\b/.test(l));
    expect(bad).toEqual([]);
  });
});

describe("mobile tap targets", () => {
  const footer = readFileSync(join(process.cwd(), "src/components/layout/Footer.tsx"), "utf8");
  const header = readFileSync(join(process.cwd(), "src/components/layout/Header.tsx"), "utf8");
  it("footer links reserve a 40px mobile hit area", () => {
    expect(footer.match(/inline-flex min-h-10 items-center sm:min-h-0/g)?.length).toBeGreaterThanOrEqual(5);
  });
  it("header logo link is at least 44x44", () => {
    expect(header).toContain("inline-flex min-h-11 items-center");
  });
});
