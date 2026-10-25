// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { BountyCard } from "@/components/cards/BountyCard";
import type { Bounty } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const base: Bounty = {
  slug: "b", title: "Widget", summary: "Build it", category: "Dev", status: "active", reward: { amount: 5, currency: "INJ" },
  sponsor: "Injective", deadline: "Open", daysLeft: 3, coverImage: "",
};

describe("BountyCard status presentation", () => {
  it("shows the countdown for an open bounty", () => {
    renderWithIntl(<BountyCard bounty={base} />);
    expect(screen.getByText("Dev")).toBeTruthy();
    expect(screen.getByText(/3 days left/)).toBeTruthy();
    expect(screen.queryByText("Closed")).toBeNull();
  });

  it("presents a closed bounty (including a BE OPEN row past its deadline) with the Closed badge and no countdown", () => {
    // What `toBounty` produces for OPEN + past/unparseable submission_deadline: status closed, "Closed" sentinel, no daysLeft.
    renderWithIntl(<BountyCard bounty={{ ...base, status: "closed", deadline: "Closed", daysLeft: undefined }} />);
    // Badge plus the footer ("Closed · Injective") both show the status label.
    expect(screen.getAllByText(/Closed/)).toHaveLength(2);
    expect(screen.queryByText("Dev")).toBeNull();
    expect(screen.queryByText(/days left/)).toBeNull();
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByRole("link").className).toContain("opacity-70");
  });
});
