// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import type { AccountApplication, ApplicationStatus } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { hrefString } from "@/test/support/link";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: Parameters<typeof hrefString>[0] }) => (
    <a href={hrefString(href)} {...props}>
      {children}
    </a>
  ),
}));

const state: { auth: AuthSnapshot; mode: "mock" | "api" } = { auth: signedInAs(previewUser), mode: "api" };
let apiClient: ApiClient;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountApi: () => apiClient,
    useBountyApi: () => apiClient,
    useFoundationMode: () => state.mode,
  }));

const row = (status: ApplicationStatus, overrides: Partial<AccountApplication> = {}): AccountApplication => ({
  reviewComment: null,
  reviewNote: null,
  paymentStatus: "NONE",
  id: `app-${status}`,
  bountySlug: `bounty-${status}`,
  bountyTitle: `Bounty ${status}`,
  category: "Design",
  appliedAt: "2026-07-12T09:00:00.000Z",
  note: `note ${status}`,
  status,
  agent: null,
  ...overrides,
});

function serve(result: ApiResult<AccountApplication[]>) {
  apiClient = createMockApiClient();
  Object.assign(apiClient, { getApplications: async () => result });
}
const card = (title: string) => screen.getByRole("link", { name: title }).closest("article") as HTMLElement;

describe("ApplicationsView bounty state", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });
  beforeEach(() => {
    state.auth = signedInAs(previewUser);
    state.mode = "api";
  });

  const future = new Date(Date.now() + 7 * 864e5).toISOString();
  const past = new Date(Date.now() - 864e5).toISOString();

  it("says the bounty was cancelled for a rejected application on a cancelled bounty, else the usual rejection", async () => {
    serve({ status: "available", data: [
      row("rejected", { id: "a", bountyTitle: "Cancelled one", bountySlug: "c1", bountyStatus: "CANCELLED", submissionDeadline: future }),
      row("rejected", { id: "b", bountyTitle: "Open one", bountySlug: "c2", bountyStatus: "OPEN", submissionDeadline: future }),
    ] });
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "Cancelled one" });
    expect(within(card("Cancelled one")).getByText(/cancelled by the sponsor/)).toBeTruthy();
    expect(within(card("Cancelled one")).queryByText(/did not select/)).toBeNull();
    expect(within(card("Open one")).getByText(/did not select/)).toBeTruthy();
  });

  it("drops Submit work for approved applications on cancelled or deadline-passed bounties, keeps it when open", async () => {
    serve({ status: "available", data: [
      row("approved", { id: "a", bountyTitle: "Cancelled", bountySlug: "x1", bountyStatus: "CANCELLED", submissionDeadline: future }),
      row("approved", { id: "b", bountyTitle: "Late", bountySlug: "x2", bountyStatus: "OPEN", submissionDeadline: past }),
      row("approved", { id: "c", bountyTitle: "Live", bountySlug: "x3", bountyStatus: "OPEN", submissionDeadline: future }),
      row("approved", { id: "d", bountyTitle: "Legacy", bountySlug: "x4" }),
    ] });
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "Live" });
    for (const title of ["Cancelled", "Late"]) {
      const article = card(title);
      expect(within(article).queryByRole("link", { name: "Submit work" })).toBeNull();
      expect(within(article).getByRole("link", { name: "View bounty" }).getAttribute("href")).toBe(`/bounties/${title === "Late" ? "x2" : "x1"}`);
      expect(within(article).getByText(/no longer accepting submissions/)).toBeTruthy();
    }
    expect(within(card("Live")).getByRole("link", { name: "Submit work" })).toBeTruthy();
    expect(within(card("Legacy")).getByRole("link", { name: "Submit work" })).toBeTruthy();
  });
});
