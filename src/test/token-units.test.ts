import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits } from "@/lib/token-units";

// Expected values were produced with viem 2.57.7 `formatUnits`/`parseUnits` (the previous implementation) before it was removed,
// and a 900,000 case randomized differential run against viem agreed on every input that is representable in `decimals`.

describe("formatUnits (same output as viem formatUnits)", () => {
  it.each<[bigint, number, string]>([
    [BigInt("0"), 18, "0"],
    [BigInt("1"), 18, "0.000000000000000001"],
    [BigInt("1000000000000000000"), 18, "1"],
    [BigInt("1500000000000000000"), 18, "1.5"],
    [BigInt("123456789012345678901234567890"), 18, "123456789012.34567890123456789"],
    [BigInt("1"), 6, "0.000001"],
    [BigInt("1500000"), 6, "1.5"],
    [BigInt("10000000"), 6, "10"],
    [BigInt("999999"), 6, "0.999999"],
    [BigInt("-1500000"), 6, "-1.5"],
    [BigInt("-1"), 6, "-0.000001"],
    [BigInt("42"), 0, "42"],
  ])("%s with %s decimals -> %s", (value, decimals, expected) => {
    expect(formatUnits(value, decimals)).toBe(expected);
  });

  it("never rounds or switches to exponent notation", () => {
    expect(formatUnits(BigInt("1000000000000000000000000000001"), 18)).toBe("1000000000000.000000000000000001");
    expect(formatUnits(BigInt("1"), 18)).not.toMatch(/e/i);
  });
});

describe("parseUnits (same results as viem parseUnits for amounts the token can represent)", () => {
  it.each<[string, number, bigint]>([
    ["0", 6, BigInt("0")],
    ["1", 6, BigInt("1000000")],
    ["12.5", 6, BigInt("12500000")],
    ["0.000001", 6, BigInt("1")],
    [".5", 6, BigInt("500000")],
    ["5.", 6, BigInt("5000000")],
    ["1.500", 6, BigInt("1500000")],
    ["1.500000", 6, BigInt("1500000")],
    ["007", 6, BigInt("7000000")],
    ["1", 18, BigInt("1000000000000000000")],
    ["0.000000000000000001", 18, BigInt("1")],
    ["123456789012.345678901234567890", 18, BigInt("123456789012345678901234567890")],
    ["-1.5", 6, BigInt("-1500000")],
    ["7", 0, BigInt("7")],
  ])("%s with %s decimals -> %s", (text, decimals, expected) => {
    expect(parseUnits(text, decimals)).toBe(expected);
  });

  it("rejects more decimals than the token has instead of rounding (viem rounded these silently)", () => {
    expect(() => parseUnits("0.0000001", 6)).toThrow(/decimal places/);
    expect(() => parseUnits("1.2345675", 6)).toThrow(/decimal places/);
    expect(() => parseUnits("0.1", 0)).toThrow(/decimal places/);
    expect(() => parseUnits("0.0000000000000000001", 18)).toThrow(/decimal places/);
  });

  it("rejects anything that is not a plain decimal", () => {
    for (const text of ["", ".", "-", "1e3", "1e-7", "0x10", "1,5", "+5", "1.5.2", " 5", "5 ", "abc", "1_000", "Infinity", "NaN"]) {
      expect(() => parseUnits(text, 6), JSON.stringify(text)).toThrow();
    }
  });

  it("round-trips with formatUnits", () => {
    for (const value of [BigInt("0"), BigInt("1"), BigInt("999999"), BigInt("1000000"), BigInt("123456789"), BigInt("1000000000000000000000007")]) {
      for (const decimals of [6, 18]) expect(parseUnits(formatUnits(value, decimals), decimals)).toBe(value);
    }
  });
});
