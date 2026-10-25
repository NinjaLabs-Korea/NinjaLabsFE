// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeLanding } from "@/lib/landing";
import type { Profile } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
}));

const data = vi.hoisted(() => ({ profile: undefined as Profile | undefined, landing: undefined as RuntimeLanding | undefined }));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/members")>()),
  getRuntimeProfile: async () => data.profile,
}));
vi.mock("@/lib/api/public", () => ({ loadFromRuntime: async ({ mock }: { mock: () => unknown }) => mock() }));
vi.mock("@/lib/landing", () => ({ getRuntimeLanding: async () => data.landing }));

const { default: MemberProfilePage } = await import("@/app/[locale]/members/[id]/page");
const { default: Home } = await import("@/app/[locale]/page");

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

describe("landing page", () => {
  it("renders closed bounties that share a title without duplicate-key warnings", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    data.landing = {
      hero: {
        primaryCta: { labelKey: "getStarted", href: "/signup" },
        secondaryCta: { labelKey: "browseBounties", href: "/bounties" },
        stats: [],
        portfolio: { handle: "ninja.inj", memberSince: 2026, completed: ["Same", "Same"], totalCompleted: 2 },
      },
      bounties: [],
      news: [],
      unavailable: { bounties: false, news: false, stats: false },
    };
    renderWithIntl(await Home({ params: Promise.resolve({ locale: "en" }) } as never));
    expect(error.mock.calls.filter(([message]) => String(message).includes("same key"))).toEqual([]);
    error.mockRestore();
    expect(screen.getAllByText("Same")).toHaveLength(2);
  });
});
