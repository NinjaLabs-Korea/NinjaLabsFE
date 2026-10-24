// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Server pages read copy through next-intl/server: back it with next-intl's real translator over the English
// messages so ICU arguments/plurals are exercised exactly as in production.
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));

const state: { auth: AuthSnapshot } = { auth: { status: "signed-out", user: null } };
let apiClient: ApiClient;

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthSnapshot: () => state.auth,
  useAccountApi: () => apiClient,
  useBountyApi: () => apiClient,
  useAgentApi: () => apiClient,
  useFoundationMode: () => "mock",
}));

const { default: ApplicationsPage } = await import("@/app/[locale]/applications/page");
const { default: AgentsPage } = await import("@/app/[locale]/agents/page");
const params = Promise.resolve({ locale: "en" });

describe("owner-private account pages", () => {
  beforeAll(() => {
    // jsdom has no <dialog> implementation; AgentsView's ConfirmDialog only needs open/close bookkeeping here.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    state.auth = { status: "signed-out", user: null };
    apiClient = createMockApiClient();
  });

  it("renders the /applications h1 for signed-out visitors with the sign-in panel as content", async () => {
    renderWithIntl(await ApplicationsPage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: "My applications" })).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Get Started" })).toBeTruthy();
    expect(screen.getByText("Sign in to see your applications")).toBeTruthy();
  });

  it("renders the /agents h1 and register link for signed-out visitors", async () => {
    renderWithIntl(await AgentsPage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: "My agents" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Register new agent" }).getAttribute("href")).toBe("/agents/register");
    expect(await screen.findByRole("link", { name: "Get Started" })).toBeTruthy();
  });

  it("formats the ISO timestamps at render instead of printing them verbatim", async () => {
    state.auth = { status: "signed-in", user: previewUser };
    renderWithIntl(await ApplicationsPage({ params }));
    expect(await screen.findByText("Applied Jul 12, 2026")).toBeTruthy();
    expect(screen.queryByText(/2026-07-12T/)).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBe(1);
  });

  it("walks a four-step progress (applied → approved → submitted → completed) with no under-review step", async () => {
    state.auth = { status: "signed-in", user: previewUser };
    renderWithIntl(await ApplicationsPage({ params }));
    const progress = (await screen.findAllByRole("list", { name: "Application progress" }))[0];
    expect(Array.from(progress.querySelectorAll("li")).map((item) => item.textContent?.replace(/^\d/, ""))).toEqual(["Applied", "Approved", "Submitted", "Completed"]);
    expect(screen.queryByText("Under review")).toBeNull();
  });

  it("asks to sign in again when the API rejects the session, and keeps the unavailable copy for server errors", async () => {
    state.auth = { status: "signed-in", user: previewUser };
    Object.assign(apiClient, { getApplications: async () => ({ status: "unavailable" as const, reason: "unauthorized" as const }) });
    renderWithIntl(await ApplicationsPage({ params }));
    expect(await screen.findByText("Your session has expired. Sign in again to continue.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
    expect(screen.queryByText("Applications are temporarily unavailable.")).toBeNull();

    apiClient = createMockApiClient();
    Object.assign(apiClient, { getAgents: async () => ({ status: "unavailable" as const, reason: "unauthorized" as const }) });
    renderWithIntl(await AgentsPage({ params }));
    expect(await screen.findByText("Your session has expired. Sign in again to continue.")).toBeTruthy();
    expect(screen.queryByText("Agents are temporarily unavailable.")).toBeNull();

    apiClient = createMockApiClient();
    Object.assign(apiClient, { getAgents: async () => ({ status: "unavailable" as const, reason: "server-error" as const }) });
    renderWithIntl(await AgentsPage({ params }));
    expect(await screen.findByText("Agents are temporarily unavailable.")).toBeTruthy();
    expect(screen.getByText("We couldn’t reach the server. Please try again shortly.")).toBeTruthy();
  });

  it("formats the agent registration date at render", async () => {
    state.auth = { status: "signed-in", user: previewUser };
    renderWithIntl(await AgentsPage({ params }));
    expect(await screen.findByText("Jun 28, 2026")).toBeTruthy();
    expect(screen.queryByText(/2026-06-28T/)).toBeNull();
  });
});
