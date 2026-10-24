// @vitest-environment jsdom
// Admin route shells: the gate, the tab strip, the server pages (mock vs api data source, metadata) and the index redirect.
import { screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { createTranslator } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { AdminApi } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { enMessages, renderWithIntl } from "@/test/intl";

const redirect = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  redirect: (args: unknown) => redirect(args),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getMessages: async () => enMessages,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));

const state: { auth: AuthSnapshot; mode: "mock" | "api"; api: AdminApi } = {
  auth: { status: "signed-out", user: null },
  mode: "api",
  api: createMockApiClient(),
};
vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthSnapshot: () => state.auth,
  useFoundationMode: () => state.mode,
  useAdminApi: () => state.api,
}));

const params = Promise.resolve({ locale: "en" });
const mockEnv = { NINJA_DEPLOYMENT_TIER: "local", NINJA_RUNTIME_MODE: "mock", NINJA_APP_ORIGIN: "http://localhost:3000", NINJA_MOCK_SEED: "seed" };
const apiEnv = { NINJA_DEPLOYMENT_TIER: "test", NINJA_RUNTIME_MODE: "api", NINJA_APP_ORIGIN: "https://app.example.test", NINJA_API_BASE_URL: "https://api.example.test" };
const stubEnv = (env: Record<string, string>) => {
  for (const key of ["NINJA_API_BASE_URL", "NINJA_MOCK_SEED"]) vi.stubEnv(key, undefined as unknown as string);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  state.auth = { status: "signed-out", user: null };
  state.mode = "api";
  state.api = createMockApiClient();
  redirect.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AdminGate", () => {
  const content = <p>secret console</p>;

  it("shows a checking message while the session loads", () => {
    state.auth = { status: "loading", user: null };
    renderWithIntl(<AdminGate>{content}</AdminGate>);
    expect(screen.getByText("Checking admin access…")).toBeTruthy();
    expect(screen.queryByText("secret console")).toBeNull();
  });

  it("asks a signed-out visitor to sign in and links to /signup", () => {
    renderWithIntl(<AdminGate>{content}</AdminGate>);
    expect(screen.getByRole("heading", { level: 1, name: "Admin sign-in required" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signup");
    expect(screen.queryByText("secret console")).toBeNull();
  });

  it("refuses a signed-in non-admin", () => {
    state.auth = { status: "signed-in", user: { ...previewUser, isAdmin: false } };
    renderWithIntl(<AdminGate>{content}</AdminGate>);
    expect(screen.getByRole("heading", { level: 1, name: "Admin access only" })).toBeTruthy();
    expect(screen.getByText("Your account does not have administrator permission.")).toBeTruthy();
    expect(screen.queryByText("secret console")).toBeNull();
  });

  it("renders the console for an admin, and always in mock mode", () => {
    state.auth = { status: "signed-in", user: { ...previewUser, isAdmin: true } };
    const { unmount } = renderWithIntl(<AdminGate>{content}</AdminGate>);
    expect(screen.getByText("secret console")).toBeTruthy();
    unmount();

    state.auth = { status: "signed-out", user: null };
    state.mode = "mock";
    renderWithIntl(<AdminGate>{content}</AdminGate>);
    expect(screen.getByText("secret console")).toBeTruthy();
  });
});

describe("AdminTabs", () => {
  it("links every admin section and marks only the active one as the current page", () => {
    renderWithIntl(<AdminTabs active="hall-of-fame" />);
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["User Mgmt", "/admin/users"],
      ["Bounty Mgmt", "/admin/bounties"],
      ["Hall of Fame", "/admin/hall-of-fame"],
      ["Notices", "/admin/notices"],
    ]);
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, null, "page", null]);
  });
});

describe("AdminTable", () => {
  it("renders the given column headers in order around the body rows", () => {
    renderWithIntl(
      <AdminTable columns={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta", widthClass: "w-1" }]} minWidthClass="min-w-0">
        <tr><td>one</td><td>two</td></tr>
      </AdminTable>,
    );
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Alpha", "Beta"]);
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});

describe("admin pages", () => {
  it("redirects /admin to the users tab in the request locale", async () => {
    const { default: AdminIndex } = await import("@/app/[locale]/admin/page");
    await AdminIndex({ params: Promise.resolve({ locale: "ko" }) } as never);
    expect(redirect).toHaveBeenCalledWith({ href: "/admin/users", locale: "ko" });
  });

  it("wraps admin routes in the gate with the admin messages available to client islands", async () => {
    const { default: AdminLayout } = await import("@/app/[locale]/admin/layout");
    // The layout returns the async server <PageMessages>; resolve it the way the RSC renderer would.
    const tree = await AdminLayout({ children: <p>inner</p>, params });
    expect(tree.props.namespaces).toEqual(["admin"]);
    const render = tree.type as (props: typeof tree.props) => Promise<ReactElement<{ messages: Record<string, unknown>; children: ReactNode }>>;
    const provider = await render(tree.props);
    expect(Object.keys(provider.props.messages).sort()).toEqual(["admin", "common"]);
    // Render what the provider wraps (the test wrapper already supplies the English messages and locale).
    renderWithIntl(<>{provider.props.children}</>);
    expect(screen.getByRole("heading", { level: 1, name: "Admin sign-in required" })).toBeTruthy();
    expect(screen.queryByText("inner")).toBeNull();
  });

  it.each([
    ["users", "Admin · Users | Ninja Labs"],
    ["bounties", "Admin · Bounties | Ninja Labs"],
    ["notices", "Admin · Notices | Ninja Labs"],
    ["hall-of-fame", "Admin · Hall of Fame | Ninja Labs"],
  ])("builds %s metadata with its localized title and canonical path", async (segment, title) => {
    const { generateMetadata } = await import(`@/app/[locale]/admin/${segment}/page.tsx`) as { generateMetadata: (props: unknown) => Promise<{ title: string; alternates: { canonical: string } }> };
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toBe(title);
    expect(metadata.alternates.canonical).toContain(`/admin/${segment}`);
  });

  it("server-renders the mock fixture rows in mock mode", async () => {
    stubEnv(mockEnv);
    // Hold the client refresh so the rows on screen are the server-provided ones.
    state.api = { ...createMockApiClient(), getAdminUsers: () => new Promise(() => undefined) };
    const { default: UsersPage } = await import("@/app/[locale]/admin/users/page");
    renderWithIntl(await UsersPage({ params } as never));
    expect(screen.getByRole("heading", { level: 1, name: "User Management & Member Assignment" })).toBeTruthy();
    expect(screen.getByText("jaemin@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "User Mgmt" }).getAttribute("aria-current")).toBe("page");
  });

  it("starts empty in api mode and fills from the client request", async () => {
    stubEnv(apiEnv);
    const { default: BountiesPage } = await import("@/app/[locale]/admin/bounties/page");
    renderWithIntl(await BountiesPage({ params } as never));
    expect(screen.getByRole("heading", { level: 1, name: "Bounty Registration & Management" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(1);
    await waitFor(() => expect(screen.getByText("Build an iAsset price widget")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Bounty Mgmt" }).getAttribute("aria-current")).toBe("page");
  });

  it("renders the notices page heading and its tab", async () => {
    stubEnv(mockEnv);
    const { default: NoticesPage } = await import("@/app/[locale]/admin/notices/page");
    renderWithIntl(await NoticesPage({ params } as never));
    expect(screen.getByRole("heading", { level: 1, name: "Notices / News Management" })).toBeTruthy();
    expect(screen.getByText("Q3 roadmap preview")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Notices" }).getAttribute("aria-current")).toBe("page");
  });

  it("shows the hall-of-fame stats in mock mode and an unavailable status panel when the BE fetch fails", async () => {
    stubEnv(mockEnv);
    const { default: HallPage } = await import("@/app/[locale]/admin/hall-of-fame/page");
    const { unmount } = renderWithIntl(await HallPage({ params } as never));
    expect(screen.getByRole("heading", { level: 1, name: "Hall of Fame Curation" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
    unmount();

    stubEnv(apiEnv);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    renderWithIntl(await HallPage({ params } as never));
    const status = screen.getByRole("status");
    expect(status.textContent).toContain(enMessages.hallOfFame && (enMessages.hallOfFame as { unavailable: { title: string } }).unavailable.title);
    // The curation manager still renders below the panel.
    expect(screen.getByRole("heading", { name: "Highlight curation" })).toBeTruthy();
  });
});
