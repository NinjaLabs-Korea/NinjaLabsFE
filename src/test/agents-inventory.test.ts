import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AGENTS.md "Implemented component inventory" must name every file under src/components, like locale-routes.test pins the
 * route table. Failure means: add (or remove) the `dir/Name` line in AGENTS.md in the same change as the component, and
 * keep the "(N files; ...)" count in the section heading equal to the real number.
 */
const componentsDir = join(process.cwd(), "src/components");

function componentFiles(dir = componentsDir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? componentFiles(join(dir, entry.name)) : [relative(componentsDir, join(dir, entry.name)).split(sep).join("/")],
  );
}

/** The heading line plus the indented `  - ` bullets under it. */
function inventorySection(): { heading: string; body: string } {
  const lines = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8").split("\n");
  const start = lines.findIndex((line) => line.includes("Implemented component inventory"));
  expect(start, "AGENTS.md has no 'Implemented component inventory' heading").toBeGreaterThanOrEqual(0);
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith("  - ")) end++;
  return { heading: lines[start], body: lines.slice(start + 1, end).join("\n") };
}

describe("AGENTS.md component inventory", () => {
  const files = componentFiles();

  it("names every file under src/components as `dir/Name`", () => {
    const { body } = inventorySection();
    const missing = files.map((file) => file.replace(/\.[^.]+$/, "")).filter((name) => !body.includes(name));
    expect(missing, "add these to the AGENTS.md component inventory").toEqual([]);
  });

  it("states the real file count in its heading", () => {
    const { heading } = inventorySection();
    expect(Number(/\((\d+) files/.exec(heading)?.[1])).toBe(files.length);
  });
});
