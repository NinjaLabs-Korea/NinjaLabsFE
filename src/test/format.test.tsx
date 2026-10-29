// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { createFormatter } from "use-intl/core";
import { describe, expect, it, vi } from "vitest";
import { RewardPill } from "@/components/ui/RewardPill";
import { toReward } from "@/lib/api/codecs";
import { formatTokenAmount, formatUtcDateTime } from "@/lib/format";
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

  it("renders a bounty without a reward row as Reward TBD, not 0 INJ", () => {
    // lib/bounties maps `rewards: []` to { amount: 0, currency: "INJ" }.
    const { container } = renderWithIntl(<RewardPill reward={{ amount: 0, currency: "INJ" }} />);
    expect(screen.getByText("Reward TBD")).toBeTruthy();
    expect(container.textContent).not.toContain("0 INJ");
    expect(container.querySelector("img")).toBeNull();
    const icon = renderWithIntl(<RewardPill reward={{ amount: 0, currency: "INJ" }} variant="icon" />);
    expect(icon.container.innerHTML).toBe("");
  });

  it("renders 1e23 wei INJ as 100,000 INJ", () => {
    const reward = toReward({ symbol: "INJ", amount: "100000000000000000000000" });
    expect(reward).toEqual({ amount: 100000, currency: "INJ" });
    renderWithIntl(<RewardPill reward={reward!} />);
    expect(screen.getByText("100,000 INJ")).toBeTruthy();
  });
});

describe("formatUtcDateTime", () => {
  it("formats in UTC with the zone label and no Intl formatting error, whatever the machine zone", () => {
    const onError = vi.fn();
    const format = createFormatter({ locale: "en", timeZone: "Asia/Seoul", onError });
    expect(formatUtcDateTime(format, "2027-01-25T16:23:47Z")).toBe("Jan 25, 2027, 4:23 PM UTC");
    expect(onError).not.toHaveBeenCalled();
  });
  it("localizes the text", () => {
    const format = createFormatter({ locale: "ko", timeZone: "Asia/Seoul" });
    expect(formatUtcDateTime(format, "2027-01-25T16:23:47Z")).toContain("UTC");
    expect(formatUtcDateTime(format, "2027-01-25T16:23:47Z")).toContain("2027");
  });
});
