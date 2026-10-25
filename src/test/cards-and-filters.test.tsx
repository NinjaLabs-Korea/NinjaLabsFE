// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { BountyCard } from "@/components/cards/BountyCard";
import { MemberCard } from "@/components/cards/MemberCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { NoticeRow } from "@/components/cards/NoticeRow";
import { MemberFilters } from "@/components/members/MemberFilters";
import { NoticeFilters } from "@/components/notices/NoticeFilters";
import type { Bounty, Member, Notice } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const bounty: Bounty = {
  slug: "widget", title: "Widget", summary: "Build it", category: "Dev", status: "active", reward: { amount: 5, currency: "INJ" },
  sponsor: "Injective", deadline: "Open", daysLeft: 3, coverImage: "",
};

describe("BountyCard", () => {
  it("links to the bounty detail page and shows the localized category and summary", () => {
    renderWithIntl(<BountyCard bounty={bounty} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/bounties/widget");
    expect(screen.getByRole("heading", { level: 3, name: "Widget" })).toBeTruthy();
    expect(screen.getByText("Build it")).toBeTruthy();
    expect(screen.getByText("5 INJ")).toBeTruthy();
  });

  it("hides the summary for landing cards and honours the titleAs heading level", () => {
    renderWithIntl(<BountyCard bounty={bounty} showSummary={false} titleAs="h2" />);
    expect(screen.queryByText("Build it")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Widget" })).toBeTruthy();
  });

  it("reads Reward TBD instead of 0 INJ when the bounty has no reward row", () => {
    renderWithIntl(<BountyCard bounty={{ ...bounty, reward: { amount: 0, currency: "INJ" } }} />);
    expect(screen.getByText("Reward TBD")).toBeTruthy();
    expect(screen.queryByText(/0 INJ/)).toBeNull();
  });

  it("counts the extra reward tokens next to the primary reward", () => {
    renderWithIntl(
      <BountyCard bounty={{ ...bounty, rewards: [bounty.reward, { amount: 100, currency: "USDC" }, { amount: 1, currency: "USDC" }] }} />,
    );
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("does not show a +0 counter for a single reward token", () => {
    renderWithIntl(<BountyCard bounty={{ ...bounty, rewards: [bounty.reward] }} />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it("uses the singular for one day left and the plural otherwise", () => {
    const view = renderWithIntl(<BountyCard bounty={{ ...bounty, daysLeft: 1 }} />);
    expect(screen.getByText(/1 day left/)).toBeTruthy();
    expect(screen.queryByText(/days left/)).toBeNull();
    view.unmount();
    renderWithIntl(<BountyCard bounty={{ ...bounty, daysLeft: 0 }} />);
    expect(screen.getByText(/0 days left/)).toBeTruthy();
  });

  it("falls back to the Active label when an open bounty has no countdown", () => {
    renderWithIntl(<BountyCard bounty={{ ...bounty, daysLeft: undefined }} />);
    expect(screen.getByText(/Active · Injective/)).toBeTruthy();
  });

  it("shows a reviewing bounty with the Reviewing badge, no countdown and full opacity", () => {
    renderWithIntl(<BountyCard bounty={{ ...bounty, status: "reviewing", daysLeft: undefined, deadline: "Closed" }} />);
    // Badge + footer status.
    expect(screen.getAllByText(/Reviewing/)).toHaveLength(2);
    expect(screen.queryByText("Dev")).toBeNull();
    expect(screen.queryByText(/days left/)).toBeNull();
    expect(screen.getByRole("link").className).not.toContain("opacity-70");
  });

  it("drops an unsafe cover image URL instead of rendering it", () => {
    // The INJ token glyph is an <img> too: look only at images other than the token icon.
    const covers = (root: HTMLElement) => Array.from(root.querySelectorAll("img")).filter((img) => !img.getAttribute("src")?.includes("injective-token"));
    const view = renderWithIntl(<BountyCard bounty={{ ...bounty, coverImage: "javascript:alert(1)" }} />);
    expect(covers(view.container)).toHaveLength(0);
    view.unmount();
    const safe = renderWithIntl(<BountyCard bounty={{ ...bounty, coverImage: "https://cdn.example.com/c.png" }} />);
    expect(covers(safe.container).map((img) => img.getAttribute("src"))).toEqual(["https://cdn.example.com/c.png"]);
  });
});

const member = (overrides: Partial<Member>): Member => ({
  slug: "kim", name: "Kim", initials: "K", role: "Dev", title: "Engineer", bio: "Writes code.", isMember: true,
  links: { profile: "/members/kim" }, ...overrides,
});

describe("MemberCard", () => {
  it("shows the localized role with the title and bio and links to the profile", () => {
    renderWithIntl(<MemberCard member={member({ links: { profile: "/members/kim", posts: "/notices?author=kim" } })} />);
    expect(screen.getByRole("heading", { level: 2, name: "Kim" })).toBeTruthy();
    expect(screen.getByText("Dev · Engineer")).toBeTruthy();
    expect(screen.getByText("Writes code.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/members/kim");
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("href")).toBe("/notices?author=kim");
  });

  it("falls back to the default title and bio when the member has not written one", () => {
    renderWithIntl(<MemberCard member={member({ title: "", bio: "", role: "Core" })} />);
    expect(screen.getByText("Core · Ninja Labs member")).toBeTruthy();
    expect(screen.getByText("Building in the Injective ecosystem.")).toBeTruthy();
  });

  it("shows the initials avatar for every member, not a hard-coded slug", () => {
    renderWithIntl(<MemberCard member={member({ slug: "kim", initials: "KM" })} />);
    expect(screen.getByText("KM")).toBeTruthy();
  });

  it("renders no links when the member has none", () => {
    renderWithIntl(<MemberCard member={member({ links: {} })} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

const notice = (overrides: Partial<Notice>): Notice => ({
  slug: "n1", title: "Launch", excerpt: "We launched.", bodyMarkdown: "", category: "Ninja Labs", publishedAt: "Oct 1, 2026",
  thumbnail: "", ...overrides,
});

describe("long unbroken text", () => {
  it("wraps in member and notice cards instead of widening them", () => {
    const word = "x".repeat(80);
    const first = renderWithIntl(<MemberCard member={member({ name: word, bio: word })} />);
    expect(screen.getByRole("heading", { name: word }).className).toContain("break-words");
    first.unmount();
    renderWithIntl(<NoticeRow notice={notice({ title: word, excerpt: `${word}!` })} />);
    expect(screen.getByRole("heading", { name: word }).className).toContain("break-words");
    expect(screen.getByText(`${word}!`).className).toContain("break-words");
  });
});

describe("NewsCard and NoticeRow", () => {
  it("link to the notice with the localized category, date, title and excerpt", () => {
    const value = notice({ category: "Injective ecosystem" });
    for (const Card of [NewsCard, NoticeRow]) {
      const view = renderWithIntl(<Card notice={value} />);
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/notices/n1");
      expect(within(link).getByText("Injective ecosystem")).toBeTruthy();
      expect(within(link).getByText("Oct 1, 2026")).toBeTruthy();
      expect(within(link).getByText("Launch")).toBeTruthy();
      expect(within(link).getByText("We launched.")).toBeTruthy();
      view.unmount();
    }
  });

  it("render only safe thumbnails", () => {
    for (const Card of [NewsCard, NoticeRow]) {
      const unsafe = renderWithIntl(<Card notice={notice({ thumbnail: "//evil.example/x.png" })} />);
      expect(unsafe.container.querySelector("img")).toBeNull();
      unsafe.unmount();
      const safe = renderWithIntl(<Card notice={notice({ thumbnail: "https://cdn.example.com/t.png" })} />);
      expect(safe.container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example.com/t.png");
      safe.unmount();
    }
  });
});

describe("MemberFilters", () => {
  const members = [
    member({ slug: "a", name: "Ana", role: "Core" }),
    member({ slug: "b", name: "Ben", role: "Dev" }),
    member({ slug: "c", name: "Cho", role: "Dev" }),
  ];
  const names = () => within(screen.queryByRole("region", { name: "Members" }) ?? document.body).queryAllByRole("heading", { level: 2 }).map((h) => h.textContent);

  it("filters by role with aria-pressed chips and returns to All", () => {
    renderWithIntl(<MemberFilters members={members} />);
    const group = screen.getByRole("group", { name: "Member roles" });
    const chip = (name: string) => within(group).getByRole("button", { name });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Core", "Dev", "Design", "Ops"]);
    expect(chip("All").getAttribute("aria-pressed")).toBe("true");
    expect(names()).toEqual(["Ana", "Ben", "Cho"]);

    fireEvent.click(chip("Dev"));
    expect(chip("Dev").getAttribute("aria-pressed")).toBe("true");
    expect(chip("All").getAttribute("aria-pressed")).toBe("false");
    expect(names()).toEqual(["Ben", "Cho"]);

    fireEvent.click(chip("All"));
    expect(names()).toEqual(["Ana", "Ben", "Cho"]);
  });

  it("says there are no members yet (no dead Reset button) when the feed is empty", () => {
    renderWithIntl(<MemberFilters members={[]} />);
    expect(screen.getByText("No members yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
  });

  it("shows an empty state for a role with no members and resets back to everyone", () => {
    renderWithIntl(<MemberFilters members={members} />);
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
    expect(screen.getByText("No members match your filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(names()).toEqual(["Ana", "Ben", "Cho"]);
  });
});

describe("NoticeFilters", () => {
  const notices = [
    notice({ slug: "e", title: "Meetup", category: "Events" }),
    notice({ slug: "n", title: "Release", category: "Ninja Labs" }),
    notice({ slug: "e2", title: "Hackathon", category: "Events" }),
  ];
  const titles = () => within(screen.getByRole("region", { name: "Notices" })).getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

  it("offers only the categories present, in canonical order, and filters by them", () => {
    renderWithIntl(<NoticeFilters notices={notices} />);
    const group = screen.getByRole("group", { name: "Notice categories" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Ninja Labs", "Events"]);
    expect(titles()).toEqual(["Meetup", "Release", "Hackathon"]);

    fireEvent.click(within(group).getByRole("button", { name: "Events" }));
    expect(within(group).getByRole("button", { name: "Events" }).getAttribute("aria-pressed")).toBe("true");
    expect(titles()).toEqual(["Meetup", "Hackathon"]);
  });

  it("shows the empty state for an empty feed", () => {
    renderWithIntl(<NoticeFilters notices={[]} />);
    expect(screen.getByText("No notices yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Notice categories" })).getAllByRole("button")).toHaveLength(1);
  });
});
