import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function strings(node: unknown, path: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof node === "string") out.push([path, node]);
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) strings(value, path ? `${path}.${key}` : key, out);
  return out;
}

// Hedged particles ("이(가)") are what you write when the next word is a variable. Put a fixed noun after the variable
// instead ("에이전트 {name}의 ..."). admin.json is operator-only copy owned by the admin pages and is not scanned yet.
const HEDGED_PARTICLES = /(이\(가\)|을\(를\)|\(으\)로|와\(과\)|은\(는\))/;
const files = readdirSync("messages/ko").filter((name) => name.endsWith(".json") && name !== "admin.json");
const load = (file: string) => strings(JSON.parse(readFileSync(`messages/ko/${file}`, "utf8")), file);

describe("ko copy particles", () => {
  it.each(files)("%s has no hedged particle placeholders", (file) => {
    expect(load(file).filter(([, text]) => HEDGED_PARTICLES.test(text))).toEqual([]);
  });

  it.each(["bounties.json", "account.json"])("%s does not expose the 'Agent API' term to members", (file) => {
    expect(load(file).filter(([, text]) => text.includes("Agent API"))).toEqual([]);
  });
});
