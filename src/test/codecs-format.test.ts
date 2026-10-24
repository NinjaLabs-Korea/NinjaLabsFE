import { describe, expect, it } from "vitest";
import {
  formatIsoDate,
  rewardFromBaseUnits,
  rewardToBaseUnits,
  toCategoryCode,
  toHighlightTypeCode,
  toHighlightTypeLabel,
  toMemberRoleCode,
  toNoticeCategoryCode,
  toNoticeCategoryLabel,
  toReward,
  CATEGORY_LABELS,
  HIGHLIGHT_TYPE_LABELS,
  MEMBER_ROLE_LABELS,
  NOTICE_CATEGORY_LABELS,
} from "@/lib/api/codecs";
import { formatTokenAmount } from "@/lib/format";

describe("reward base units", () => {
  it.each([
    [{ amount: 1.5, currency: "INJ" }, "1500000000000000000"],
    [{ amount: 250, currency: "USDC" }, "250000000"],
    [{ amount: 0.000001, currency: "USDC" }, "1"],
    [{ amount: 1234.5678901, currency: "USDC" }, "1234567890"],
  ] as const)("%o -> %s", (reward, expected) => {
    expect(rewardToBaseUnits(reward)).toBe(expected);
  });

  it("round-trips display amounts through the BE base-unit string", () => {
    for (const reward of [{ amount: 0.5, currency: "INJ" }, { amount: 99.99, currency: "USDC" }] as const) {
      expect(toReward({ symbol: reward.currency, amount: rewardToBaseUnits(reward) })).toEqual(reward);
    }
  });

  it("reads the symbol case-insensitively and falls back to 0 INJ only when nothing is displayable", () => {
    expect(toReward({ symbol: "usdc", amount: "1000000" })).toEqual({ amount: 1, currency: "USDC" });
    expect(rewardFromBaseUnits(undefined)).toEqual({ amount: 0, currency: "INJ" });
    expect(rewardFromBaseUnits({ symbol: "ATOM", amount: "1" })).toEqual({ amount: 0, currency: "INJ" });
    expect(rewardFromBaseUnits({ symbol: "USDC", amount: "1e6" })).toEqual({ amount: 0, currency: "INJ" });
  });
});

describe("code tables round-trip", () => {
  it("maps every label back to its own code", () => {
    for (const [code, label] of Object.entries(CATEGORY_LABELS)) expect(toCategoryCode(label)).toBe(code);
    for (const [code, label] of Object.entries(MEMBER_ROLE_LABELS)) expect(toMemberRoleCode(label)).toBe(code);
    for (const [code, label] of Object.entries(NOTICE_CATEGORY_LABELS)) {
      expect(toNoticeCategoryCode(label)).toBe(code);
      expect(toNoticeCategoryLabel(code)).toBe(label);
    }
    for (const [code, label] of Object.entries(HIGHLIGHT_TYPE_LABELS)) {
      expect(toHighlightTypeCode(label)).toBe(code);
      expect(toHighlightTypeLabel(code)).toBe(label);
    }
  });

  it("is case-sensitive about BE codes (a lower-case code is unknown, not silently matched)", () => {
    expect(toNoticeCategoryLabel("event")).toBeUndefined();
    expect(toMemberRoleCode("core")).toBeUndefined();
    expect(toHighlightTypeLabel("award")).toBeUndefined();
  });
});

describe("formatIsoDate", () => {
  it.each([
    ["2026-07-01T23:30:00-05:00", "2026-07-02"],
    ["2026-07-01T00:30:00+09:00", "2026-06-30"],
    ["2026-07-01", "2026-07-01"],
    ["yesterday", ""],
  ])("%s -> %p", (value, expected) => {
    expect(formatIsoDate(value)).toBe(expected);
  });
});

describe("formatTokenAmount", () => {
  it.each([
    [1234.5, "en", "1,234.5"],
    [1234.5, "ko", "1,234.5"],
    [0.1234567, "en", "0.123457"],
    ["1234567890123456789.123456789", "en", "1,234,567,890,123,456,789.123456"],
    ["-1234567890123456789.5", "en", "-1,234,567,890,123,456,789.5"],
    ["1234567890123456789.000", "en", "1,234,567,890,123,456,789"],
    ["0001234567890123456", "en", "1,234,567,890,123,456"],
    ["1234567890123456789.5", "de", "1.234.567.890.123.456.789,5"],
    [" 42.10 ", "en", "42.1"],
  ] as const)("%p in %s -> %s", (amount, locale, expected) => {
    expect(formatTokenAmount(amount, locale)).toBe(expected);
  });

  it("returns a non-decimal string untouched instead of printing NaN", () => {
    expect(formatTokenAmount("abc", "en")).toBe("abc");
    expect(formatTokenAmount("1e5", "en")).toBe("1e5");
  });

  it("honours a smaller fraction budget", () => {
    expect(formatTokenAmount("1234567890123456789.987654", "en", 2)).toBe("1,234,567,890,123,456,789.98");
    expect(formatTokenAmount(1.987654, "en", 2)).toBe("1.99");
  });
});
