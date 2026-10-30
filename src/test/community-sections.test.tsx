// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutSection } from "@/components/community/AboutSection";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import { ActivitiesSection } from "@/components/community/ActivitiesSection";
import { CommunitySections } from "@/components/community/CommunitySections";
import { MembersPreviewSection } from "@/components/community/MembersPreviewSection";
import { BountiesEntrySection } from "@/components/community/BountiesEntrySection";
import { UpcomingEventsSection } from "@/components/community/UpcomingEventsSection";
import { NoticeRow } from "@/components/cards/NoticeRow";
import type { CommunityData } from "@/lib/community";
import type { ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import type { Bounty, Member, Notice } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => ({ status: "signed-out", user: null }), useCohortApi: () => api }));

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  slug: "n1", title: "Builder meetup", excerpt: "We met.", bodyMarkdown: "We met.", category: "Events", publishedAt: "2026.06.20", thumbnail: "", ...overrides,
});
const member = (overrides: Partial<Member> = {}): Member => ({
  slug: "mina", name: "Mina", initials: "MI", role: "Dev", title: "", bio: "", isMember: true, links: { profile: "/members/mina" }, ...overrides,
});
const openBounty: Bounty = {
  slug: "b1", title: "Open one", summary: "Build it", category: "Dev", status: "active", reward: { amount: 5, currency: "INJ" },
  sponsor: "Injective", deadline: "Open", daysLeft: 3, coverImage: "",
};
const data = (overrides: Partial<CommunityData> = {}): CommunityData => ({
  events: [], upcoming: [], hall: { stats: [], highlights: [], milestones: [], partners: [] }, members: [],
  unavailable: { notices: false, hall: false, members: false }, ...overrides,
});

beforeEach(() => {
  api = createMockApiClient();
});

describe("AboutSection", () => {
  it("introduces the hub and the four roles that can join", () => {
    renderWithIntl(<AboutSection />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
    expect(screen.getByText(/studies together, runs events and ships real work through bounties/)).toBeTruthy();
    for (const role of ["Developers", "Marketers", "Researchers", "Creators"]) expect(screen.getByText(role)).toBeTruthy();
  });

  it("is the page heading on /about", () => {
    renderWithIntl(<AboutSection level={1} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});

describe("ActivitiesSection", () => {
  it("shows event cards with the event date (not the publish date), the category and a link to the event notices", () => {
    renderWithIntl(<ActivitiesSection events={[notice({ eventDate: "2026-06-18" }), notice({ slug: "n2", title: "Undated" })]} unavailable={false} />);
    const cards = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/notices/"));
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Builder meetup")).toBeTruthy();
    expect(within(cards[0]).getByText("Event date 2026.06.18")).toBeTruthy();
    expect(within(cards[0]).getByText("Events")).toBeTruthy();
    expect(within(cards[1]).getByText("2026.06.20")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all events →" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("has an empty and an unavailable state", () => {
    const empty = renderWithIntl(<ActivitiesSection events={[]} unavailable={false} />);
    expect(screen.getByText("No news yet. New posts show up in Notices first.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See notices →" }).getAttribute("href")).toBe("/notices");
    empty.unmount();
    renderWithIntl(<ActivitiesSection events={[]} unavailable />);
    expect(screen.getByText("Past activities are temporarily unavailable.")).toBeTruthy();
  });
});

describe("AchievementsSection, MembersPreviewSection, BountiesEntrySection", () => {
  const highlights = [{ category: "Milestone" as const, title: "First", body: "Body", href: "/notices", image: null }];

  it("hides the stat cards while every stat is zero and shows them once one is above zero", () => {
    const zero = renderWithIntl(<AchievementsSection hall={{ stats: [{ value: "0", labelKey: "bountiesCompleted" }, { value: "0", labelKey: "buildersRewarded" }], milestones: [], partners: [], highlights }} locale="en" unavailable={false} />);
    expect(zero.container.querySelector("dl")).toBeNull();
    expect(screen.getByText("First")).toBeTruthy();
    zero.unmount();
    const some = renderWithIntl(<AchievementsSection hall={{ stats: [{ value: "0", labelKey: "bountiesCompleted" }, { value: "4", labelKey: "buildersRewarded" }], milestones: [], partners: [], highlights }} locale="en" unavailable={false} />);
    expect(some.container.querySelectorAll("dl > div")).toHaveLength(2);
  });

  it("shows the empty state when there are only zero stats and no highlights", () => {
    renderWithIntl(<AchievementsSection hall={{ stats: [{ value: "0", labelKey: "bountiesCompleted" }], milestones: [], partners: [], highlights: [] }} locale="en" unavailable={false} />);
    expect(screen.getByText(/No achievements yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the Hall of Fame →" }).getAttribute("href")).toBe("/hall-of-fame");
  });

  it("explains the bounties and previews the open ones with a link to /bounties", () => {
    renderWithIntl(<BountiesEntrySection bounties={[openBounty]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Bounties" })).toBeTruthy();
    expect(screen.getByText(/build an on-chain track record/)).toBeTruthy();
    expect(screen.getByText("Open one")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View all →" }).getAttribute("href")).toBe("/bounties");
  });

  it("never disappears: with nothing open it is one call-to-action card to /bounties", () => {
    renderWithIntl(<BountiesEntrySection bounties={[]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Bounties" })).toBeTruthy();
    expect(screen.getByText("No open bounties right now")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View all →" })).toBeNull();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/bounties");
    expect(links[0].textContent).toBe("Browse bounties");
  });

  it("lists upcoming events with their event date and renders nothing when there are none", () => {
    const empty = renderWithIntl(<UpcomingEventsSection events={[]} />);
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
    renderWithIntl(<UpcomingEventsSection events={[notice({ slug: "u1", title: "Demo day", eventDate: "2999-01-01" })]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Ongoing and upcoming events" })).toBeTruthy();
    expect(screen.getByText("Event date 2999.01.01")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all events →" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("shows the hall of fame stats and the first highlights, linking to the hall of fame", () => {
    renderWithIntl(
      <AchievementsSection
        hall={{ stats: [{ value: "1234", labelKey: "bountiesCompleted" }, { value: "12,500 USDC · 300 INJ", labelKey: "rewardsPaid" }], milestones: [], partners: [], highlights: Array.from({ length: 5 }, (_, index) => ({ category: "Milestone" as const, title: `Highlight ${index}`, body: "Body", href: "/notices", image: null })) }}
        locale="en"
        unavailable={false}
      />,
    );
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("12,500 USDC · 300 INJ")).toBeTruthy();
    expect(screen.getAllByText(/^Highlight \d$/)).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Open the Hall of Fame →" }).getAttribute("href")).toBe("/hall-of-fame");
  });

  it("previews members with their role and links to their profile", () => {
    renderWithIntl(<MembersPreviewSection members={[member()]} unavailable={false} />);
    const link = screen.getByRole("link", { name: /Mina/ });
    expect(link.getAttribute("href")).toBe("/members/mina");
    expect(within(link).getByText("Dev")).toBeTruthy();
  });

  it("gives every section an unavailable state that is not the empty state", () => {
    renderWithIntl(<><ActivitiesSection events={[]} unavailable /><AchievementsSection hall={data().hall} locale="en" unavailable /><MembersPreviewSection members={[]} unavailable /></>);
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Past activities are temporarily unavailable"), expect.stringContaining("Achievements are temporarily unavailable"), expect.stringContaining("Members are temporarily unavailable")]));
  });
});

describe("hub empty and unavailable states offer a next step", () => {
  it("links an empty members section to the recruitment page", () => {
    renderWithIntl(<MembersPreviewSection members={[]} unavailable={false} />);
    expect(screen.getByRole("link", { name: "See member recruitment →" }).getAttribute("href")).toBe("/recruit");
  });

  it("gives each unavailable section a retry button that re-reads the page", () => {
    refresh.mockClear();
    renderWithIntl(<><ActivitiesSection events={[]} unavailable /><AchievementsSection hall={data().hall} locale="en" unavailable /><MembersPreviewSection members={[]} unavailable /></>);
    const buttons = screen.getAllByRole("button", { name: "Try again" });
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[0]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("CommunitySections (shared by the hub and /about)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders upcoming events, the recruitment banner, past activities, members, achievements and the bounty entry in that order", async () => {
    renderWithIntl(<CommunitySections data={data({ upcoming: [notice({ slug: "u1", title: "Demo day", eventDate: "2999-01-01" })], events: [notice()], members: [member()] })} locale="en" openBounties={[openBounty]} />);
    await screen.findByText("Ninja Labs 2nd cohort is recruiting members");
    const order = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(order).toEqual([
      "Ongoing and upcoming events",
      "Ninja Labs 2nd cohort is recruiting members",
      "What we have done together",
      "Meet the members",
      "What the community has shipped",
      "Bounties",
    ]);
  });

  it("hides the upcoming section when there is no upcoming event and keeps the bounty entry when nothing is open", async () => {
    renderWithIntl(<CommunitySections aboutLevel={1} data={data({ events: [notice()], members: [member()] })} locale="en" />);
    await screen.findByText("Ninja Labs 2nd cohort is recruiting members");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ongoing and upcoming events" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Bounties" })).toBeTruthy();
    expect(screen.getByText("No open bounties right now")).toBeTruthy();
  });

  it("leaves the banner out when no cohort accepts applications", async () => {
    api.getCurrentCohort = async () => null;
    renderWithIntl(<CommunitySections data={data()} locale="en" />);
    await act(async () => undefined);
    expect(screen.queryByText(/is recruiting members/)).toBeNull();
  });
});

describe("NoticeRow event date", () => {
  it("shows the event date under the title only when the notice has one", () => {
    const view = renderWithIntl(<NoticeRow notice={notice({ eventDate: "2026-06-18" })} />);
    expect(screen.getByText("Event date 2026.06.18")).toBeTruthy();
    view.unmount();
    renderWithIntl(<NoticeRow notice={notice()} />);
    expect(screen.queryByText(/Event date/)).toBeNull();
  });

  it("ignores an event date stored on a notice that is not an event", () => {
    renderWithIntl(<NoticeRow notice={notice({ category: "Other", eventDate: "2026-11-11" })} />);
    expect(screen.queryByText(/Event date/)).toBeNull();
  });
});
