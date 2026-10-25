// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletSessionGuard } from "@/components/wallet/WalletSessionGuard";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { readWalletOwner, WALLET_OWNER_STORAGE_KEY, walletOwnerAction, writeWalletOwner } from "@/lib/wallet-owner";
import { loading, signedInWith, signedOut } from "./support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown as AuthSnapshot, connected: false, disconnect: vi.fn() }));

vi.mock("wagmi", () => ({
  useConnection: () => ({ isConnected: state.connected }),
  useDisconnect: () => ({ mutate: state.disconnect }),
}));

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth }));

const alice = signedInWith({ id: "alice" });
const bob = signedInWith({ id: "bob" });

beforeEach(() => {
  window.localStorage.clear();
  state.auth = loading;
  state.connected = false;
  state.disconnect.mockClear();
});

afterEach(cleanup);

describe("walletOwnerAction", () => {
  const base = { authReady: true, connected: true, userId: "alice", owner: "alice" as string | null };

  it.each([
    ["auth still loading", { ...base, authReady: false, owner: "bob" }, "none"],
    ["own connection", base, "none"],
    ["untagged connection of a signed-in user", { ...base, owner: null }, "adopt"],
    ["untagged connection, signed out (connected before sign-in)", { ...base, owner: null, userId: null }, "none"],
    ["signed out after the owner left (logout, withdrawal)", { ...base, userId: null }, "disconnect"],
    ["another user signed in (account switch)", { ...base, userId: "bob" }, "disconnect"],
    ["not connected, tag of the same user", { ...base, connected: false }, "none"],
    ["not connected, stale tag of another user", { ...base, connected: false, userId: "bob" }, "clear"],
    ["not connected, stale tag, signed out", { ...base, connected: false, userId: null }, "clear"],
    ["not connected, no tag", { ...base, connected: false, owner: null }, "none"],
  ])("%s -> %s", (_label, input, expected) => {
    expect(walletOwnerAction(input)).toBe(expected);
  });
});

describe("wallet owner storage", () => {
  it("round-trips the user id under a non-secret key", () => {
    expect(readWalletOwner()).toBeNull();
    writeWalletOwner("alice");
    expect(window.localStorage.getItem(WALLET_OWNER_STORAGE_KEY)).toBe("alice");
    expect(readWalletOwner()).toBe("alice");
    writeWalletOwner(null);
    expect(readWalletOwner()).toBeNull();
  });
});

describe("WalletSessionGuard", () => {
  function renderGuard() {
    return render(<WalletSessionGuard />);
  }

  it("tags a wallet connected by the signed-in user and leaves it connected", () => {
    state.auth = alice;
    state.connected = true;
    renderGuard();
    expect(readWalletOwner()).toBe("alice");
    expect(state.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects when the owner signs out while the wallet page is open (logout, withdrawal)", () => {
    state.auth = alice;
    state.connected = true;
    const view = renderGuard();
    state.auth = signedOut;
    view.rerender(<WalletSessionGuard />);
    expect(state.disconnect).toHaveBeenCalledTimes(1);
    expect(readWalletOwner()).toBeNull();
  });

  it("disconnects when a different user takes over the session (account switch)", () => {
    state.auth = alice;
    state.connected = true;
    const view = renderGuard();
    state.auth = bob;
    view.rerender(<WalletSessionGuard />);
    expect(state.disconnect).toHaveBeenCalledTimes(1);
    expect(readWalletOwner()).toBeNull();
  });

  it("disconnects a connection restored for a user who signed out elsewhere (wallet page not mounted at the time)", () => {
    writeWalletOwner("alice");
    state.connected = true;
    state.auth = signedOut;
    renderGuard();
    expect(state.disconnect).toHaveBeenCalledTimes(1);
    expect(readWalletOwner()).toBeNull();
  });

  it("disconnects a restored connection when the next user is already signed in", () => {
    writeWalletOwner("alice");
    state.connected = true;
    state.auth = bob;
    renderGuard();
    expect(state.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the connection for the same user after a reload", () => {
    writeWalletOwner("alice");
    state.connected = true;
    state.auth = alice;
    renderGuard();
    expect(state.disconnect).not.toHaveBeenCalled();
    expect(readWalletOwner()).toBe("alice");
  });

  it("waits for the session to settle before judging a restored connection", () => {
    writeWalletOwner("alice");
    state.connected = true;
    state.auth = loading;
    const view = renderGuard();
    expect(state.disconnect).not.toHaveBeenCalled();
    state.auth = alice;
    view.rerender(<WalletSessionGuard />);
    expect(state.disconnect).not.toHaveBeenCalled();
  });

  it("does not touch a wallet a signed-out visitor connects before signing in", () => {
    state.auth = signedOut;
    state.connected = true;
    renderGuard();
    expect(state.disconnect).not.toHaveBeenCalled();
    expect(readWalletOwner()).toBeNull();
  });
});
