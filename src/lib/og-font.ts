import type { Locale } from "@/i18n/routing";

/**
 * Open Graph images are drawn by Satori, whose built-in font has Latin glyphs only: Korean and Chinese copy would render
 * as empty boxes in every share preview. ko/zh therefore load a subset of Noto Sans from Google Fonts (only the glyphs
 * the card prints, via the CSS API's `text=` parameter) while the image is generated at build time. en keeps the default.
 */
const OG_FONT_FAMILY: Partial<Record<Locale, string>> = { ko: "Noto Sans KR", zh: "Noto Sans SC" };

const OG_FONT_TIMEOUT_MS = 5000;

/**
 * Largest headline size (px, at most `maxSize`) at which the longest line still fits `availableWidth` on ONE line. Satori breaks
 * CJK text between any two characters, so a 72px Korean headline wrapped mid-word and left an orphan "요." on its own line. A
 * full-width character is about one em wide, a Latin one about 0.55 em, a space 0.3 em; 8% is kept as slack because the
 * estimate is not font metrics.
 */
export function fitOgHeadlineSize(lines: readonly string[], availableWidth: number, maxSize: number): number {
  const emWidth = (line: string) =>
    [...line].reduce((sum, char) => sum + (char === " " ? 0.3 : /[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/u.test(char) ? 1 : 0.55), 0);
  const widest = Math.max(...lines.map(emWidth), 1);
  return Math.max(24, Math.min(maxSize, Math.floor((availableWidth * 0.92) / widest)));
}

export function ogFontFamily(locale: Locale): string | null {
  return OG_FONT_FAMILY[locale] ?? null;
}

/** The font file URL inside the CSS the Google Fonts API answers (`src: url(...) format('truetype')`), or null. */
export function fontFileUrlFromCss(css: string): string | null {
  return /src:\s*url\((https:\/\/[^)\s]+)\)\s*format\('(?:opentype|truetype)'\)/.exec(css)?.[1] ?? null;
}

/**
 * Bold subset font for `text`, or null when the locale needs none or Google Fonts is unreachable: a missing font only
 * degrades the card back to the default font, it never fails the build.
 */
export async function loadOgFont(locale: Locale, text: string): Promise<{ name: string; data: ArrayBuffer } | null> {
  const family = ogFontFamily(locale);
  if (!family) return null;
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@700&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(OG_FONT_TIMEOUT_MS) })).text();
    const fileUrl = fontFileUrlFromCss(css);
    if (!fileUrl) return null;
    const response = await fetch(fileUrl, { signal: AbortSignal.timeout(OG_FONT_TIMEOUT_MS) });
    return response.ok ? { name: family, data: await response.arrayBuffer() } : null;
  } catch {
    return null;
  }
}
