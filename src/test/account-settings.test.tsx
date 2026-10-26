// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsView, confirmationMatches } from "@/components/account/AccountSettingsView";
import { FlashToast } from "@/components/layout/FlashToast";
import robots from "@/app/robots";
import { createApiApiClient } from "@/lib/api/api-client";
import type { ApiHttp } from "@/lib/api/http";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { FLASH_STORAGE_KEY, pushFlash, takeFlash } from "@/lib/flash";
import { createMockApiClient, MockApiError } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

const replace = vi.fn();
const hardNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ origin: "https://ninjalabs.test" }) }));

const signedIn = signedInAs(previewUser);
const state: { auth: AuthSnapshot } = { auth: signedIn };
let apiClient: ApiClient;
const signOut = vi.fn(async () => ({ status: "signed-out", user: null }) as AuthSnapshot);

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountSettingsApi: () => apiClient,
    useAuthActions: () => ({ signIn: vi.fn(), signOut }),
    useCohortApi: () => ({ getMyCohortApplications: async () => ({ status: "available", data: [] }) }),
    useFoundationMode: () => "mock",
  }));

describe("AccountSettingsView", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    state.auth = signedIn;
    apiClient = createMockApiClient();
    replace.mockReset();
    hardNavigate.mockReset();
    signOut.mockClear();
    window.sessionStorage.clear();
  });

  afterEach(() => window.sessionStorage.clear());

  const openDialog = () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    return screen.getByLabelText(/Type your nickname/);
  };
  const confirmButton = () => screen.getAllByRole("button", { name: /Delete account|Deleting/ }).at(-1)!;

  it("shows loading and signed-out states", () => {
    state.auth = { status: "loading", user: null };
    const { unmount } = renderWithIntl(<AccountSettingsView />);
    expect(screen.getByRole("status").textContent).toBe("Loading your account…");
    unmount();
    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<AccountSettingsView />);
    expect(screen.getByText("Sign in to manage your account")).toBeTruthy();
  });

  it("says the session expired only when it was ended from outside, never after the user's own sign-out", () => {
    state.auth = signedIn;
    const { rerender } = renderWithIntl(<AccountSettingsView />);
    state.auth = { status: "signed-out", user: null };
    rerender(<AccountSettingsView />);
    expect(screen.getByText("Sign in to manage your account")).toBeTruthy();
    expect(screen.queryByText(/session has expired/)).toBeNull();
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    rerender(<AccountSettingsView />);
    expect(screen.getByText(/session has expired/)).toBeTruthy();
  });

  it("keeps the confirm action disabled until the nickname is typed (trimmed, case-insensitive)", () => {
    renderWithIntl(<AccountSettingsView />);
    expect(screen.getByText("jaemin.inj")).toBeTruthy();
    const input = openDialog();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "jaemin" } });
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  JAEMIN.inj " } });
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("deletes the account, signs out, leaves a flash and goes home", async () => {
    const withdrawAccount = vi.fn(async () => undefined);
    Object.assign(apiClient, { withdrawAccount });
    // FlashToast is mounted like in the real shell: it must not swallow the flash before the full reload.
    renderWithIntl(<><FlashToast /><AccountSettingsView /></>);
    await new Promise((resolve) => setTimeout(resolve, 20)); // FlashToast's deferred mount read has run
    fireEvent.change(openDialog(), { target: { value: " jaemin.inj " } });
    fireEvent.click(confirmButton());
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/en"));
    expect(withdrawAccount).toHaveBeenCalledWith("jaemin.inj");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(FLASH_STORAGE_KEY)).toBe("accountDeleted");
  });

  it("explains a blocked withdrawal and stays signed in", async () => {
    Object.assign(apiClient, { withdrawAccount: vi.fn(async () => { throw new MockApiError(409, "WITHDRAWAL_BLOCKED_OPEN_PAYOUTS"); }) });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.change(openDialog(), { target: { value: "jaemin.inj" } });
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(/payout to you is still in progress/);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false); // can retry later
  });

  it.each([
    [409, "WITHDRAWAL_BLOCKED_PENDING_REWARDS", /approved rewards that have not been paid out yet[\s\S]*contact the Ninja Labs admins/],
    [503, "DATABASE_UNAVAILABLE", /^The service is temporarily unavailable. Please try again in a moment.$/],
  ])("explains a %i %s withdrawal failure and stays signed in", async (status, code, copy) => {
    Object.assign(apiClient, { withdrawAccount: vi.fn(async () => { throw new MockApiError(status, code); }) });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.change(openDialog(), { target: { value: "jaemin.inj" } });
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(copy);
    expect(signOut).not.toHaveBeenCalled();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("maps a nickname mismatch and unknown failures to their own copy", async () => {
    Object.assign(apiClient, { withdrawAccount: vi.fn(async () => { throw new MockApiError(400, "CONFIRM_NICKNAME_MISMATCH"); }) });
    const { unmount } = renderWithIntl(<AccountSettingsView />);
    fireEvent.change(openDialog(), { target: { value: "jaemin.inj" } });
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(/does not match/);
    unmount();

    Object.assign(apiClient, { withdrawAccount: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.change(openDialog(), { target: { value: "jaemin.inj" } });
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t delete your account/);
  });

  it("treats Enter as confirm, except the Enter that commits an IME composition", async () => {
    const withdrawAccount = vi.fn(async () => undefined);
    Object.assign(apiClient, { withdrawAccount });
    renderWithIntl(<AccountSettingsView />);
    const input = openDialog();
    fireEvent.change(input, { target: { value: "jaemin.inj" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(withdrawAccount).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/en"));
    expect(withdrawAccount).toHaveBeenCalledTimes(1);
  });

  it("ignores a double click while the request is in flight", async () => {
    let resolve!: () => void;
    const withdrawAccount = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    Object.assign(apiClient, { withdrawAccount });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.change(openDialog(), { target: { value: "jaemin.inj" } });
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    expect(withdrawAccount).toHaveBeenCalledTimes(1);
    expect(confirmButton().textContent).toBe("Deleting…");
    resolve();
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith("/en"));
  });
});

describe("withdrawal contract", () => {
  it("sends DELETE /users/me with the typed nickname", async () => {
    const calls: Array<[string, unknown]> = [];
    const client = createApiApiClient({ fetchJson: async (path: string, init?: unknown) => { calls.push([path, init]); return { ok: true }; } } as unknown as ApiHttp);
    await client.withdrawAccount("ryan");
    expect(calls).toEqual([["/users/me", { method: "DELETE", body: { confirmNickname: "ryan" } }]]);
  });

  it("mock client mirrors the BE nickname check", async () => {
    const client = createMockApiClient();
    await expect(client.withdrawAccount("nope")).rejects.toMatchObject({ status: 400, code: "CONFIRM_NICKNAME_MISMATCH" });
    await expect(client.withdrawAccount(" JAEMIN.INJ ")).resolves.toBeUndefined();
  });

  it("confirmationMatches", () => {
    expect(confirmationMatches("Ryan", " ryan ")).toBe(true);
    expect(confirmationMatches("Ryan", "")).toBe(false);
    expect(confirmationMatches("Ryan", "Rya")).toBe(false);
    // The BE compares NFC forms: a pasted decomposed nickname must enable the button for the stored composed one.
    expect(confirmationMatches("caf\u00e9", "cafe\u0301")).toBe(true);
  });

  it("robots disallows the account page in every locale", () => {
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toEqual(expect.arrayContaining(["/en/account", "/ko/account", "/zh/account"]));
  });
});

describe("flash toast", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("takeFlash reads once and drops unknown values", () => {
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, "accountDeleted");
    expect(takeFlash()).toBe("accountDeleted");
    expect(takeFlash()).toBeNull();
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, "<script>");
    expect(takeFlash()).toBeNull();
  });

  it("shows a flash left before navigation, and one pushed while mounted; dismissable", async () => {
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, "accountDeleted");
    const { unmount } = renderWithIntl(<FlashToast />);
    expect(await screen.findByText("Your account was deleted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Your account was deleted")).toBeNull();
    unmount();

    renderWithIntl(<FlashToast />);
    pushFlash("accountDeleted");
    expect(await screen.findByText("Your account was deleted")).toBeTruthy();
    expect(window.sessionStorage.getItem(FLASH_STORAGE_KEY)).toBeNull();
  });
});
