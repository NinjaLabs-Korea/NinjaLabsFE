// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Bounty } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  getPathname: ({ href }: { href: string }) => href,
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
}));
// Client islands read the auth/account context; the page test only cares which of them it mounts.
vi.mock("@/components/bounties/BountyActionPanel", () => ({ BountyActionPanel: () => <section data-testid="action-panel" /> }));

const data = vi.hoisted(() => ({ bounty: undefined as Bounty | undefined }));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  getRuntimeBounty: async () => data.bounty,
}));

const { default: BountyDetailPage } = await import("@/app/[locale]/bounties/[id]/page");

const bounty = (): Bounty => ({
  slug: "b1", title: "T", summary: "S", category: "Dev", status: "active", reward: { amount: 5, currency: "INJ" },
  sponsor: "Ninja Labs", deadline: "Open", daysLeft: 3, coverImage: "",
});

describe("bounty detail page", () => {
  it("mounts the action panel and no agent panel", async () => {
    data.bounty = bounty();
    renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(screen.getByTestId("action-panel")).toBeTruthy();
    expect(screen.queryByTestId("agent-panel")).toBeNull();
    expect(screen.getByText("Direct submission")).toBeTruthy();
  });

  it("shows the card's cover image on the detail page, and nothing when the bounty has no cover", async () => {
    data.bounty = { ...bounty(), coverImage: "/media/33a9017e-fb51-4c38-b071-abd70b08404d" };
    const { unmount } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(screen.getByTestId("bounty-detail-cover").querySelector("img")?.getAttribute("src")).toContain("33a9017e-fb51-4c38-b071-abd70b08404d");
    unmount();

    data.bounty = bounty();
    renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(screen.queryByTestId("bounty-detail-cover")).toBeNull();
  });

  it("uses plain reward and completion copy, one footnote and no auth/visibility chips", async () => {
    data.bounty = bounty();
    const { container } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/release|child/i);
    expect(text).not.toMatch(/NFT/);
    expect(text.match(/swap/gi)).toHaveLength(1);
    expect(text.match(/Anyone can view\./g)).toHaveLength(1);
    expect(text).not.toMatch(/Public view|Actions require login/);
  });

  it.each([
    false, true,
  ] as const)("does not promise a payout or NFT without a specified reward (application=%s)", async (applicationRequired) => {
    data.bounty = { ...bounty(), applicationRequired, reward: { amount: 0, currency: "INJ" }, rewards: [] };
    const { container } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    const text = container.textContent ?? "";
    expect(text).toContain("Reward TBD");
    expect(text).toContain("No reward has been specified. Approval alone does not guarantee a payout.");
    expect(text).not.toMatch(/Sponsor pays:|Your reward is sent|Reward is sent in|original token/);
    expect(text).toContain(applicationRequired ? "Submit field unlocks for completed work." : "The sponsor reviews your submission.");
  });

  it("keeps the unset legacy reward fallback out of payout copy", async () => {
    data.bounty = { ...bounty(), reward: { amount: 0, currency: "INJ" } };
    const { container } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(container.textContent).toContain("No reward has been specified.");
    expect(container.textContent).not.toContain("Sponsor pays:");
  });

  it("uses only specified rewards, including their currency, in application payout guidance", async () => {
    data.bounty = { ...bounty(), applicationRequired: true, rewards: [{ amount: 0, currency: "INJ" }, { amount: 10, currency: "USDC" }] };
    const { container } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(container.textContent).toContain("Sponsor pays: 10 USDC");
    expect(container.textContent).toContain("Reward is sent in USDC");
    expect(container.textContent).not.toContain("Sponsor pays: Reward TBD");
    expect(container.textContent).not.toContain("Reward is sent in INJ");
  });
});
