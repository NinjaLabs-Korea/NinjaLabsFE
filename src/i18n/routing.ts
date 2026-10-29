import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ko", "zh"],
  defaultLocale: "en",
  localePrefix: "always",
  // No `Link: <...>; rel="alternate"` response header: next-intl would list `zh` (not the `zh-CN` that `i18n/alternates.ts` puts in
  // the page head and the sitemap) and an `x-default` pointing at an unprefixed URL that only redirects. Two conflicting hreflang
  // sets are worse than one: the head and the sitemap are the single source.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

/** Native names shown in the language switcher. */
export const localeLabels: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  zh: "中文",
};

/** BCP 47 tags for <html lang> and Open Graph locale. */
export const localeTags: Record<Locale, { htmlLang: string; ogLocale: string }> = {
  en: { htmlLang: "en", ogLocale: "en_US" },
  ko: { htmlLang: "ko", ogLocale: "ko_KR" },
  zh: { htmlLang: "zh-CN", ogLocale: "zh_CN" },
};

/** Strips a leading locale segment: "/ko/signup/wallet" -> "/signup/wallet". */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if ((routing.locales as readonly string[]).includes(first ?? "")) {
    return `/${rest.join("/")}`;
  }
  return pathname;
}

/** Prefixes `path` with the locale found in `currentPathname`, if any. */
export function withLocaleOf(currentPathname: string, path: string): string {
  const first = currentPathname.split("/")[1] ?? "";
  return (routing.locales as readonly string[]).includes(first) ? `/${first}${path}` : path;
}
