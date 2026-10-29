// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Bounty } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

const koFiles = import.meta.glob("../../messages/ko/*.json", { eager: true, import: "default" }) as Record<string, Record<string, unknown>>;
const koMessages = Object.fromEntries(Object.entries(koFiles).map(([path, json]) => [path.split("/").pop()!.replace(".json", ""), json]));
const current = vi.hoisted(() => ({ locale: "en" }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  getPathname: ({ href }: { href: string }) => href,
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: current.locale, messages: current.locale === "ko" ? koMessages : enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: current.locale, timeZone: "UTC" }),
}));
vi.mock("@/components/agents/BountyAgentPanel", () => ({ BountyAgentPanel: () => <aside /> }));
vi.mock("@/components/bounties/BountyActionPanel", () => ({ BountyActionPanel: () => <section /> }));
vi.mock("@/components/bounties/BountyAccessBadges", () => ({ BountyAccessBadges: () => <div /> }));

const data = vi.hoisted(() => ({ bounty: undefined as Bounty | undefined }));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  getRuntimeBounty: async () => data.bounty,
}));

const { default: BountyDetailPage } = await import("@/app/[locale]/bounties/[id]/page");

const base: Bounty = {
  slug: "b1", title: "T", summary: "Short summary", descriptionMarkdown: "Full **description** body", category: "Dev", status: "active",
  reward: { amount: 5, currency: "INJ" }, sponsor: "Ninja Labs", deadline: "Open", daysLeft: 3, coverImage: "",
  deadlineDetail: "July 14, 2026 at 11:59 PM UTC", submissionGuideMarkdown: "Guide text", submissionMode: "direct",
};
const applyBounty: Bounty = {
  ...base, applicationRequired: true, applicationTitle: "T", applicationDescription: "Short summary",
  applicationDeadlineDetail: "July 1, 2026 at 11:59 PM UTC",
};

async function render(locale: string, bounty: Bounty) {
  current.locale = locale;
  data.bounty = bounty;
  return renderWithIntl(await BountyDetailPage({ params: Promise.resolve({ locale, id: "b1" }) } as never));
}

describe("bounty detail deadlines", () => {
  it("shows application and submission deadlines plus the full description for an application-required bounty", async () => {
    await render("en", applyBounty);
    expect(screen.getByText("Application deadline")).toBeTruthy();
    expect(screen.getByText("July 1, 2026 at 11:59 PM UTC")).toBeTruthy();
    expect(screen.getByText("Submission deadline")).toBeTruthy();
    expect(screen.getByText("July 14, 2026 at 11:59 PM UTC")).toBeTruthy();
    expect(screen.queryByText("Deadline")).toBeNull();
    expect(screen.getByText("Short summary")).toBeTruthy();
    expect(screen.getByText("description").tagName).toBe("STRONG");
    expect(screen.getByText("Guide text")).toBeTruthy();
  });

  it("marks a passed application deadline", async () => {
    await render("en", { ...applyBounty, applicationClosed: true });
    expect(screen.getByText(/Applications closed/)).toBeTruthy();
  });

  it("falls back to the status label when the application deadline is unknown", async () => {
    await render("en", { ...applyBounty, applicationDeadlineDetail: undefined });
    expect(screen.getByText("Application deadline")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("keeps the single Deadline cell on a direct bounty", async () => {
    await render("en", base);
    expect(screen.getByText("Deadline")).toBeTruthy();
    expect(screen.queryByText("Application deadline")).toBeNull();
    expect(screen.queryByText("Submission deadline")).toBeNull();
  });

  it("is localized in ko", async () => {
    await render("ko", applyBounty);
    expect(screen.getByText("지원 마감")).toBeTruthy();
    expect(screen.getByText("제출 마감")).toBeTruthy();
  });
});
