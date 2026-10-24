import { describe, expect, it } from "vitest";
import { localeAlternates } from "@/i18n/alternates";

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
