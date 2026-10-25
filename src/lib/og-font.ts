import type { Locale } from "@/i18n/routing";

/**
 * Open Graph images are drawn by Satori, whose built-in font has Latin glyphs only: Korean and Chinese copy would render
 * as empty boxes in every share preview. ko/zh therefore load a subset of Noto Sans from Google Fonts (only the glyphs
 * the card prints, via the CSS API's `text=` parameter) while the image is generated at build time. en keeps the default.
 */
const OG_FONT_FAMILY: Partial<Record<Locale, string>> = { ko: "Noto Sans KR", zh: "Noto Sans SC" };

const OG_FONT_TIMEOUT_MS = 5000;

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
