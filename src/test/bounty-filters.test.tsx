// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { BountyFilters } from "@/components/bounties/BountyFilters";
import type { Bounty } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
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
    deadline: "D-5",
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
    deadline: "D-7",
    coverImage: "",
  },
];

describe("BountyFilters", () => {
  it("applies category and status as independent nested filters", () => {
    render(<BountyFilters bounties={bounties} />);

    const categoryGroup = screen.getByRole("group", { name: "Category" });
    const statusGroup = screen.getByRole("group", { name: "Status" });

    fireEvent.click(within(categoryGroup).getByRole("button", { name: "Dev" }));
    expect(screen.getByText("Active dev bounty")).toBeTruthy();
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();
    expect(screen.queryByText("Active design bounty")).toBeNull();

    fireEvent.click(within(statusGroup).getByRole("button", { name: "Closed" }));
    expect(screen.queryByText("Active dev bounty")).toBeNull();
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();

    fireEvent.click(within(categoryGroup).getByRole("button", { name: "All" }));
    expect(screen.getByText("Closed dev bounty")).toBeTruthy();
    expect(screen.queryByText("Active design bounty")).toBeNull();
    expect(within(statusGroup).getByRole("button", { name: "Closed" }).getAttribute("aria-pressed")).toBe("true");
  });
});
