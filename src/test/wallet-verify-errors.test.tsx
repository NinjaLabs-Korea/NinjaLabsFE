// @vitest-environment jsdom
// 온보딩 지갑 인증 실패 문구: BE `wallets.service.ts`의 코드마다 원인별 안내를 보여 주고, 그 외는 일반 문구 (`ERROR_COPY.walletVerify`).
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { ApiHttpError } from "@/lib/api/http";
import { renderWithIntl } from "@/test/intl";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

const walletApi = {
  createWalletChallenge: vi.fn(async () => ({ message: "Sign in to Ninja Labs: nonce" })),
  verifyWallet: vi.fn(async (): Promise<unknown> => ({})),
};
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useWalletApi: () => walletApi,
    useFoundationMode: () => "api",
  }));

const signMessageAsync = vi.fn(async () => "0xsignature");
vi.mock("@/components/wallet/useWalletConnection", () => ({
  shortWalletAddress: (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`,
  useWalletConnection: () => ({
    address: "0x1234567890abcdef1234567890abcdef1234cdef",
    connectedChainId: 1439,
    isWrongNetwork: false,
    isConnected: true,
    connector: { type: "injected" },
    connect: vi.fn(),
    connectError: null,
    isConnecting: false,
    disconnect: vi.fn(),
    signMessageAsync,
    canSwitch: true,
    switchToTargetChain: vi.fn(),
    isSwitching: false,
    switchError: null,
  }),
}));

async function verifyAndReadAlert(): Promise<string> {
  renderWithIntl(<WalletConnectButton chainId={1439} />);
  fireEvent.click(screen.getByRole("button", { name: "Verify wallet" }));
  return (await screen.findByRole("alert")).textContent ?? "";
}

describe("WalletConnectButton verification errors", () => {
  beforeEach(() => {
    push.mockReset();
    walletApi.createWalletChallenge.mockClear();
    walletApi.verifyWallet.mockReset();
    signMessageAsync.mockReset();
    signMessageAsync.mockResolvedValue("0xsignature");
  });

  it.each([
    [409, "WALLET_ALREADY_LINKED", "This wallet is already linked to another account, or your account already has a wallet."],
    [400, "CHALLENGE_EXPIRED", "The verification request expired or was already used."],
    [400, "CHALLENGE_NOT_FOUND", "The verification request was not found."],
    [401, "INVALID_SIGNATURE", "The signature does not match this wallet."],
    [503, "DATABASE_UNAVAILABLE", "The service is temporarily unavailable."],
  ])("explains a %i %s from verify", async (status, code, copy) => {
    walletApi.verifyWallet.mockRejectedValue(new ApiHttpError(status, code));
    expect(await verifyAndReadAlert()).toContain(copy);
    expect(push).not.toHaveBeenCalled();
  });

  it("explains an unsupported address rejected at the challenge step", async () => {
    walletApi.createWalletChallenge.mockRejectedValueOnce(new ApiHttpError(400, "INVALID_INJECTIVE_ADDRESS"));
    expect(await verifyAndReadAlert()).toContain("This wallet address is not supported.");
    expect(walletApi.verifyWallet).not.toHaveBeenCalled();
  });

  it("keeps the generic copy for a declined signature", async () => {
    signMessageAsync.mockRejectedValueOnce(new Error("User rejected the request."));
    expect(await verifyAndReadAlert()).toBe("Wallet verification failed. Check the signature request and try again.");
  });

  it("keeps the generic copy for an unlisted BE code", async () => {
    walletApi.verifyWallet.mockRejectedValue(new ApiHttpError(500, "UNKNOWN_ERROR"));
    expect(await verifyAndReadAlert()).toBe("Wallet verification failed. Check the signature request and try again.");
  });

  it("navigates to the profile step on success", async () => {
    renderWithIntl(<WalletConnectButton chainId={1439} />);
    fireEvent.click(screen.getByRole("button", { name: "Verify wallet" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/signup/profile"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
