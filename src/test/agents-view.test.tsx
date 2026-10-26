// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentsView } from "@/components/account/AgentsView";
import { describeAgentKey } from "@/lib/agent-keys";
import { ApiHttpError } from "@/lib/api/http";
import type { AccountAgent } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
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

const signedIn = signedInAs(previewUser);
const state: { auth: AuthSnapshot } = { auth: signedIn };
let apiClient: ApiClient;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountApi: () => apiClient,
    useAgentApi: () => apiClient,
    useFoundationMode: () => "mock",
  }));

describe("describeAgentKey", () => {
  const now = Date.parse("2026-10-22T00:00:00Z");
  const days = (count: number) => new Date(now + count * 86_400_000).toISOString();

  it("flags keys expiring within 14 days and treats a past expiry as expired", () => {
    expect(describeAgentKey({ keyStatus: null, keyExpiresAt: null }, now)).toEqual({ kind: "none" });
    expect(describeAgentKey({ keyStatus: "REVOKED", keyExpiresAt: days(30) }, now)).toEqual({ kind: "revoked" });
    expect(describeAgentKey({ keyStatus: "EXPIRED", keyExpiresAt: days(-1) }, now)).toEqual({ kind: "expired" });
    expect(describeAgentKey({ keyStatus: "ACTIVE", keyExpiresAt: days(-1) }, now)).toEqual({ kind: "expired" });
    expect(describeAgentKey({ keyStatus: "ACTIVE", keyExpiresAt: days(13) }, now)).toEqual({ kind: "active", daysLeft: 13, expiringSoon: true, withinDay: false });
    expect(describeAgentKey({ keyStatus: "ACTIVE", keyExpiresAt: days(14) }, now)).toEqual({ kind: "active", daysLeft: 14, expiringSoon: false, withinDay: false });
    expect(describeAgentKey({ keyStatus: "ACTIVE", keyExpiresAt: null }, now)).toEqual({ kind: "active", daysLeft: null, expiringSoon: false, withinDay: false });
    // 3 hours left rounds up to "1 day": it must be flagged so the copy says "less than a day".
    expect(describeAgentKey({ keyStatus: "ACTIVE", keyExpiresAt: new Date(now + 3 * 3_600_000).toISOString() }, now)).toEqual({ kind: "active", daysLeft: 1, expiringSoon: true, withinDay: true });
  });
});

describe("AgentsView", () => {
  beforeAll(() => {
    // jsdom has no <dialog> implementation; ConfirmDialog only needs open/close bookkeeping here.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    state.auth = signedIn;
    apiClient = createMockApiClient();
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "clipboard");
  });

  /** Deferred `rotateAgentKey` so a request can be held in flight per agent. */
  function deferRotation() {
    const pending = new Map<string, (key: string) => void>();
    const rotateAgentKey = vi.fn(
      (agentId: string) =>
        new Promise<{ agentId: string; apiKey: string; expiresAt: string }>((resolve) => {
          pending.set(agentId, (apiKey) => resolve({ agentId, apiKey, expiresAt: "2027-01-01T00:00:00Z" }));
        }),
    );
    Object.assign(apiClient, { rotateAgentKey });
    return { rotateAgentKey, resolve: (agentId: string, apiKey: string) => pending.get(agentId)?.(apiKey) };
  }

  it("shows key status with an expiry warning inside 14 days", async () => {
    renderWithIntl(<AgentsView />);
    expect(await screen.findByText("proof-collector")).toBeTruthy();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toMatch(/^This key expires in 7 days\./);
  });

  it("lets the unbroken wallet address wrap instead of overflowing a narrow card", async () => {
    renderWithIntl(<AgentsView />);
    await screen.findByText("proof-collector");
    const wallets = screen.getAllByText(/^inj1/);
    expect(wallets.length).toBeGreaterThan(0);
    for (const wallet of wallets) expect(wallet.className).toContain("break-all");
  });

  it("shows an empty state instead of a blank page when the account has no agents", async () => {
    Object.assign(apiClient, { getAgents: async () => ({ status: "available", data: [] }) });
    renderWithIntl(<AgentsView />);
    expect(await screen.findByText("You have not registered an agent yet.")).toBeTruthy();
  });

  it("shows a loading state while the session is restoring and the signed-out panel only when signed out", async () => {
    state.auth = { status: "loading", user: null };
    const { unmount } = renderWithIntl(<AgentsView />);
    expect(screen.getByRole("status").textContent).toBe("Loading your account…");
    expect(screen.queryByText("Sign in to manage your agents")).toBeNull();
    unmount();

    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<AgentsView />);
    expect(await screen.findByText("Sign in to manage your agents")).toBeTruthy();
    expect(screen.queryByText("Loading your account…")).toBeNull();
  });

  it("rotates a key and reveals the new key once in a copyable field, announcing only that it is ready", async () => {
    renderWithIntl(<AgentsView />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Rotate key" }))[0]);
    const field = (await screen.findByLabelText("New API key")) as HTMLInputElement;
    expect(field.value).toBe("nl_preview_rotated_key_not_for_production");
    expect(field.readOnly).toBe(true);
    expect(screen.getByText("New API key issued")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    // The live region never carries the secret.
    const statuses = screen.getAllByRole("status").map((element) => element.textContent ?? "");
    expect(statuses).toContain("API key ready, copy it now.");
    expect(statuses.some((text) => text.includes("nl_preview_rotated_key"))).toBe(false);
    // The list re-reads /agents/me: the masked key changes while the raw key is never part of the row.
    await waitFor(() => expect(screen.getByText("nl_live_····…new1")).toBeTruthy());
  });

  it("forgets a rotated key once the session ends, even if the same user signs back in on this page", async () => {
    const view = renderWithIntl(<AgentsView />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Rotate key" }))[0]);
    expect(((await screen.findByLabelText("New API key")) as HTMLInputElement).value).toBe("nl_preview_rotated_key_not_for_production");
    try {
      state.auth = { status: "signed-out", user: null };
      view.rerender(<AgentsView />);
      await waitFor(() => expect(screen.queryByLabelText("New API key")).toBeNull());
      state.auth = signedIn;
      view.rerender(<AgentsView />);
      await screen.findAllByRole("button", { name: "Rotate key" });
      expect(screen.queryByLabelText("New API key")).toBeNull();
      expect(view.container.innerHTML).not.toContain("nl_preview_rotated_key");
    } finally {
      state.auth = signedIn;
    }
  });

  it("copies the revealed key and reports when the clipboard is unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithIntl(<AgentsView />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Rotate key" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));
    expect(await screen.findByText("API key copied to the clipboard.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("nl_preview_rotated_key_not_for_production");

    Reflect.deleteProperty(window.navigator, "clipboard");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copying is unavailable here. Select the key and copy it manually.")).toBeTruthy();
  });

  it("ignores a double click while a rotation is already in flight", async () => {
    const { rotateAgentKey, resolve } = deferRotation();
    renderWithIntl(<AgentsView />);
    const button = (await screen.findAllByRole("button", { name: "Rotate key" }))[0] as HTMLButtonElement;
    act(() => {
      button.click();
      button.click();
    });
    expect(rotateAgentKey).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("Rotating key…");
    resolve("agent-1", "nl_new_1");
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("tracks in-flight actions per agent so one request never disables another card", async () => {
    const { rotateAgentKey, resolve } = deferRotation();
    renderWithIntl(<AgentsView />);
    const [first, second] = (await screen.findAllByRole("button", { name: "Rotate key" })) as HTMLButtonElement[];
    fireEvent.click(first);
    // The second agent's buttons stay enabled while the first request is pending.
    expect(second.disabled).toBe(false);
    expect(screen.getAllByRole("button", { name: "Revoke agent" }).filter((element) => (element as HTMLButtonElement).disabled)).toHaveLength(1);
    fireEvent.click(second);
    expect(rotateAgentKey.mock.calls.map(([agentId]) => agentId)).toEqual(["agent-1", "agent-2"]);
    expect(screen.getAllByRole("button", { name: "Rotating key…" })).toHaveLength(2);

    resolve("agent-1", "nl_new_1");
    expect(((await screen.findByLabelText("New API key")) as HTMLInputElement).value).toBe("nl_new_1");
    expect(first.disabled).toBe(false);
    expect(second.disabled).toBe(true);
    expect(second.textContent).toBe("Rotating key…");

    resolve("agent-2", "nl_new_2");
    await waitFor(() => expect(second.disabled).toBe(false));
    expect(screen.getAllByLabelText("New API key").map((element) => (element as HTMLInputElement).value)).toEqual(["nl_new_1", "nl_new_2"]);
  });

  it("reports rotation failures on the right card: 409 AGENT_NOT_ACTIVE vs network failure", async () => {
    Object.assign(apiClient, {
      rotateAgentKey: vi.fn(async (agentId: string) => {
        throw agentId === "agent-1" ? new ApiHttpError(409, "AGENT_NOT_ACTIVE") : new TypeError("Failed to fetch");
      }),
    });
    renderWithIntl(<AgentsView />);
    const [first, second] = await screen.findAllByRole("button", { name: "Rotate key" });
    fireEvent.click(first);
    expect((await screen.findByRole("alert")).textContent).toBe("Only active agents can rotate keys.");
    fireEvent.click(second);
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getAllByRole("alert").map((element) => element.textContent)).toEqual([
      "Only active agents can rotate keys.",
      "The key could not be rotated. Try again.",
    ]);
    expect(screen.getByText("market-scout-agent").closest("article")?.textContent).toContain("Only active agents can rotate keys.");
    expect(screen.getByText("proof-collector").closest("article")?.textContent).toContain("The key could not be rotated. Try again.");
    // Failed cards get their actions back.
    expect(screen.getAllByRole("button", { name: "Rotate key" }).every((element) => !(element as HTMLButtonElement).disabled)).toBe(true);
  });

  it("reports a failed revoke and keeps the agent's actions", async () => {
    Object.assign(apiClient, { revokeAgent: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    renderWithIntl(<AgentsView />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Revoke agent" }))[1]);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The agent could not be revoked. Try again.");
    expect(screen.getAllByRole("button", { name: "Revoke agent" })).toHaveLength(2);
    expect(screen.queryByText("Revoked")).toBeNull();
  });

  it("disables key rotation for unverified agents", async () => {
    const getAgents = apiClient.getAgents;
    Object.assign(apiClient, {
      getAgents: async (auth: AuthSnapshot) => {
        const result = await getAgents(auth);
        if (result.status !== "available") return result;
        const data = result.data.map((agent: AccountAgent, index: number): AccountAgent =>
          index === 0 ? { ...agent, status: "PENDING_VERIFICATION", verified: false } : agent,
        );
        return { status: "available" as const, data };
      },
    });
    renderWithIntl(<AgentsView />);
    const buttons = (await screen.findAllByRole("button", { name: "Rotate key" })) as HTMLButtonElement[];
    expect(buttons.map((button) => button.disabled)).toEqual([true, false]);
    expect(screen.getByText("Unverified")).toBeTruthy();
    // Without a hint the disabled button reads as a bug: the card points at the way to finish registration.
    expect(screen.getByText(/^Registration is not finished/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Finish verification" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Finish verification" }).getAttribute("href")).toBe("/agents/register");
    // The pending agent can still be revoked.
    expect((screen.getAllByRole("button", { name: "Revoke agent" })[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("revokes an agent behind a destructive confirmation, removes its actions, and moves focus to the card heading", async () => {
    renderWithIntl(<AgentsView />);
    const opener = (await screen.findAllByRole("button", { name: "Revoke agent" }))[1];
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByText("Revoke proof-collector?")).toBeTruthy();
    const dialog = screen.getByRole("alertdialog", { hidden: true });
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toContain("The agent's API key stops working immediately");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(screen.getAllByText("Revoked")).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: "Revoke agent" })).toHaveLength(1);
    expect(screen.getByText("This agent was revoked. Its API key no longer works and it cannot act on your behalf.")).toBeTruthy();
    // The opener is gone, so focus lands on the revoked agent's heading instead of <body>.
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "proof-collector" }));
  });

  it("returns focus to the opener when the confirmation is cancelled", async () => {
    renderWithIntl(<AgentsView />);
    const opener = (await screen.findAllByRole("button", { name: "Revoke agent" }))[0];
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(opener);
  });
});
