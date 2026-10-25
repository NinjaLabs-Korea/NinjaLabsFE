import { afterEach, describe, expect, it, vi } from "vitest";

import { fontFileUrlFromCss, loadOgFont, ogFontFamily } from "@/lib/og-font";

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
