// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeHallOfFame } from "@/lib/hall-of-fame";
import type { Member, Notice } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a data-i18n-link="" href={href} {...props}>
      {children}
    </a>
  ),
}));

// Server pages read copy through next-intl/server: back it with the real translator/formatter over English messages.
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
}));

const data = vi.hoisted(() => ({
  hallOfFame: { hallOfFame: { stats: [], highlights: [], milestones: [], partners: [] }, unavailable: false } as {
    hallOfFame: RuntimeHallOfFame;
    unavailable: boolean;
  },
  members: [] as Member[],
  notices: [] as Notice[],
}));

vi.mock("@/lib/hall-of-fame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hall-of-fame")>()),
  loadRuntimeHallOfFame: async () => data.hallOfFame,
}));
vi.mock("@/lib/members", () => ({ getRuntimeMembers: async () => data.members }));
vi.mock("@/lib/notices", () => ({ getRuntimeNotices: async () => data.notices }));

const { default: HallOfFamePage } = await import("@/app/[locale]/hall-of-fame/page");
const { default: MembersPage } = await import("@/app/[locale]/members/page");
const { default: NoticesPage } = await import("@/app/[locale]/notices/page");
const pageProps = { params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) };

describe("Hall of Fame page", () => {
  beforeEach(() => {
    data.hallOfFame = { hallOfFame: { stats: [], highlights: [], milestones: [], partners: [] }, unavailable: false };
  });

  it("shows the unavailable status and no sections when the API is unreachable", async () => {
    data.hallOfFame = { hallOfFame: { stats: [], highlights: [], milestones: [], partners: [] }, unavailable: true };
    renderWithIntl(await HallOfFamePage(pageProps));
    expect(screen.getByRole("heading", { level: 1, name: "Hall of Fame" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("The Hall of Fame is temporarily unavailable.");
    expect(screen.queryByRole("heading", { name: "Featured highlights" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Platform milestones" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Partner logos" })).toBeNull();
  });

  it("formats numeric stats, keeps non-numeric values verbatim and renders highlights, milestones and partners", async () => {
    data.hallOfFame.hallOfFame = {
      stats: [
        { value: "1234", labelKey: "bountiesCompleted" },
        { value: "$-", labelKey: "rewardsPaid" },
      ],
      highlights: [{ category: "Partnership", title: "Hydro joins", body: "Content bounties.", href: "https://hydro.example/post", image: null }],
      milestones: [{ title: "First bounty", date: "May 3, 2026", description: "Posted." }],
      partners: [
        { name: "Hydro", logo: "https://cdn.example/hydro.png", href: "https://hydro.example" },
        { name: "Local", logo: "/logos/local.png", href: "/notices" },
        { name: "NoLink", logo: "/logos/none.png", href: null },
      ],
    };
    renderWithIntl(await HallOfFamePage(pageProps));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("Bounties completed")).toBeTruthy();
    expect(screen.getByText("$-")).toBeTruthy();

    const highlight = screen.getByRole("link", { name: /Hydro joins/ });
    expect(highlight.getAttribute("href")).toBe("https://hydro.example/post");
    expect(within(highlight).getByText("Partnership")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read notices" }).getAttribute("href")).toBe("/notices");

    expect(screen.getByText("May 3, 2026 · Posted.")).toBeTruthy();

    const external = screen.getByRole("link", { name: "Hydro" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByRole("link", { name: "Local" }).getAttribute("target")).toBeNull();
    // Only the same-site partner link is locale-aware; the external one is a plain anchor.
    expect(screen.getByRole("link", { name: "Local" }).hasAttribute("data-i18n-link")).toBe(true);
    expect(external.hasAttribute("data-i18n-link")).toBe(false);
    // A partner without a link is a plain tile, still labelled by its logo alt text.
    expect(screen.getByRole("img", { name: "NoLink" }).closest("a")).toBeNull();
  });

  it("renders admin entries that share a title without duplicate-key warnings and shows undated milestones without a stray separator", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    data.hallOfFame.hallOfFame = {
      stats: [],
      highlights: [
        { category: "Award", title: "Same", body: "One.", href: "/notices", image: null },
        { category: "Award", title: "Same", body: "Two.", href: "/notices", image: null },
      ],
      milestones: [
        { title: "Same", date: "", description: "Undated." },
        { title: "Same", date: "May 3, 2026", description: "Dated." },
      ],
      partners: [
        { name: "Dup", logo: "/logos/a.png", href: null },
        { name: "Dup", logo: "/logos/b.png", href: null },
      ],
    };
    renderWithIntl(await HallOfFamePage(pageProps));
    expect(error.mock.calls.filter(([message]) => String(message).includes("same key"))).toEqual([]);
    error.mockRestore();
    expect(screen.getAllByRole("link", { name: /Same/ })).toHaveLength(2);
    expect(screen.getByText("Undated.")).toBeTruthy();
    expect(screen.getByText("May 3, 2026 · Dated.")).toBeTruthy();
  });
});

describe("Members page", () => {
  it("renders the team heading, the role filter over the runtime members and no rules block", async () => {
    data.members = [
      { slug: "a", name: "Ana", initials: "AN", role: "Core", title: "", bio: "", isMember: true, links: {} },
      { slug: "b", name: "Ben", initials: "BE", role: "Ops", title: "", bio: "", isMember: true, links: {} },
    ];
    renderWithIntl(await MembersPage(pageProps));
    expect(screen.getByRole("heading", { level: 1, name: "Ninja Labs members" })).toBeTruthy();
    const list = screen.getByRole("region", { name: "Members" });
    expect(within(list).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Ana", "Ben"]);
    fireEvent.click(screen.getByRole("button", { name: "Ops" }));
    expect(within(screen.getByRole("region", { name: "Members" })).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Ben"]);
    expect(screen.queryByText("Member assignment rules")).toBeNull();
    expect(screen.queryByText("Same sign-up path as any user, with no separate member registration.")).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
  });
});

describe("Notices page", () => {
  it("renders the feed heading and the runtime notices behind the category filter", async () => {
    data.notices = [
      { slug: "n1", title: "Launch", excerpt: "x", bodyMarkdown: "", category: "Events", publishedAt: "Oct 1, 2026", thumbnail: "" },
    ];
    renderWithIntl(await NoticesPage(pageProps));
    expect(screen.getByRole("heading", { level: 1, name: "Notices" })).toBeTruthy();
    expect(screen.getByText("Events and news, all in one place.")).toBeTruthy();
    expect(screen.queryByText("Public")).toBeNull();
    expect(screen.queryByText(/Events . Ecosystem news . Notices/)).toBeNull();
    expect(screen.queryByText("Notices / News")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Notices" })).getByRole("link").getAttribute("href")).toBe("/notices/n1");
    expect(within(screen.getByRole("group", { name: "Notice categories" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Events"]);
  });
});
