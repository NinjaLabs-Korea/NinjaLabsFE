// @vitest-environment jsdom
// The four forms that guard against double submits share `useSingleFlight`: one call per burst, and the guard is
// released when the request fails, so a retry reaches the API again (a missed reset would leave the button dead).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyManager } from "@/components/admin/BountyManager";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { AgentRegisterForm } from "@/components/agents/AgentRegisterForm";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { getAdminBounties } from "@/lib/admin";
import { ApiHttpError } from "@/lib/api/http";
import type { AdminApi, ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

const checkNickname = vi.fn();
const completeProfile = vi.fn();
const registerAgent = vi.fn();
const verifyAgent = vi.fn();
const signMessageAsync = vi.fn();
const hardNavigate = vi.hoisted(() => vi.fn());
const state: { settings: ApiClient; admin: AdminApi } = { settings: undefined as unknown as ApiClient, admin: undefined as unknown as AdminApi };
const signedIn = signedInAs(previewUser);
const accountApi = { getAgents: async () => ({ status: "available" as const, data: [] }) };
const agentApi = { registerAgent, verifyAgent };
const agentWallet = "0xA9e1000000000000000000000000000000000001";

vi.mock("@/lib/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => ({ checkNickname, completeProfile, completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn(async () => ({ status: "signed-out", user: null })) }),
    useFoundationMode: () => "api",
    useAuthSnapshot: () => signedIn,
    useAccountSettingsApi: () => state.settings,
    useAccountApi: () => accountApi,
    useAgentApi: () => agentApi,
    useAdminApi: () => state.admin,
    useCohortApi: () => ({ getMyCohortApplications: async () => ({ status: "available", data: [] }) }),
  }));
vi.mock("@/components/wallet/useWalletConnection", () => ({
  shortWalletAddress: (address: string) => address,
  useWalletConnection: () => ({
    hasInjectedWallet: true, address: agentWallet, isConnected: true, isWrongNetwork: false, connector: { type: "injected" },
    connect: vi.fn(), isConnecting: false, disconnect: vi.fn(), signMessageAsync, canSwitch: true,
    switchToTargetChain: vi.fn(), isSwitching: false, switchError: null,
  }),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  for (const mock of [checkNickname, completeProfile, registerAgent, verifyAgent, signMessageAsync, hardNavigate]) mock.mockReset();
  checkNickname.mockResolvedValue({ available: true });
  state.settings = createMockApiClient();
  state.admin = createMockApiClient();
  sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("ProfileForm", () => {
  it("sends one save for a burst of submits and lets the user retry after a failure", async () => {
    completeProfile.mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL")).mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<ProfileForm />);
    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "ninja_dev" } });
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Builder" } });
    const form = screen.getByLabelText("Nickname").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(1));
    await screen.findByRole("alert");
    fireEvent.submit(form);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(2));
  });
});

describe("AgentRegisterForm", () => {
  it("registers once for a burst of submits and lets the user retry after a failure", async () => {
    registerAgent.mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL")).mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    const form = submit.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(registerAgent).toHaveBeenCalledTimes(1));
    await screen.findByRole("alert");
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(form);
    await waitFor(() => expect(registerAgent).toHaveBeenCalledTimes(2));
  });
});

describe("AccountSettingsView", () => {
  it("withdraws once for a double click and lets the user retry after a failure", async () => {
    const withdrawAccount = vi.fn().mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL")).mockReturnValue(new Promise(() => undefined));
    Object.assign(state.settings, { withdrawAccount });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText(/Type your nickname/), { target: { value: "jaemin.inj" } });
    const confirm = () => screen.getAllByRole("button", { name: /Delete account|Deleting/ }).at(-1)!;
    fireEvent.click(confirm());
    fireEvent.click(confirm());
    expect(withdrawAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((confirm() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm());
    expect(withdrawAccount).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog locked after a successful withdrawal while the full page load is pending", async () => {
    const withdrawAccount = vi.fn().mockResolvedValue(undefined);
    Object.assign(state.settings, { withdrawAccount });
    renderWithIntl(<AccountSettingsView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText(/Type your nickname/), { target: { value: "jaemin.inj" } });
    const confirm = () => screen.getAllByRole("button", { name: /Delete account|Deleting/ }).at(-1)! as HTMLButtonElement;
    fireEvent.click(confirm());
    await waitFor(() => expect(hardNavigate).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.click(confirm());
    expect(withdrawAccount).toHaveBeenCalledTimes(1);
    expect(confirm().disabled).toBe(true);
  });
});

describe("BountyManager status button", () => {
  it("guards each slug on its own: a second click on the same row is ignored, another row goes in parallel, and a failure frees the row", async () => {
    const openable = getAdminBounties().filter((bounty) => ["draft", "funding", "active"].includes(bounty.status));
    expect(openable.length).toBeGreaterThanOrEqual(2);
    const [first, second] = openable;
    const calls: string[] = [];
    const settle: Record<string, { resolve: () => void; reject: (error: unknown) => void }> = {};
    vi.spyOn(state.admin, "transitionAdminBounty").mockImplementation((slug) => {
      calls.push(slug);
      return new Promise<void>((resolve, reject) => { settle[slug] = { resolve, reject }; });
    });
    renderWithIntl(<><BountyManager bounties={getAdminBounties()} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
    const buttonFor = (title: string) => {
      const tr = screen.getByText(title, { selector: "td" }).closest("tr") as HTMLTableRowElement;
      return within(tr).getByRole("button", { name: /^(Close|Open)$/ }) as HTMLButtonElement;
    };
    await waitFor(() => expect(buttonFor(first.title)).toBeTruthy());
    fireEvent.click(buttonFor(first.title));
    fireEvent.click(buttonFor(first.title));
    fireEvent.click(buttonFor(second.title));
    expect(calls).toEqual([first.slug, second.slug]);
    expect(buttonFor(first.title).disabled).toBe(true);
    expect(buttonFor(second.title).disabled).toBe(true);
    await act(async () => { settle[first.slug].reject(new ApiHttpError(500, "INTERNAL")); });
    await waitFor(() => expect(buttonFor(first.title).disabled).toBe(false));
    expect(buttonFor(second.title).disabled).toBe(true);
    fireEvent.click(buttonFor(first.title));
    expect(calls).toEqual([first.slug, second.slug, first.slug]);
  });
});
