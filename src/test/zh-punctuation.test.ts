import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Chinese copy uses full-width punctuation after a Chinese character: ， ； ： (not ASCII , ; :).
const ZH_FILES = readdirSync("messages/zh").filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, ""));
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
