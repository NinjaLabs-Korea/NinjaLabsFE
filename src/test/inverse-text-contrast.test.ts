import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WCAG 1.4.3: copy on the hero gradient (#0C1528 -> #1D2B60 -> #4D3DFF) is white at some opacity. Toward the blue end,
// white at 50-60% drops under 4.5:1 (about 3.2:1 at 50% over the stacked mobile card), so body-size text on the
// gradient panels (landing hero, public profile portfolio) uses at least 70%. Decorative borders/backgrounds may stay lighter.
const MIN_TEXT_OPACITY = 70;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

describe("text on the inverse gradient", () => {
  it("never drops below the minimum white opacity", () => {
    const offenders = sources(new URL("..", import.meta.url).pathname).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/(?<![\w:-])text-on-inverse\/(\d+)/g)]
        .filter(([, opacity]) => Number(opacity) < MIN_TEXT_OPACITY)
        .map(([match]) => `${file}: ${match}`),
    );
    expect(offenders).toEqual([]);
  });
});
