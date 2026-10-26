// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutSection } from "@/components/community/AboutSection";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import { ActivitiesSection } from "@/components/community/ActivitiesSection";
import { CommunitySections } from "@/components/community/CommunitySections";
import { MembersPreviewSection } from "@/components/community/MembersPreviewSection";
import { OpenBountiesSection } from "@/components/community/OpenBountiesSection";
import { NoticeRow } from "@/components/cards/NoticeRow";
import type { CommunityData } from "@/lib/community";
import type { ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import type { Bounty, Member, Notice } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useCohortApi: () => api }));

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
  events: [], hall: { stats: [], highlights: [], milestones: [], partners: [] }, members: [],
  unavailable: { notices: false, hall: false, members: false }, ...overrides,
});

beforeEach(() => {
  api = createMockApiClient();
});

describe("AboutSection", () => {
  it("introduces the hub and the four roles that can join", () => {
    renderWithIntl(<AboutSection />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
    expect(screen.getByText(/Contributor Hub for people who learn, build and move on Injective/)).toBeTruthy();
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
    expect(screen.getByText("No events have been posted yet. Check back soon.")).toBeTruthy();
    empty.unmount();
    renderWithIntl(<ActivitiesSection events={[]} unavailable />);
    expect(screen.getByText("Past activities are temporarily unavailable.")).toBeTruthy();
  });
});

describe("AchievementsSection, MembersPreviewSection, OpenBountiesSection", () => {
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
    expect(screen.getByText(/shipped|appear here/i)).toBeTruthy();
  });

  it("previews open bounties with a link to /bounties, and renders nothing when there are none", () => {
    const empty = renderWithIntl(<OpenBountiesSection bounties={[]} />);
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
    renderWithIntl(<OpenBountiesSection bounties={[openBounty]} />);
    expect(screen.getByText("Open one")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View all →" }).getAttribute("href")).toBe("/bounties");
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

describe("CommunitySections (shared by the Intro and /about)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders activities, members, achievements, open bounties and the recruitment banner in that order, with no About on the Intro", async () => {
    renderWithIntl(<CommunitySections data={data({ events: [notice()], members: [member()] })} locale="en" openBounties={[openBounty]} />);
    await screen.findByText("Ninja Labs 2nd cohort is recruiting members");
    const order = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(order).toEqual([
      "What we have done together",
      "Meet the members",
      "What the community has shipped",
      "Active bounties",
      "Ninja Labs 2nd cohort is recruiting members",
    ]);
  });

  it("puts About first (as the page heading) on /about and drops the bounty preview when nothing is open", async () => {
    renderWithIntl(<CommunitySections aboutLevel={1} data={data({ events: [notice()], members: [member()] })} locale="en" />);
    await screen.findByText("Ninja Labs 2nd cohort is recruiting members");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Active bounties" })).toBeNull();
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
});
