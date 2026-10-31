import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two components (or class recipes) exported under one name from different folders were a catalog pitfall: an editor's
 * auto-import picked the wrong `SignedOutPanel` / `inputClass`. Every value exported from `src/components` has one owner;
 * a second one gets a name that says where it belongs (`BountySignedOutPanel`, `bountyInputClass`, `questionInputClass`).
 */
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

describe("src/components exported names", () => {
  it("are unique across files", () => {
    const owners = new Map<string, string[]>();
    for (const file of files(join(process.cwd(), "src/components"))) {
      for (const [, name] of readFileSync(file, "utf8").matchAll(/^export (?:async )?(?:function|const|class) ([A-Za-z_$][\w$]*)/gm)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    expect([...owners].filter(([, where]) => where.length > 1)).toEqual([]);
  });
});
