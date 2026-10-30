import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fitOgHeadlineSize, fontFileUrlFromCss, loadOgFont, ogFontFamily } from "@/lib/og-font";

const CSS = `@font-face {
  font-family: 'Noto Sans KR';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/l/font?kit=abc) format('truetype');
}`;

afterEach(() => vi.unstubAllGlobals());

describe("Open Graph CJK font", () => {
  it("picks a font only for locales whose copy Satori's default font cannot draw", () => {
    expect([ogFontFamily("en"), ogFontFamily("ko"), ogFontFamily("zh")]).toEqual([null, "Noto Sans KR", "Noto Sans SC"]);
  });

  it("reads the font file URL out of the Google Fonts CSS", () => {
    expect(fontFileUrlFromCss(CSS)).toBe("https://fonts.gstatic.com/l/font?kit=abc");
    expect(fontFileUrlFromCss("/* no font */")).toBeNull();
  });

  it("does not touch the network for en", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadOgFont("en", "Ninja Labs")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests a subset of the printed glyphs and returns the font bytes", async () => {
    const bytes = new ArrayBuffer(8);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(CSS))
      .mockResolvedValueOnce(new Response(bytes));
    vi.stubGlobal("fetch", fetchMock);
    const font = await loadOgFont("ko", "바운티");
    expect(font?.name).toBe("Noto Sans KR");
    expect(font?.data.byteLength).toBe(8);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`text=${encodeURIComponent("바운티")}`);
  });

  it("falls back to the default font instead of failing the build when Google Fonts is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadOgFont("zh", "忍者")).toBeNull();
  });
});

describe("fitOgHeadlineSize", () => {
  const messages = (locale: string) => (JSON.parse(readFileSync(`messages/${locale}/common.json`, "utf8")) as { site: { og: { headline: string; highlight: string } } }).site.og;

  it("fits the Korean headline on one line per row (shrinking only when needed), and keeps zh near full size", () => {
    const ko = messages("ko");
    const size = fitOgHeadlineSize([ko.headline, ko.highlight], 1040, 72);
    expect(size).toBeLessThanOrEqual(72);
    // Every Korean syllable is roughly one em wide: the line must fit the width at that size.
    expect((ko.headline.match(/[가-힣]/g) ?? []).length * size).toBeLessThanOrEqual(1040);
    // zh lines are short: at most a slight shrink for the community-first headline copy.
    const zh = messages("zh");
    expect(fitOgHeadlineSize([zh.headline, zh.highlight], 1040, 72)).toBeGreaterThanOrEqual(64);
  });

  it("never returns less than a readable minimum", () => {
    expect(fitOgHeadlineSize(["가".repeat(200)], 1040, 72)).toBe(24);
  });
});
