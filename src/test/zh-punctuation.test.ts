import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Chinese copy uses full-width punctuation after a Chinese character: ， ； ： (not ASCII , ; :).
// landing.json and community.json are left out for now because FE-U1 fixes them in parallel;
// the next round removes this exclusion so every zh file is covered.
const ZH_FILES = [
  "account",
  "admin",
  "agents",
  "bounties",
  "common",
  "hallOfFame",
  "home",
  "legal",
  "members",
  "notices",
  "recruit",
  "signup",
];
const ASCII_AFTER_CJK = /[一-鿿][,;:]/;

function* values(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") yield [path, node];
  else if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) yield* values(child, path ? `${path}.${key}` : key);
}

describe("zh full-width punctuation", () => {
  it.each(ZH_FILES)("%s.json has no ASCII , ; : right after a Chinese character", (file) => {
    const messages: unknown = JSON.parse(readFileSync(`messages/zh/${file}.json`, "utf8"));
    const offenders = [...values(messages)].filter(([, value]) => ASCII_AFTER_CJK.test(value)).map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
