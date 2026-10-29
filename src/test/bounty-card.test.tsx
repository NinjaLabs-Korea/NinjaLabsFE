// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("lets a long unbroken sponsor name and title wrap instead of widening the card", () => {
    // jsdom has no layout: assert the wrapping classes that keep the 375px list free of horizontal scroll.
    renderWithIntl(<BountyCard bounty={{ ...base, title: "Supercalifragilistic".repeat(8), sponsor: "S".repeat(80) }} />);
    expect(screen.getByText(/S{80}/).className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByRole("heading").className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("BountyCard cover", () => {
  it("fades the cover in: opacity-0 until the image has loaded", async () => {
    const { container } = renderWithIntl(<BountyCard bounty={{ ...base, coverImage: "https://example.invalid/fade.png" }} />);
    const image = container.querySelector('img[src*="fade.png"]')!;
    expect(image.className).toContain("opacity-0");
    expect(image.className).toContain("motion-reduce:transition-none");
    fireEvent.load(image);
    // next/image reports onLoad after img.decode(), so the flip is asynchronous.
    await waitFor(() => expect(image.className).toContain("opacity-100"));
    expect(image.className).not.toContain("opacity-0");
  });

  it("falls back to the no-cover gradient when the image fails to load", () => {
    const { container } = renderWithIntl(<BountyCard bounty={{ ...base, coverImage: "https://example.invalid/none.png" }} />);
    const image = container.querySelector('img[src*="none.png"]');
    expect(image).toBeTruthy();
    expect(container.querySelector("[data-cover-fallback]")).toBeNull();
    fireEvent.error(image!);
    expect(container.querySelector('img[src*="none.png"]')).toBeNull();
    expect(container.querySelector("[data-cover-fallback]")).toBeTruthy();
  });
});
