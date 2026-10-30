import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const ALLOWED = join("components", "layout", "fonts.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("next/font single instance", () => {
  it("imports next/font/google only in components/layout/fonts.ts", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("next/font/google"))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([ALLOWED]);
  });
});
