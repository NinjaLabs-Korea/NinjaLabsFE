// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { BountyHero as BountyHeroData } from "@/lib/landing";
import { createMockApiClient } from "@/lib/mocks/api-client";
import type { Profile } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
}));

const data = vi.hoisted(() => ({ profile: undefined as Profile | undefined, acceptingCohort: false }));
vi.mock("@/lib/detail-id", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/detail-id")>()), validateDetailId: async () => true }));
vi.mock("@/lib/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/members")>()),
  getRuntimeProfile: async () => data.profile,
}));
vi.mock("@/lib/api/public", () => ({ loadFromRuntime: async ({ mock }: { mock: () => unknown }) => mock() }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => ({ status: "signed-out", user: null }), useCohortApi: () => ({ getCurrentCohort: async () => (data.acceptingCohort ? createMockApiClient().getCurrentCohort() : null) }) }));

const { default: MemberProfilePage } = await import("@/app/[locale]/members/[id]/page");
const { CommunityHero } = await import("@/components/community/CommunityHero");
const { BountyHero } = await import("@/components/bounties/BountyHero");

describe("member profile page", () => {
  it("lets a 42-character agent wallet and a long agent name wrap on a narrow screen", async () => {
    const wallet = `0x${"a".repeat(40)}`;
    data.profile = {
      slug: "ninja", handle: "ninja", initials: "NI", bio: "Builder", skills: [], joinedAt: "May 2026", completions: [], nfts: [],
      agents: [{ name: "n".repeat(60), wallet, verified: true, completedBounties: 0 }],
    };
    renderWithIntl(await MemberProfilePage({ params: Promise.resolve({ locale: "en", id: "ninja" }) } as never));
    expect(screen.getByText(`Registered wallet: ${wallet}`).className).toContain("break-all");
    expect(screen.getByRole("heading", { name: "n".repeat(60) }).className).toContain("break-words");
  });

  it("marks a multi-token completion reward with the number of further tokens", async () => {
    data.profile = {
      slug: "ninja", handle: "ninja", initials: "NI", bio: "Builder", skills: [], joinedAt: "May 2026", nfts: [], agents: [],
      completions: [{ bountySlug: "b1", title: "Widget", category: "Dev", completedAt: "June 30, 2026", reward: { amount: 1, currency: "INJ" }, moreRewards: 1, payoutStatus: "PAID" }],
    };
    renderWithIntl(await MemberProfilePage({ params: Promise.resolve({ locale: "en", id: "ninja" }) } as never));
    expect(screen.getByText(/1 INJ \+1/)).toBeTruthy();
  });
});

describe("member profile completion NFT tiles", () => {
  it("labels a completion NFT whose bounty was deleted with a localized fallback instead of a blank tile", async () => {
    data.profile = {
      slug: "ninja", handle: "ninja", initials: "NI", bio: "Builder", skills: [], joinedAt: "May 2026", completions: [], agents: [],
      nfts: [{ id: "n1", type: "completion", title: "", status: "ATTACHED", contractAddress: "inj1x", tokenId: "7", mintTxHash: null }],
    };
    renderWithIntl(await MemberProfilePage({ params: Promise.resolve({ locale: "en", id: "ninja" }) } as never));
    expect(screen.getByText("Bounty NFT")).toBeTruthy();
  });
});

describe("Intro (/) hero", () => {
  it("opens on the community hero, not the bounty marketing", async () => {
    data.acceptingCohort = false;
    renderWithIntl(await CommunityHero());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Learn, build, and move together on Injective.");
    expect(screen.getByText("Injective Contributor Hub")).toBeTruthy();
    expect(screen.getByText("Developers, marketers, researchers and creators are all welcome.")).toBeTruthy();
    expect(screen.queryByText("Complete bounties. Collect proof.")).toBeNull();
    expect(screen.queryByText("ninja.inj")).toBeNull();
    for (const role of ["Developers", "Marketers", "Researchers", "Creators"]) expect(screen.getByText(role)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "See past activities" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("swaps the second call to action for the cohort application while a cohort accepts applications", async () => {
    data.acceptingCohort = true;
    renderWithIntl(await CommunityHero());
    const apply = await screen.findByRole("link", { name: "Apply to join Ninja Labs 2nd cohort" });
    expect(apply.getAttribute("href")).toBe("/recruit");
    expect(screen.queryByRole("link", { name: "See past activities" })).toBeNull();
  });
});

describe("bounty hero (top of /bounties)", () => {
  const hero = (overrides: Partial<BountyHeroData> = {}): BountyHeroData => ({
    stats: [],
    portfolio: { handle: "ninja.inj", memberSince: 2026, completed: [], totalCompleted: 0 },
    statsUnavailable: false,
    ...overrides,
  });

  it("carries the moved headline, CTAs and the NFT portfolio card", async () => {
    renderWithIntl(await BountyHero({ hero: hero(), locale: "en" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Complete bounties. Collect proof. Own your track record.");
    expect(screen.getByText("ninja.inj")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByRole("link", { name: "How applying works →" }).getAttribute("href")).toBe("/bounties/apply");
  });

  it("renders closed bounties that share a title without duplicate-key warnings", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithIntl(await BountyHero({ hero: hero({ portfolio: { handle: "ninja.inj", memberSince: 2026, completed: ["Same", "Same"], totalCompleted: 2 } }), locale: "en" }));
    expect(error.mock.calls.filter(([message]) => String(message).includes("same key"))).toEqual([]);
    error.mockRestore();
    expect(screen.getAllByText("Same")).toHaveLength(2);
  });

  it("shows no stat block and no completed line while there is nothing to count", async () => {
    const view = renderWithIntl(await BountyHero({ hero: hero(), locale: "en" }));
    expect(view.container.querySelector("dl")).toBeNull();
    expect(screen.queryByText(/bounties? completed/)).toBeNull();
  });

  it("groups stat counts by locale like the Hall of Fame cards and leaves the paid total as is", async () => {
    renderWithIntl(await BountyHero({
      hero: hero({ stats: [{ value: "1234", labelKey: "bountiesCompleted" }, { value: "12,500 USDC · 300 INJ", labelKey: "rewardsPaid" }], portfolio: { handle: "ninja.inj", memberSince: 2026, completed: [], totalCompleted: 1234 } }),
      locale: "en",
    }));
    expect(screen.getByText("1,234", { selector: "dt" })).toBeTruthy();
    expect(screen.getByText("12,500 USDC · 300 INJ", { selector: "dt" })).toBeTruthy();
    expect(screen.getByText("1,234 bounties completed · a growing on-chain portfolio")).toBeTruthy();
  });
});
