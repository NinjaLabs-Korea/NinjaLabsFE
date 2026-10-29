import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (locale: string, file: string) => JSON.parse(readFileSync(`messages/${locale}/${file}.json`, "utf8"));

// The detail layouts (bounty, member, notice) give their own 404 a title; it must be the same wording as every other 404 page.
describe("404 titles", () => {
  it.each(["en", "ko", "zh"])("the detail 404 titles equal the generic page-not-found title in %s", (locale) => {
    const generic = read(locale, "common").notFound.metaTitle;
    expect(read(locale, "bounties").meta.notFound).toBe(generic);
    expect(read(locale, "notices").detail.notFoundTitle).toBe(generic);
    expect(read(locale, "members").profile.notFoundTitle).toBe(generic);
  });
});
