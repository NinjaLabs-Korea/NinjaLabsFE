import { describe, expect, it, vi } from "vitest";
import {
  formatIsoDate,
  rewardFromBaseUnits,
  rewardToBaseUnits,
  safeHttpUrl,
  toCategoryCode,
  toCategoryLabel,
  toHighlightTypeCode,
  toHighlightTypeLabel,
  toMemberRoleCode,
  toMemberRoleLabel,
  toNoticeCategoryCode,
  toNoticeCategoryLabel,
  toPayoutStatus,
} from "@/lib/api/codecs";

describe("api codecs", () => {
  it("scales reward amounts by token decimals in both directions", () => {
    expect(rewardFromBaseUnits({ symbol: "USDC", amount: "300000000" })).toEqual({ amount: 300, currency: "USDC" });
    expect(rewardFromBaseUnits({ symbol: "INJ", amount: "500000000000000000000" })).toEqual({ amount: 500, currency: "INJ" });
    expect(rewardFromBaseUnits(undefined)).toEqual({ amount: 0, currency: "INJ" });
    expect(rewardToBaseUnits({ amount: 300, currency: "USDC" })).toBe("300000000");
    expect(rewardToBaseUnits({ amount: 1.5, currency: "INJ" })).toBe("1500000000000000000");
  });

  it("formats ISO dates as UTC YYYY-MM-DD and returns an empty string for unparseable input", () => {
    expect(formatIsoDate("2026-06-20T23:30:00Z")).toBe("2026-06-20");
    expect(formatIsoDate("2026-06-20T23:30:00+09:00")).toBe("2026-06-20");
    expect(formatIsoDate("not-a-date")).toBe("");
    expect(formatIsoDate("")).toBe("");
    expect(formatIsoDate(null)).toBe("");
    expect(formatIsoDate(undefined)).toBe("");
  });

  it("accepts only http(s) absolute URLs and same-origin paths for admin-entered links and images", () => {
    expect(safeHttpUrl("https://injective.com")).toBe("https://injective.com");
    expect(safeHttpUrl("http://example.test/a?b=1#c")).toBe("http://example.test/a?b=1#c");
    expect(safeHttpUrl("/media/injective.png")).toBe("/media/injective.png");
    expect(safeHttpUrl("HTTP://x")).toBe("HTTP://x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("vbscript:x")).toBeNull();
    expect(safeHttpUrl("//evil.test/x")).toBeNull();
    expect(safeHttpUrl("/\\evil.test/x")).toBeNull();
    expect(safeHttpUrl("evil.test")).toBeNull();
    // Scheme without the authority marker parses as absolute but is a relative path in a browser.
    expect(safeHttpUrl("https:evil.test")).toBeNull();
    expect(safeHttpUrl("http:/evil.test")).toBeNull();
    // Whitespace/control characters and backslashes are rejected before parsing rather than normalized away.
    expect(safeHttpUrl("  /notices  ")).toBeNull();
    expect(safeHttpUrl(" https://x")).toBeNull();
    expect(safeHttpUrl("/\t/evil.com")).toBeNull();
    expect(safeHttpUrl("/\n/evil.com")).toBeNull();
    expect(safeHttpUrl("/\t\\evil.com")).toBeNull();
    expect(safeHttpUrl("https://x/a\u0000b")).toBeNull();
    expect(safeHttpUrl("https://x/a\\b")).toBeNull();
    expect(safeHttpUrl("/.//evil.com")).toBeNull();
    expect(safeHttpUrl("/..//evil.com")).toBeNull();
    expect(safeHttpUrl("/media/.hidden.png")).toBe("/media/.hidden.png");
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });

  it("round-trips category and member role codes", () => {
    expect(toCategoryLabel("DESIGN")).toBe("Design");
    expect(toCategoryLabel("UNKNOWN")).toBeUndefined();
    expect(toCategoryCode("Content")).toBe("CONTENT");
    expect(toMemberRoleLabel("OPS")).toBe("Ops");
    expect(toMemberRoleCode("Core")).toBe("CORE");
    expect(toMemberRoleCode("Nope")).toBeUndefined();
  });

  it("round-trips notice category and highlight type codes", () => {
    expect(toNoticeCategoryLabel("INJECTIVE_ECOSYSTEM")).toBe("Injective ecosystem");
    expect(toNoticeCategoryLabel("EVENT")).toBe("Events");
    expect(toNoticeCategoryLabel("UNKNOWN")).toBeUndefined();
    expect(toNoticeCategoryCode("Ninja Labs")).toBe("NINJALABS");
    expect(toNoticeCategoryCode("Recruitment")).toBe("RECRUITMENT");
    expect(toHighlightTypeLabel("FEATURED_BOUNTY")).toBe("Featured bounty");
    expect(toHighlightTypeLabel("UNKNOWN")).toBeUndefined();
    expect(toHighlightTypeCode("Partnership")).toBe("PARTNERSHIP");
  });
});

describe("imageProps", () => {
  it("optimizes same-origin paths and configured prefixes; everything else renders unoptimized", async () => {
    vi.stubEnv("NINJA_OPTIMIZED_IMAGE_PREFIXES", "https://api.example/media/,https://app.example/");
    vi.resetModules();
    const { imageProps } = await import("@/lib/image");
    expect(imageProps("/media/x.png")).toEqual({ src: "/media/x.png" });
    expect(imageProps("/media/x.png?v=1")).toEqual({ src: "/media/x.png?v=1", unoptimized: true });
    expect(imageProps("https://api.example/media/x.png")).toEqual({ src: "https://api.example/media/x.png" });
    expect(imageProps("https://api.example/other.png")).toEqual({ src: "https://api.example/other.png", unoptimized: true });
    expect(imageProps("https://app.example/figma/logo.png")).toEqual({ src: "https://app.example/figma/logo.png" });
    expect(imageProps("https://cdn.example/x.png")).toEqual({ src: "https://cdn.example/x.png", unoptimized: true });
    vi.unstubAllEnvs();
  });
});

describe("label lookups ignore inherited Object.prototype keys", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("%s is an unknown code everywhere", async (key) => {
    const codecs = await import("@/lib/api/codecs");
    const { highlightTypeLabelKey } = await import("@/lib/admin-helpers");
    expect(codecs.toCategoryLabel(key)).toBeUndefined();
    expect(codecs.toMemberRoleLabel(key)).toBeUndefined();
    expect(codecs.toMemberRoleCode(key)).toBeUndefined();
    expect(codecs.toNoticeCategoryLabel(key)).toBeUndefined();
    expect(codecs.isHighlightTypeCode(key)).toBe(false);
    expect(codecs.toHighlightTypeLabel(key)).toBeUndefined();
    expect(highlightTypeLabelKey(key)).toBeNull();
    expect(codecs.toReward({ symbol: key, amount: "1" })).toBeNull();
  });

  it("still maps the known codes", async () => {
    const codecs = await import("@/lib/api/codecs");
    const { highlightTypeLabelKey } = await import("@/lib/admin-helpers");
    expect(codecs.toCategoryLabel("DEV")).toBe("Dev");
    expect(codecs.toMemberRoleLabel("CORE")).toBe("Core");
    expect(codecs.toMemberRoleCode("Ops")).toBe("OPS");
    expect(codecs.toNoticeCategoryLabel("EVENT")).toBe("Events");
    expect(codecs.toHighlightTypeLabel("AWARD")).toBe("Award");
    expect(highlightTypeLabelKey("FEATURED_BOUNTY")).toBe("featuredBounty");
  });
});

describe("toPayoutStatus", () => {
  it.each([
    ["PAID", "PAID"], ["PARTIALLY_PAID", "PARTIALLY_PAID"], ["PENDING", "PENDING"], ["NONE", "NONE"],
    ["REFUNDED", "PENDING"], ["paid", "PENDING"], [42, "PENDING"], [null, undefined], [undefined, undefined],
  ])("%p -> %p (unknown → PENDING, missing → undefined)", (value, expected) => {
    expect(toPayoutStatus(value)).toBe(expected);
  });
});
