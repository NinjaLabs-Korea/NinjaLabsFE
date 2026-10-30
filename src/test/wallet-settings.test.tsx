// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WalletSettings } from "@/components/account/WalletSettings";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

const connect = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ auth: null as unknown }));

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth as never,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }),
  }));
vi.mock("@/components/wallet/WalletProvider", () => ({ WalletProvider: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/wallet/WalletConnectButton", () => ({
  WalletConnectButton: () => <button onClick={connect} type="button">Connect wallet</button>,
}));

describe("WalletSettings first click", () => {
  it("starts the connection on the first Connect click instead of showing a second identical button", async () => {
    state.auth = signedInWith({ id: "u1", handle: "ninja", walletAddress: undefined });
    renderWithIntl(<WalletSettings wallet={{ chainId: 1439, rpcUrl: "https://rpc.example" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: "Connect wallet" });
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
