import { describe, expect, it } from "vitest";
import { localeAlternates, localeMetadata } from "@/i18n/alternates";

describe("localeAlternates", () => {
  it("makes the page's own localized URL canonical and lists every locale", () => {
    expect(localeAlternates("ko", "/bounties/x")).toEqual({
      canonical: "/ko/bounties/x",
      languages: { en: "/en/bounties/x", ko: "/ko/bounties/x", "zh-CN": "/zh/bounties/x" },
    });
  });

  it("uses /<locale> for the home page", () => {
    expect(localeAlternates("en", "/")).toEqual({ canonical: "/en", languages: { en: "/en", ko: "/ko", "zh-CN": "/zh" } });
  });
});

describe("localeMetadata", () => {
  it("keeps og:url, og:locale and the twitter copy on the page, not the locale home", () => {
    const metadata = localeMetadata("ko", "/notices", { title: "공지", description: "소식" });
    expect(metadata.alternates?.canonical).toBe("/ko/notices");
    expect(metadata.openGraph).toMatchObject({ title: "공지", description: "소식", siteName: "Ninja Labs", type: "website", locale: "ko_KR", url: "/ko/notices" });
    expect(metadata.twitter).toMatchObject({ title: "공지", description: "소식" });
  });

  it("falls back to the default locale's tags for an unknown locale", () => {
    expect(localeMetadata("xx", "/", { title: "t" }).openGraph).toMatchObject({ locale: "en_US", url: "/xx" });
  });
});
