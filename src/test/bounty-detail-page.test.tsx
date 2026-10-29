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
vi.mock("@/components/agents/BountyAgentPanel", () => ({ BountyAgentPanel: () => <aside data-testid="agent-panel" /> }));
vi.mock("@/components/bounties/BountyActionPanel", () => ({ BountyActionPanel: () => <section data-testid="action-panel" /> }));
vi.mock("@/components/bounties/BountyAccessBadges", () => ({ BountyAccessBadges: () => <div data-testid="access-badges" /> }));

const data = vi.hoisted(() => ({ bounty: undefined as Bounty | undefined }));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  getRuntimeBounty: async () => data.bounty,
}));

const { default: BountyDetailPage } = await import("@/app/[locale]/bounties/[id]/page");

const bounty = (submissionMode: "direct" | "agent"): Bounty => ({
  slug: "b1", title: "T", summary: "S", category: "Dev", status: "active", reward: { amount: 5, currency: "INJ" },
  sponsor: "Ninja Labs", deadline: "Open", daysLeft: 3, coverImage: "", submissionMode,
});

describe("bounty detail agent panel", () => {
  it("is offered only on agent-mode bounties: a DIRECT bounty refuses agent keys (DIRECT_SUBMISSION_REQUIRED)", async () => {
    data.bounty = bounty("direct");
    const { unmount } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(screen.getByTestId("action-panel")).toBeTruthy();
    expect(screen.queryByTestId("agent-panel")).toBeNull();
    unmount();

    data.bounty = bounty("agent");
    renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
    expect(screen.getByTestId("agent-panel")).toBeTruthy();
  });

  it("uses plain reward and completion copy, one footnote and no auth/visibility chips", async () => {
    for (const mode of ["direct", "agent"] as const) {
      data.bounty = bounty(mode);
      const { container, unmount } = renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale: "en", id: "b1" }) } as never));
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/release|child/i);
      expect(text).toContain("A completion NFT is minted.");
      expect(text.match(/swap/gi)).toHaveLength(1);
      expect(text.match(/Anyone can view\./g)).toHaveLength(1);
      expect(screen.queryByTestId("access-badges")).toBeNull();
      expect(text).not.toMatch(/Public view|Actions require login/);
      unmount();
    }
  });
});
