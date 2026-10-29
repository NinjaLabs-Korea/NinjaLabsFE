// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardPill } from "@/components/ui/RewardPill";
import { renderWithIntl } from "@/test/intl";

describe("RewardPill amount", () => {
  it("shows a funded dust reward as '<0.000001', never '0'", () => {
    renderWithIntl(<RewardPill reward={{ amount: 1e-18, currency: "INJ" }} />);
    expect(screen.getByText("<0.000001 INJ")).toBeTruthy();
  });

  it("keeps the usual rounding for normal amounts and 'Reward TBD' for none", () => {
    renderWithIntl(<RewardPill reward={{ amount: 1234.5678912, currency: "USDC" }} />);
    expect(screen.getByText("1,234.567891 USDC")).toBeTruthy();
    renderWithIntl(<RewardPill reward={{ amount: 0.000001, currency: "INJ" }} />);
    expect(screen.getByText("0.000001 INJ")).toBeTruthy();
    renderWithIntl(<RewardPill reward={{ amount: 0, currency: "INJ" }} />);
    expect(screen.getByText("Reward TBD")).toBeTruthy();
  });
});
