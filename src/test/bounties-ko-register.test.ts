import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ko = JSON.parse(readFileSync("messages/ko/bounties.json", "utf8")) as Record<string, unknown>;

function strings(node: unknown, path: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof node === "string") out.push([path, node]);
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) strings(value, path ? `${path}.${key}` : key, out);
  return out;
}

// meta.notFound and meta.unavailable must equal common.notFound.metaTitle (not-found-titles.test.ts), which is owned elsewhere.
const FORMAL_EXCEPTIONS = new Set(["meta.notFound", "meta.unavailable"]);

describe("ko bounties copy register", () => {
  it("is haeyo-che: no formal -sumnida endings except the listed exceptions", () => {
    const formal = strings(ko, "").filter(([path, text]) => !FORMAL_EXCEPTIONS.has(path) && /(습니다|합니다|입니다|됩니다)/.test(text));
    expect(formal).toEqual([]);
  });

  it("keeps retry phrasing polite ('다시 시도해 주세요'), never a bare '시도하세요'", () => {
    expect(strings(ko, "").filter(([, text]) => text.includes("시도하세요"))).toEqual([]);
  });

  it("avoids jargon: no 릴리스 or 자식 NFT in member-facing copy", () => {
    expect(strings(ko, "").filter(([, text]) => /릴리스|자식|부모/.test(text))).toEqual([]);
  });
});
