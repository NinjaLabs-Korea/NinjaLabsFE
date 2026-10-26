// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentRegisterForm } from "@/components/agents/AgentRegisterForm";
import { BountyAgentPanel } from "@/components/agents/BountyAgentPanel";
import type { AccountAgent } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { ApiHttpError } from "@/lib/api/http";
import { AGENT_DESCRIPTION_MAX, AGENT_NAME_MAX, validateAgentRegisterForm } from "@/lib/agent-register-form";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const agentWallet = "0xA9e1000000000000000000000000000000000001";
const signedIn = signedInWith({ walletAddress: "0x0000000000000000000000000000000000000009" });

const state: { agents: AccountAgent[] } = { agents: [] };
const registerAgent = vi.fn();
const verifyAgent = vi.fn();
const signMessageAsync = vi.fn();
const getAgents = vi.fn(async () => ({ status: "available" as const, data: state.agents }));
const defaultApiClient = {
  getAgents,
  registerAgent,
  verifyAgent,
};
const apiClient = { ...defaultApiClient } as unknown as ApiClient;

const walletDefaults = {
  hasInjectedWallet: true,
  address: agentWallet,
  isConnected: true,
  isWrongNetwork: false,
  connector: { type: "injected" },
  connect: vi.fn(),
  isConnecting: false,
  disconnect: vi.fn(),
  signMessageAsync,
  canSwitch: true,
  switchToTargetChain: vi.fn(),
  isSwitching: false,
  switchError: null as "rejected" | "failed" | null,
};
// Mutable so a test can put the hook into the wrong-network / failed-switch state.
const wallet = { ...walletDefaults };

// Mutable so a test can sign the user out while the form stays mounted.
const authState: { current: AuthSnapshot } = { current: signedIn };
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => authState.current,
    useAccountApi: () => apiClient,
    useAgentApi: () => apiClient,
  }));

vi.mock("@/components/wallet/useWalletConnection", () => ({
  shortWalletAddress: (address: string) => address,
  useWalletConnection: () => wallet,
}));

const agent = (status: AccountAgent["status"], walletAddress = agentWallet): AccountAgent => ({
  id: `agent-${status}`,
  name: `agent-${status.toLowerCase()}`,
  walletAddress,
  status,
  verified: status === "ACTIVE",
  completedBounties: 0,
  apiKeyMasked: "-",
  keyExpiresAt: null,
  keyStatus: null,
  registeredAt: "2026-10-01",
});

describe("AgentRegisterForm connected-wallet check", () => {
  beforeEach(() => {
    state.agents = [];
    Object.assign(wallet, walletDefaults);
    registerAgent.mockReset();
    registerAgent.mockImplementation(() => new Promise(() => undefined));
    verifyAgent.mockReset();
    signMessageAsync.mockReset();
    getAgents.mockClear();
  });

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "clipboard");
  });

  it("disables the switch button and explains when the configured chain has no RPC URL (canSwitch false)", async () => {
    Object.assign(wallet, { isWrongNetwork: true, canSwitch: false });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const button = (await screen.findByRole("button", { name: "Switch to Injective EVM" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Automatic network switching is not configured here. Switch your wallet to Injective EVM manually, then try again.");
    fireEvent.click(button);
    expect(wallet.switchToTargetChain).not.toHaveBeenCalled();
  });

  it.each([
    ["another account's pending agent holds the wallet", [] as AccountAgent[], "This wallet is already registered to another account. Use a different wallet."],
    ["the user's own agent holds the wallet", [agent("SUSPENDED")], "This wallet is already registered. View it in My agents."],
  ])("explains a 409 wallet conflict by who holds it: %s", async (_label, agents, copy) => {
    state.agents = agents;
    registerAgent.mockReset();
    registerAgent.mockRejectedValue(new ApiHttpError(409, "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED"));
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    await waitFor(() => expect(getAgents).toHaveBeenCalled());
    await screen.findByRole("button", { name: "Sign & Register" });
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    const submit = screen.getByRole("button", { name: "Sign & Register" }) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    expect((await screen.findByRole("alert")).textContent).toBe(copy);
  });

  it("re-reads the agent list after a successful verification so the pending banner disappears", async () => {
    state.agents = [agent("PENDING_VERIFICATION")];
    registerAgent.mockResolvedValue({ agentId: "agent-PENDING_VERIFICATION", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    verifyAgent.mockImplementation(async () => {
      state.agents = [agent("ACTIVE")];
      return { agentId: "agent-ACTIVE", status: "ACTIVE", apiKey: "nl_live_key", expiresAt: "2027-01-01T00:00:00Z" };
    });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect((await screen.findByRole("status")).textContent).toBe("This agent is pending verification. Sign again to finish registration.");
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);

    await screen.findByLabelText("New API key");
    await waitFor(() => expect(getAgents).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("This agent is pending verification. Sign again to finish registration.")).toBeNull());
  });

  it("lets a revoked agent's wallet register again through the normal flow", async () => {
    state.agents = [agent("REVOKED")];
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/already registered/)).toBeNull();

    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    await waitFor(() => expect(registerAgent).toHaveBeenCalledWith({ name: "fresh-agent", walletAddress: agentWallet }));
  });

  it("keeps the pending warning for an agent awaiting verification", async () => {
    state.agents = [agent("PENDING_VERIFICATION")];
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect((await screen.findByRole("status")).textContent).toBe("This agent is pending verification. Sign again to finish registration.");
  });

  it("blocks re-registering an active agent's wallet", async () => {
    state.agents = [agent("ACTIVE")];
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect(await screen.findByText("This wallet is already registered as agent-active.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "dup" } });
    expect((screen.getByRole("button", { name: "Sign & Register" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("recognises the owner's own wallet when the BE stores it as inj1 and the wallet reports 0x", async () => {
    const original = authState.current;
    authState.current = signedInWith({ walletAddress: "inj1cml96vmptgw99syqrrz8az79xer2pcgp0a885r" });
    Object.assign(wallet, { address: "0xC6Fe5D33615a1C52c08018c47E8Bc53646A0E101" });
    try {
      renderWithIntl(<AgentRegisterForm chainId={1439} />);
      expect((await screen.findByRole("alert")).textContent).toBe("This is your personal onboarding wallet. Switch MetaMask to a dedicated agent account.");
      fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "mine" } });
      expect((screen.getByRole("button", { name: "Sign & Register" }) as HTMLButtonElement).disabled).toBe(true);
    } finally {
      authState.current = original;
    }
  });

  it("does not show the 'already registered' notice next to the key it just issued", async () => {
    registerAgent.mockResolvedValue({ agentId: "agent-new", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    verifyAgent.mockImplementation(async () => {
      state.agents = [agent("ACTIVE")];
      return { agentId: "agent-new", status: "ACTIVE", apiKey: "nl_live_first_key", expiresAt: "2027-01-01T00:00:00Z" };
    });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    await screen.findByLabelText("New API key");
    await waitFor(() => expect(getAgents).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/already registered/)).toBeNull();
  });

  it("surfaces a failed chain switch as an alert next to the switch button", async () => {
    Object.assign(wallet, { isWrongNetwork: true, switchError: "failed" });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect((await screen.findByRole("alert")).textContent).toBe("The network could not be switched. Add Injective EVM to your wallet and try again.");
    expect(screen.getByRole("button", { name: "Switch to Injective EVM" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign & Register" })).toBeNull();

    Object.assign(wallet, { switchError: "rejected" });
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "rerender" } });
    expect(screen.getByRole("alert").textContent).toBe("You declined the network switch. Approve it in your wallet to continue.");
  });

  it("reveals the issued key in a copyable field and announces only that it is ready", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
    registerAgent.mockResolvedValue({ agentId: "agent-new", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    verifyAgent.mockResolvedValue({ agentId: "agent-new", status: "ACTIVE", apiKey: "nl_live_first_key", expiresAt: "2027-01-01T00:00:00Z" });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);

    const field = (await screen.findByLabelText("New API key")) as HTMLInputElement;
    expect(field.value).toBe("nl_live_first_key");
    expect(field.readOnly).toBe(true);
    expect(screen.getByText("Agent verified")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("API key ready, copy it now.");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("API key copied to the clipboard.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("nl_live_first_key");
    expect(verifyAgent).toHaveBeenCalledWith("agent-new", "0xsig");
  });

  it("drops the revealed key from the page when the user signs out while the form stays mounted", async () => {
    registerAgent.mockResolvedValue({ agentId: "agent-new", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    verifyAgent.mockResolvedValue({ agentId: "agent-new", status: "ACTIVE", apiKey: "nl_live_secret_key", expiresAt: "2027-01-01T00:00:00Z" });
    const view = renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    expect(((await screen.findByLabelText("New API key")) as HTMLInputElement).value).toBe("nl_live_secret_key");

    try {
      authState.current = { status: "signed-out", user: null };
      view.rerender(<AgentRegisterForm chainId={1439} />);
      await waitFor(() => expect(screen.queryByLabelText("New API key")).toBeNull());
      expect(view.container.innerHTML).not.toContain("nl_live_secret_key");
      // Signing back in does not bring the old key back.
      authState.current = signedIn;
      view.rerender(<AgentRegisterForm chainId={1439} />);
      expect(screen.queryByLabelText("New API key")).toBeNull();
    } finally {
      authState.current = signedIn;
    }
  });
});

describe("AgentRegisterForm auth state", () => {
  afterEach(() => {
    authState.current = signedIn;
  });

  it("asks a signed-out visitor to sign in, but never a user whose session is still being restored", () => {
    authState.current = { status: "loading", user: null };
    const { unmount } = renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect(screen.queryByText("Sign in before registering an agent.")).toBeNull();
    unmount();
    authState.current = { status: "signed-out", user: null };
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    expect(screen.getByText("Sign in before registering an agent.")).toBeTruthy();
  });
});

describe("AgentRegisterForm repeated submit in one tick", () => {
  it("registers, signs and verifies once, and shows only the key", async () => {
    registerAgent.mockReset();
    signMessageAsync.mockReset();
    verifyAgent.mockReset();
    registerAgent.mockResolvedValue({ agentId: "agent-once", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    verifyAgent.mockResolvedValue({ agentId: "agent-once", status: "ACTIVE", apiKey: "nl_live_once", expiresAt: "2027-01-01T00:00:00Z" });
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "once-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    const form = submit.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(verifyAgent).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(registerAgent).toHaveBeenCalledTimes(1);
    expect(signMessageAsync).toHaveBeenCalledTimes(1);
    expect(verifyAgent).toHaveBeenCalledTimes(1);
  });
});

describe("AgentRegisterForm session change mid-flight", () => {
  it("never shows a key that arrives after the user signed out", async () => {
    registerAgent.mockResolvedValue({ agentId: "agent-new", status: "PENDING_VERIFICATION", verificationMessage: "sign me" });
    signMessageAsync.mockResolvedValue("0xsig");
    let release: (value: unknown) => void = () => undefined;
    verifyAgent.mockReset();
    verifyAgent.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const view = renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "fresh-agent" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    await waitFor(() => expect(verifyAgent).toHaveBeenCalled());

    try {
      authState.current = { status: "signed-out", user: null };
      view.rerender(<AgentRegisterForm chainId={1439} />);
      release({ agentId: "agent-new", status: "ACTIVE", apiKey: "nl_live_late_key", expiresAt: "2027-01-01T00:00:00Z" });
      await waitFor(() => expect(submit.closest("form")).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByLabelText("New API key")).toBeNull();
      expect(view.container.innerHTML).not.toContain("nl_live_late_key");
    } finally {
      authState.current = signedIn;
    }
  });
});

describe("AgentRegisterForm field limits (mirror of BE RegisterAgentDto)", () => {
  beforeEach(() => {
    state.agents = [];
    Object.assign(wallet, walletDefaults);
    registerAgent.mockReset();
  });

  it("validateAgentRegisterForm bounds name to 1..100 (trimmed) and description to 1000", () => {
    expect(validateAgentRegisterForm({ name: "n".repeat(AGENT_NAME_MAX), description: "d".repeat(AGENT_DESCRIPTION_MAX) })).toEqual({});
    expect(validateAgentRegisterForm({ name: "n".repeat(AGENT_NAME_MAX + 1), description: "d".repeat(AGENT_DESCRIPTION_MAX + 1) })).toEqual({ name: "tooLong", description: "tooLong" });
    expect(validateAgentRegisterForm({ name: "   ", description: "" })).toEqual({ name: "required" });
    // Zero-width space / word joiner / Hangul filler only: blank to the reader, so blank to the rule.
    expect(validateAgentRegisterForm({ name: "\u200B\u2060 \u3164", description: "" })).toEqual({ name: "required" });
    expect(validateAgentRegisterForm({ name: "Bot\u200B", description: "" })).toEqual({});
  });

  it("caps the inputs with maxLength and shows a live description counter", async () => {
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const name = (await screen.findByLabelText("Agent name")) as HTMLInputElement;
    const description = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    expect(name.maxLength).toBe(100);
    expect(description.maxLength).toBe(1000);
    expect(screen.getByText("0/1000")).toBeTruthy();
    fireEvent.change(description, { target: { value: "scans markets" } });
    expect(screen.getByText("13/1000")).toBeTruthy();
    expect(description.getAttribute("aria-describedby")).toContain("agent-description-counter");
  });

  it("blocks submit client-side with field errors instead of calling the API", async () => {
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    // maxLength does not apply to programmatic changes, so an over-long value still reaches the validator.
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "n".repeat(AGENT_NAME_MAX + 1) } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "d".repeat(AGENT_DESCRIPTION_MAX + 1) } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      "Use at most 100 characters.",
      "Use at most 1000 characters.",
      "Fix the highlighted fields before registering.",
    ]);
    expect((screen.getByLabelText("Agent name") as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    expect(registerAgent).not.toHaveBeenCalled();
    // Editing the field clears its error.
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "ok" } });
    expect(screen.queryByText("Use at most 100 characters.")).toBeNull();
  });

  it("maps a BE VALIDATION_FAILED message[] onto the named fields", async () => {
    registerAgent.mockRejectedValue(new ApiHttpError(400, "VALIDATION_FAILED", ["name must be longer than or equal to 1 characters"]));
    renderWithIntl(<AgentRegisterForm chainId={1439} />);
    const submit = (await screen.findByRole("button", { name: "Sign & Register" })) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "weird" } });
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.submit(submit.closest("form") as HTMLFormElement);
    expect(await screen.findByText("The server rejected this name. Shorten or simplify it.")).toBeTruthy();
    expect(screen.getByText("Fix the highlighted fields before registering.")).toBeTruthy();
  });
});

describe("BountyAgentPanel", () => {
  beforeEach(() => {
    state.agents = [];
    Object.assign(apiClient, defaultApiClient);
  });

  it("prompts to sign in again when the session was rejected, and keeps the unavailable copy otherwise", async () => {
    Object.assign(apiClient, { getAgents: async () => ({ status: "unavailable" as const, reason: "unauthorized" as const }) });
    const { unmount } = renderWithIntl(<BountyAgentPanel copy="Agents can submit." />);
    expect(await screen.findByText("Your session has expired. Sign in again to use your agents for this bounty.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/signup");
    unmount();

    Object.assign(apiClient, { getAgents: async () => ({ status: "unavailable" as const, reason: "server-error" as const }) });
    renderWithIntl(<BountyAgentPanel copy="Agents can submit." />);
    expect(await screen.findByText("Your agent status is temporarily unavailable.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View my agents" }).getAttribute("href")).toBe("/agents");
  });

  it("offers registration when the owner only has revoked agents", async () => {
    state.agents = [agent("REVOKED", "0xdead")];
    renderWithIntl(<BountyAgentPanel copy="Agents can submit." />);
    const action = await screen.findByRole("link", { name: "Register an agent" });
    expect(action.getAttribute("href")).toBe("/agents/register");
    expect(screen.getByRole("heading", { name: "Submit via agent" })).toBeTruthy();
  });

  it("asks to finish verification only for pending agents", async () => {
    state.agents = [agent("REVOKED", "0xdead"), agent("PENDING_VERIFICATION")];
    renderWithIntl(<BountyAgentPanel copy="Agents can submit." />);
    expect(await screen.findByRole("link", { name: "Finish verification" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Agent verification pending" })).toBeTruthy();
  });

  it("counts verified agents first", async () => {
    state.agents = [agent("PENDING_VERIFICATION", "0xdead"), agent("ACTIVE")];
    renderWithIntl(<BountyAgentPanel copy="Agents can submit." />);
    expect(await screen.findByRole("heading", { name: "Verified agent ready" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View my agents" }).getAttribute("href")).toBe("/agents");
  });
});
