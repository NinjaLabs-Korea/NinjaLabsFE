// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardPill } from "@/components/ui/RewardPill";
import { toReward } from "@/lib/api/codecs";
import { formatTokenAmount } from "@/lib/format";
import { renderWithIntl } from "@/test/intl";

describe("formatTokenAmount", () => {
  it("groups digits and never prints scientific notation", () => {
    expect(formatTokenAmount(150000, "en")).toBe("150,000");
    expect(formatTokenAmount(1e23, "en")).toBe("100,000,000,000,000,000,000,000");
    expect(formatTokenAmount(0.0000001, "en")).toBe("0");
    expect(formatTokenAmount(1.5, "en")).toBe("1.5");
    expect(formatTokenAmount("100000", "en")).toBe("100,000");
    expect(formatTokenAmount("1234.5678901", "en")).toBe("1,234.56789");
  });

  it("splits integer and fraction by hand when the decimal string is not a safe number", () => {
    expect(formatTokenAmount("123456789012345678901234567.123456789", "en")).toBe("123,456,789,012,345,678,901,234,567.123456");
    expect(formatTokenAmount("123456789012345678901234567.000", "en")).toBe("123,456,789,012,345,678,901,234,567");
    expect(formatTokenAmount("123456789012345678901234567,5", "en")).toBe("123456789012345678901234567,5");
  });
});

describe("RewardPill", () => {
  it("renders 150000 USDC as 150,000 USDC in English", () => {
    renderWithIntl(<RewardPill reward={{ amount: 150000, currency: "USDC" }} />);
    expect(screen.getByText("150,000 USDC")).toBeTruthy();
  });

  it("renders 1e23 wei INJ as 100,000 INJ", () => {
    const reward = toReward({ symbol: "INJ", amount: "100000000000000000000000" });
    expect(reward).toEqual({ amount: 100000, currency: "INJ" });
    renderWithIntl(<RewardPill reward={reward!} />);
    expect(screen.getByText("100,000 INJ")).toBeTruthy();
  });
});
