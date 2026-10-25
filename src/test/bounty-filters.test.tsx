// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { BountyFilters } from "@/components/bounties/BountyFilters";
import type { Bounty } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const bounties: Bounty[] = [
  {
    slug: "active-dev",
    title: "Active dev bounty",
    summary: "Build it",
    category: "Dev",
    status: "active",
    reward: { amount: 100, currency: "USDC" },
    sponsor: "Ninja Labs",
    deadline: "Open",
    daysLeft: 5,
    coverImage: "",
  },
  {
    slug: "closed-dev",
    title: "Closed dev bounty",
    summary: "Built already",
    category: "Dev",
    status: "closed",
    reward: { amount: 50, currency: "INJ" },
    sponsor: "Ninja Labs",
    deadline: "Closed",
    coverImage: "",
  },
  {
    slug: "active-design",
    title: "Active design bounty",
    summary: "Design it",
    category: "Design",
    status: "active",
    reward: { amount: 75, currency: "USDC" },
    sponsor: "Ninja Labs",
    deadline: "Open",
    daysLeft: 1,
    coverImage: "",
  },
];

describe("BountyFilters", () => {
  it("applies category and status as independent filters and resets both with All", () => {
    renderWithIntl(<BountyFilters bounties={bounties} />);

    const categoryGroup = screen.getByRole("group", { name: "Category" });
    const statusGroup = screen.getByRole("group", { name: "Status" });

    fireEvent.click(within(categoryGroup).getByRole("button", { name: "Dev" }));
    expect(screen.getByText("Active dev bounty")).toBeTruthy();
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();
    expect(screen.queryByText("Active design bounty")).toBeNull();

    fireEvent.click(within(statusGroup).getByRole("button", { name: "Closed" }));
    expect(screen.queryByText("Active dev bounty")).toBeNull();
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();

    // Re-clicking an active chip clears only that group.
    fireEvent.click(within(categoryGroup).getByRole("button", { name: "Dev" }));
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();
    expect(screen.queryByText("Active design bounty")).toBeNull();
    expect(within(statusGroup).getByRole("button", { name: "Closed" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Active dev bounty")).toBeTruthy();
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();
    expect(screen.getByText("Active design bounty")).toBeTruthy();
    expect(within(statusGroup).getByRole("button", { name: "Closed" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("offers only the categories present in the list", () => {
    renderWithIntl(<BountyFilters bounties={bounties} />);
    const categoryGroup = screen.getByRole("group", { name: "Category" });
    expect(within(categoryGroup).getAllByRole("button").map((button) => button.textContent)).toEqual(["Dev", "Design"]);
  });

  it("exposes the chip row as a named group and localizes the days-left countdown", () => {
    renderWithIntl(<BountyFilters bounties={bounties} />);
    expect(screen.getByRole("group", { name: "Bounty filters" })).toBeTruthy();
    expect(screen.getByText("5 days left · Ninja Labs")).toBeTruthy();
    expect(screen.getByText("1 day left · Ninja Labs")).toBeTruthy();
    expect(screen.getByText("Closed · Ninja Labs")).toBeTruthy();
    expect(screen.queryByText(/D-\d/)).toBeNull();
  });
});
