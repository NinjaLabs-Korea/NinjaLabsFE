// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { MyCohortApplications } from "@/components/account/MyCohortApplications";
import { WalletSettings } from "@/components/account/WalletSettings";
import { ProfileForm } from "@/components/signup/ProfileForm";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs, signedInWith, signedOut } from "@/test/support/auth";

const state: { auth: AuthSnapshot } = { auth: signedInAs(previewUser) };
let api: ApiClient;
const refresh = vi.fn(async () => state.auth);
const verifyHandlers = vi.hoisted(() => ({ onVerified: undefined as (() => void) | undefined }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn(), refresh }),
    useFoundationMode: () => "api",
    useCohortApi: () => api,
    useOnboardingApi: () => api,
    useAccountSettingsApi: () => api,
  }));
vi.mock("@/components/wallet/WalletProvider", () => ({ WalletProvider: ({ children, chainId }: { children: ReactNode; chainId: number }) => <div data-testid="wallet-provider" data-chain={chainId}>{children}</div> }));
vi.mock("@/components/wallet/WalletConnectButton", () => ({
  WalletConnectButton: ({ onVerified, chainId }: { onVerified?: () => void; chainId: number }) => {
    verifyHandlers.onVerified = onVerified;
    return <button data-chain={chainId} type="button">Connect wallet</button>;
  },
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});
beforeEach(() => {
  api = createMockApiClient();
  state.auth = signedInAs(previewUser);
  refresh.mockClear();
  verifyHandlers.onVerified = undefined;
});

describe("WalletSettings", () => {
  const noWallet = signedInWith({ id: "u1", handle: "ninja", walletAddress: undefined });

  it("lets someone who connected later link a wallet here, and re-reads the session when it is verified", () => {
    state.auth = noWallet;
    renderWithIntl(<WalletSettings wallet={{ chainId: 1439, rpcUrl: "https://rpc.example" }} />);
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByTestId("wallet-provider").getAttribute("data-chain")).toBe("1439");
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
    verifyHandlers.onVerified?.();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a linked wallet read-only: there is no unlink in the BE, so no disconnect control", () => {
    state.auth = signedInWith({ id: "u1", walletAddress: "inj1abcdef" });
    renderWithIntl(<WalletSettings wallet={{ chainId: 1439 }} />);
    expect(screen.getByText("inj1abcdef")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText(/can.t be changed or unlinked/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains when wallet connection is unavailable in this environment, and renders nothing signed out", () => {
    state.auth = noWallet;
    const view = renderWithIntl(<WalletSettings wallet={null} />);
    expect(screen.getByText(/not available in this environment/)).toBeTruthy();
    view.unmount();
    state.auth = signedOut;
    const empty = renderWithIntl(<WalletSettings wallet={null} />);
    expect(empty.container.textContent).toBe("");
  });
});

describe("ProfileForm in edit mode (account page)", () => {
  const me = signedInWith({ id: "u1", handle: "ninja", bio: "Builder", tags: ["DEV", "DESIGN"] });

  it("starts from the saved profile, saves through the same endpoint and stays on the page", async () => {
    state.auth = me;
    const complete = vi.spyOn(api, "completeProfile");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, pathname: "/en/account" });
    const onSaved = vi.fn();
    renderWithIntl(<ProfileForm mode="edit" onSaved={onSaved} />);
    expect((screen.getByLabelText("Nickname*") as HTMLInputElement).value).toBe("ninja");
    expect((screen.getByLabelText("Bio*") as HTMLTextAreaElement).value).toBe("Builder");
    expect(screen.getByRole("button", { name: "Dev" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Content" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder and writer" } });
    fireEvent.click(screen.getByRole("button", { name: "Content" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(complete).toHaveBeenCalledWith({ nickname: "ninja", bio: "Builder and writer", tags: ["DEV", "DESIGN", "CONTENT"] });
    expect(refresh).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByText("Profile saved.")).toBeTruthy();
    // The account page unmounts the form on onSaved, so the visible confirmation is the shell-level flash toast.
    expect(window.sessionStorage.getItem("ninja.flash")).toBe("profileSaved");
    window.sessionStorage.removeItem("ninja.flash");
    vi.unstubAllGlobals();
  });

  it("keeps the onboarding rules: a tag and a bio are still required", () => {
    state.auth = signedInWith({ id: "u1", handle: "ninja", bio: "", tags: [] });
    const complete = vi.spyOn(api, "completeProfile");
    renderWithIntl(<ProfileForm mode="edit" />);
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByText("Choose at least one field tag.")).toBeTruthy();
    expect(screen.getByText("Write a short intro.")).toBeTruthy();
  });
});

describe("AccountSettingsView sections", () => {
  it("shows bio and tags, opens the editor on demand and closes it after a save", async () => {
    state.auth = signedInWith({ id: previewUser.id, handle: "ninja", bio: "Builder", tags: ["DEV"], walletAddress: "inj1abc" });
    renderWithIntl(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    expect(screen.getByText("Builder")).toBeTruthy();
    expect(screen.getByText("Dev")).toBeTruthy();
    expect(screen.queryByLabelText("Nickname*")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(screen.getByLabelText("Nickname*")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(screen.queryByLabelText("Nickname*")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));
    expect(screen.queryByLabelText("Nickname*")).toBeNull();
  });

  it("keeps the open profile editor and its typed bio when the session ends, and says so", () => {
    state.auth = signedInWith({ id: previewUser.id, handle: "ninja", bio: "Builder", tags: ["DEV"] });
    const view = renderWithIntl(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "A long new bio" } });
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    view.rerender(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    expect((screen.getByLabelText("Bio*") as HTMLTextAreaElement).value).toBe("A long new bio");
    expect(screen.getByText("Your session has ended. Sign in again to continue.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in again in a new tab, then save here" }).getAttribute("target")).toBe("_blank");
  });

  it("shows the sign-in prompt when the session ends while no editor is open", () => {
    state.auth = signedInWith({ id: previewUser.id, handle: "ninja" });
    const view = renderWithIntl(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    view.rerender(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    expect(screen.getByText("Your session has expired. Sign in again to continue.")).toBeTruthy();
    expect(screen.queryByLabelText("Bio*")).toBeNull();
  });

  it("puts the wallet card and the cohort applications between the profile and the danger zone", () => {
    state.auth = signedInWith({ id: previewUser.id, handle: "ninja" });
    renderWithIntl(<AccountSettingsView wallet={{ chainId: 1439 }} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf("Wallet")).toBeGreaterThan(headings.indexOf("Profile"));
    expect(headings.indexOf("Cohort applications")).toBeGreaterThan(headings.indexOf("Wallet"));
    expect(document.getElementById("wallet")).toBeTruthy();
  });
});

describe("MyCohortApplications", () => {
  const values = { displayName: "Me", telegram: "@me_builds", twitter: "@me_x", web3Experience: "GT_3Y" as const, activityType: "DEVELOPER" as const, activityTypeOther: null, interestAreas: ["DEVELOPER" as const], interestOther: null, intro: "hi" };

  it("is empty before the first application, then lists it with its status and a link to the application page", async () => {
    const view = renderWithIntl(<MyCohortApplications />);
    expect(await screen.findByText("You have not applied to a cohort yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the application page" }).getAttribute("href")).toBe("/recruit");
    view.unmount();

    await api.applyToCohort("cohort-2", values);
    renderWithIntl(<MyCohortApplications />);
    const card = (await screen.findByText("Ninja Labs 2nd cohort")).closest("article") as HTMLElement;
    expect(within(card).getByText("Under review")).toBeTruthy();
  });

  it("withdraws from the list and re-reads", async () => {
    await api.applyToCohort("cohort-2", values);
    renderWithIntl(<MyCohortApplications />);
    await screen.findByText("Under review");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { hidden: true })).getByRole("button", { name: "Withdraw application" }));
    expect(await screen.findByText("Withdrawn")).toBeTruthy();
  });

  it("offers a retry when the list cannot be read", async () => {
    api.getMyCohortApplications = vi.fn().mockResolvedValueOnce({ status: "unavailable", reason: "server-error" }).mockResolvedValue({ status: "available", data: [] });
    renderWithIntl(<MyCohortApplications />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You have not applied to a cohort yet.")).toBeTruthy();
  });
});
