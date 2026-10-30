import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The recruitment page uses the shared page gutter (`px-gutter`: 16px on phones, 24px from sm), not its own px-6.
describe("recruit page gutter", () => {
  const src = readFileSync(join(process.cwd(), "src/components/recruit/RecruitView.tsx"), "utf8");
  const wrappers = src.split("\n").filter((line) => line.includes("max-w-content"));

  it("has three max-w-content wrappers (cohort card, reserved slot, application area)", () => {
    expect(wrappers).toHaveLength(3);
  });

  it("puts px-gutter on every one of them and no hard-coded horizontal padding", () => {
    for (const line of wrappers) {
      expect(line).toContain("px-gutter");
      expect(line).not.toMatch(/\bpx-(4|6)\b/);
    }
  });
});
