import { describe, expect, it } from "vitest";
import {
  rewardFromBaseUnits,
  rewardToBaseUnits,
  toCategoryCode,
  toCategoryLabel,
  toMemberRoleCode,
  toMemberRoleLabel,
} from "@/lib/api/codecs";

describe("api codecs", () => {
  it("scales reward amounts by token decimals in both directions", () => {
    expect(rewardFromBaseUnits({ symbol: "USDC", amount: "300000000" })).toEqual({ amount: 300, currency: "USDC" });
    expect(rewardFromBaseUnits({ symbol: "INJ", amount: "500000000000000000000" })).toEqual({ amount: 500, currency: "INJ" });
    expect(rewardFromBaseUnits(undefined)).toEqual({ amount: 0, currency: "INJ" });
    expect(rewardToBaseUnits({ amount: 300, currency: "USDC" })).toBe("300000000");
    expect(rewardToBaseUnits({ amount: 1.5, currency: "INJ" })).toBe("1500000000000000000");
  });

  it("round-trips category and member role codes", () => {
    expect(toCategoryLabel("DESIGN")).toBe("Design");
    expect(toCategoryLabel("UNKNOWN")).toBeUndefined();
    expect(toCategoryCode("Content")).toBe("CONTENT");
    expect(toMemberRoleLabel("OPS")).toBe("Ops");
    expect(toMemberRoleCode("Core")).toBe("CORE");
    expect(toMemberRoleCode("Nope")).toBeUndefined();
  });
});
