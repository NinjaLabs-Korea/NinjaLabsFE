// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
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

const base: Profile = { slug: "ninja", handle: "ninja", initials: "NI", bio: "Builder", skills: [], joinedAt: "May 2026", completions: [], nfts: [], agents: [] };
const render = async () => renderWithIntl(await MemberProfilePage({ params: Promise.resolve({ locale: "en", id: "ninja" }) } as never));

describe("member profile bio and team badge", () => {
  it("keeps the bio's line breaks", async () => {
    data.profile = { ...base, bio: "line one\nline two" };
    await render();
    expect(screen.getByText(/line one/).className).toContain("whitespace-pre-line");
  });

  it("badges an official team member with the team role instead of New here", async () => {
    data.profile = { ...base, teamRole: "Core" };
    await render();
    expect(screen.getByText("Team · Core")).toBeTruthy();
    expect(screen.queryByText("New here")).toBeNull();
  });

  it("still says New here for an ordinary builder without completions", async () => {
    data.profile = base;
    await render();
    expect(screen.getByText("New here")).toBeTruthy();
    expect(screen.queryByText(/Team ·/)).toBeNull();
  });
});
