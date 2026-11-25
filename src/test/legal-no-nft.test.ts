import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const locales = ["ko", "en", "zh"] as const;
const load = (locale: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "messages", locale, "legal.json"), "utf8"));

function flatten(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value as object);
  return Object.assign({}, ...entries.map(([k, v]) => flatten(v, path ? `${path}.${k}` : String(k))));
}

describe("legal copy", () => {
  it("does not mention removed NFT or agent features", () => {
    for (const locale of locales) {
      for (const [key, text] of Object.entries(flatten(load(locale)))) {
        expect(text, `${locale}:${key}`).not.toMatch(/nft|NFT|agent|에이전트|代理/);
      }
    }
  });

  it("keeps identical key sets across locales", () => {
    const keys = (l: string) => Object.keys(flatten(load(l))).sort();
    expect(keys("en")).toEqual(keys("ko"));
    expect(keys("zh")).toEqual(keys("ko"));
  });
});
