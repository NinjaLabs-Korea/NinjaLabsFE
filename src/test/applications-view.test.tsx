// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import { ApiHttpError } from "@/lib/api/http";
import type { AccountApplication, ApplicationStatus } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
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
const currentStep = (article: HTMLElement) => {
  const progress = within(article).queryByRole("list", { name: "Application progress" });
  const current = progress?.querySelector('[aria-current="step"]');
  return current ? current.textContent?.replace(/^\d/, "") : null;
};

describe("ApplicationsView", () => {
  beforeAll(() => {
    // jsdom has no <dialog> implementation; ConfirmDialog only needs open/close bookkeeping here.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    state.auth = signedInAs(previewUser);
    state.mode = "api";
  });

  it("marks the current step for each status and shows the status badge copy", async () => {
    serve({ status: "available", data: [row("open"), row("approved"), row("submitted"), row("completed")] });
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "Bounty open" });

    expect(currentStep(card("Bounty open"))).toBe("Applied");
    expect(currentStep(card("Bounty approved"))).toBe("Approved");
    expect(currentStep(card("Bounty submitted"))).toBe("Submitted");
    expect(currentStep(card("Bounty completed"))).toBe("Completed");

    expect(within(card("Bounty approved")).getByText("Approved: submit unlocked")).toBeTruthy();
    // Every card links back to its bounty and shows its category and note.
    expect(screen.getByRole("link", { name: "Bounty open" }).getAttribute("href")).toBe("/bounties/bounty-open");
    expect(within(card("Bounty open")).getByText("Design")).toBeTruthy();
    expect(within(card("Bounty open")).getByText("note open")).toBeTruthy();
  });

  it("offers Submit work only on approved applications", async () => {
    serve({ status: "available", data: [row("open"), row("approved"), row("submitted"), row("completed")] });
    renderWithIntl(<ApplicationsView />);
    const submit = await screen.findAllByRole("link", { name: "Submit work" });
    expect(submit).toHaveLength(1);
    expect(submit[0].getAttribute("href")).toBe("/bounties/bounty-approved");
    expect(within(card("Bounty approved")).getByRole("link", { name: "Submit work" })).toBe(submit[0]);
  });

  it("replaces the stepper with the not-selected note for rejected applications", async () => {
    serve({ status: "available", data: [row("rejected")] });
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "Bounty rejected" });
    const article = card("Bounty rejected");
    expect(within(article).getByText("Not selected")).toBeTruthy();
    expect(within(article).getByText(/did not select this application/)).toBeTruthy();
    expect(within(article).queryByRole("list", { name: "Application progress" })).toBeNull();
    expect(within(article).queryByRole("link", { name: "Submit work" })).toBeNull();
  });

  it("labels applications an agent made on the owner's behalf", async () => {
    serve({
      status: "available",
      data: [row("open", { id: "mine", bountyTitle: "Mine" }), row("submitted", { id: "agent", bountyTitle: "By agent", agent: { id: "ag1", name: "Scout" } })],
    });
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "By agent" });
    expect(within(card("By agent")).getByText("via Scout")).toBeTruthy();
    expect(within(card("Mine")).queryByText(/^via /)).toBeNull();
  });

  it("asks to sign in again only for an unauthorized read, and shows the unavailable copy for server and network errors", async () => {
    serve({ status: "unavailable", reason: "unauthorized" });
    const view = renderWithIntl(<ApplicationsView />);
    expect(await screen.findByText("Your session has expired. Sign in again to continue.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
    view.unmount();

    for (const reason of ["server-error", "network-error"] as const) {
      serve({ status: "unavailable", reason });
      const next = renderWithIntl(<ApplicationsView />);
      expect(await screen.findByText("Applications are temporarily unavailable.")).toBeTruthy();
      expect(screen.queryByText(/session has expired/)).toBeNull();
      expect(screen.queryByRole("link", { name: "Get Started" })).toBeNull();
      next.unmount();
    }
  });

  it("shows a loading status while the session restores and the sign-in prompt when signed out", async () => {
    serve({ status: "available", data: [] });
    state.auth = { status: "loading", user: null };
    const view = renderWithIntl(<ApplicationsView />);
    expect((await screen.findByRole("status")).textContent).toBe("Loading your account…");
    view.unmount();

    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<ApplicationsView />);
    expect(await screen.findByText("Sign in to see your applications")).toBeTruthy();
  });

  it("shows the demo-data note only in mock mode", async () => {
    serve({ status: "available", data: [row("open")] });
    const view = renderWithIntl(<ApplicationsView />);
    await screen.findByRole("link", { name: "Bounty open" });
    expect(screen.queryByText(/Session preview: demo data/)).toBeNull();
    view.unmount();

    state.mode = "mock";
    renderWithIntl(<ApplicationsView />);
    expect(await screen.findByText("Session preview: demo data, resets on reload.")).toBeTruthy();
  });

  describe("withdraw", () => {
    const rows = () => [
      row("open"), row("approved"), row("submitted"), row("completed"), row("rejected"),
      row("open", { id: "agent-open", bountyTitle: "Agent open", agent: { id: "ag1", name: "Scout" } }),
    ];
    // A stateful stand-in for the BE: withdrawing removes the row from the next read.
    function serveWithWithdraw(withdraw: (id: string) => Promise<{ id: string; status: string }>) {
      let current = rows();
      apiClient = createMockApiClient();
      const withdrawApplication = vi.fn(async (id: string) => {
        const result = await withdraw(id);
        current = current.filter((item) => item.id !== id);
        return result;
      });
      const getApplications = vi.fn(async () => ({ status: "available" as const, data: current.map((item) => ({ ...item })) }));
      Object.assign(apiClient, { getApplications, withdrawApplication });
      return { withdrawApplication, getApplications };
    }

    it("offers Withdraw only on pending rows, including agent-made ones", async () => {
      serveWithWithdraw(async (id) => ({ id, status: "WITHDRAWN" }));
      renderWithIntl(<ApplicationsView />);
      await screen.findByRole("link", { name: "Bounty open" });
      expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(2);
      expect(within(card("Bounty open")).getByRole("button", { name: "Withdraw" })).toBeTruthy();
      expect(within(card("Agent open")).getByRole("button", { name: "Withdraw" })).toBeTruthy();
      for (const title of ["Bounty approved", "Bounty submitted", "Bounty completed", "Bounty rejected"]) {
        expect(within(card(title)).queryByRole("button", { name: "Withdraw" })).toBeNull();
      }
    });

    it("confirms, calls withdraw, refetches and announces the result", async () => {
      const { withdrawApplication, getApplications } = serveWithWithdraw(async (id) => ({ id, status: "WITHDRAWN" }));
      renderWithIntl(<ApplicationsView />);
      await screen.findByRole("link", { name: "Agent open" });
      fireEvent.click(within(card("Agent open")).getByRole("button", { name: "Withdraw" }));
      const dialog = screen.getByRole("alertdialog", { hidden: true });
      expect(within(dialog).getByText("Withdraw your application to “Agent open”?")).toBeTruthy();
      expect(withdrawApplication).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw application" }));
      await waitFor(() => expect(withdrawApplication).toHaveBeenCalledExactlyOnceWith("agent-open"));
      await waitFor(() => expect(screen.queryByRole("link", { name: "Agent open" })).toBeNull());
      expect(getApplications.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole("status", { hidden: true }).textContent).toContain("Application withdrawn.");
      expect(screen.getByRole("link", { name: "Bounty open" })).toBeTruthy();
    });

    it("does not call withdraw when the confirmation is cancelled", async () => {
      const { withdrawApplication } = serveWithWithdraw(async (id) => ({ id, status: "WITHDRAWN" }));
      renderWithIntl(<ApplicationsView />);
      await screen.findByRole("link", { name: "Bounty open" });
      fireEvent.click(within(card("Bounty open")).getByRole("button", { name: "Withdraw" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(withdrawApplication).not.toHaveBeenCalled();
      expect(screen.getByRole("link", { name: "Bounty open" })).toBeTruthy();
    });

    it("localizes APPLICATION_NOT_FOUND_OR_NOT_PENDING and a generic failure", async () => {
      let code: string | null = "APPLICATION_NOT_FOUND_OR_NOT_PENDING";
      serveWithWithdraw(async () => {
        throw code ? new ApiHttpError(404, code) : new Error("boom");
      });
      renderWithIntl(<ApplicationsView />);
      await screen.findByRole("link", { name: "Bounty open" });
      fireEvent.click(within(card("Bounty open")).getByRole("button", { name: "Withdraw" }));
      fireEvent.click(screen.getByRole("button", { name: "Withdraw application" }));
      expect((await screen.findByRole("alert")).textContent).toBe("This application was already reviewed or withdrawn.");

      code = null;
      fireEvent.click(within(card("Bounty open")).getByRole("button", { name: "Withdraw" }));
      fireEvent.click(screen.getByRole("button", { name: "Withdraw application" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("We couldn’t withdraw this application. Please try again shortly."));
    });
  });
});
