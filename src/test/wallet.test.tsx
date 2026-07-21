// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { createSessionPreviewAuthAdapter } from "@/lib/foundation/auth-adapter";

const wagmi = vi.hoisted(() => ({
  account: {
    address: undefined as string | undefined,
    chainId: undefined as number | undefined,
    isConnected: false,
  },
  connect: vi.fn(),
  connectors: [] as Array<{ type: string }>,
  connectError: null as Error | null,
  isConnecting: false,
  disconnect: vi.fn(),
  switchChain: vi.fn(),
  isSwitching: false,
  createConfig: vi.fn((config) => config),
  providerConfig: vi.fn(),
}));

const walletPrimitives = vi.hoisted(() => ({
  injected: vi.fn(() => ({ type: "injected" })),
  injectedWallet: vi.fn(),
  walletConnectWallet: vi.fn(),
  connectorsForWallets: vi.fn((wallets, options) => ({
    wallets,
    options,
  })),
  http: vi.fn((url?: string) => ({ url })),
  rainbowKitProvider: vi.fn(),
  queryClientProvider: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => wagmi.account,
  useConnect: () => ({
    connect: wagmi.connect,
    connectors: wagmi.connectors,
    error: wagmi.connectError,
    isPending: wagmi.isConnecting,
  }),
  useDisconnect: () => ({ disconnect: wagmi.disconnect }),
  useSwitchChain: () => ({
    switchChain: wagmi.switchChain,
    isPending: wagmi.isSwitching,
  }),
  createConfig: wagmi.createConfig,
  WagmiProvider: ({ children, config }: { children: ReactNode; config: unknown }) => {
    wagmi.providerConfig(config);
    return children;
  },
}));

vi.mock("wagmi/connectors", () => ({
  injected: walletPrimitives.injected,
}));

vi.mock("viem", () => ({
  http: walletPrimitives.http,
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class QueryClient {},
  QueryClientProvider: ({ children, client }: { children: ReactNode; client: unknown }) => {
    walletPrimitives.queryClientProvider(client);
    return children;
  },
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  connectorsForWallets: walletPrimitives.connectorsForWallets,
  RainbowKitProvider: ({
    children,
    initialChain,
  }: {
    children: ReactNode;
    initialChain: number;
  }) => {
    walletPrimitives.rainbowKitProvider(initialChain);
    return children;
  },
}));
vi.mock("@rainbow-me/rainbowkit/wallets", () => ({
  injectedWallet: walletPrimitives.injectedWallet,
  walletConnectWallet: walletPrimitives.walletConnectWallet,
}));

const injectedConnector = { type: "injected" };
const walletConnectConnector = { type: "walletConnect" };

function setInjectedWallet(available: boolean) {
  if (available) {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {},
    });
    return;
  }

  Reflect.deleteProperty(window, "ethereum");
}

describe("WalletProvider", () => {
  beforeEach(() => {
    wagmi.createConfig.mockClear();
    wagmi.providerConfig.mockClear();
    walletPrimitives.injected.mockClear();
    walletPrimitives.injectedWallet.mockClear();
    walletPrimitives.walletConnectWallet.mockClear();
    walletPrimitives.connectorsForWallets.mockClear();
    walletPrimitives.http.mockClear();
    walletPrimitives.rainbowKitProvider.mockClear();
    walletPrimitives.queryClientProvider.mockClear();
  });

  it("constructs an SSR-safe RainbowKit configuration with injected and WalletConnect wallet metadata", () => {
    render(
      <WalletProvider
        chainId={1439}
        rpcUrl="https://rpc.ninjalabs.example"
        walletConnectProjectId="project-id"
      >
        <span>Wallet content</span>
      </WalletProvider>,
    );

    expect(screen.getByText("Wallet content")).toBeTruthy();
    expect(walletPrimitives.injected).not.toHaveBeenCalled();
    expect(walletPrimitives.connectorsForWallets).toHaveBeenCalledWith(
      [
        {
          groupName: "Supported wallets",
          wallets: [walletPrimitives.injectedWallet, walletPrimitives.walletConnectWallet],
        },
      ],
      {
        appName: "Ninja Labs",
        projectId: "project-id",
      },
    );
    expect(walletPrimitives.http).toHaveBeenCalledWith("https://rpc.ninjalabs.example");
    expect(wagmi.createConfig).toHaveBeenCalledWith({
      chains: [
        expect.objectContaining({
          id: 1439,
          rpcUrls: { default: { http: ["https://rpc.ninjalabs.example"] } },
        }),
      ],
      connectors: {
        wallets: [
          {
            groupName: "Supported wallets",
            wallets: [walletPrimitives.injectedWallet, walletPrimitives.walletConnectWallet],
          },
        ],
        options: {
          appName: "Ninja Labs",
          projectId: "project-id",
        },
      },
      transports: { 1439: { url: "https://rpc.ninjalabs.example" } },
      ssr: true,
    });
    expect(wagmi.providerConfig).toHaveBeenCalledWith(
      expect.objectContaining({ ssr: true }),
    );
    expect(walletPrimitives.rainbowKitProvider).toHaveBeenCalledWith(1439);
    expect(walletPrimitives.queryClientProvider).toHaveBeenCalledOnce();
  });

  it("uses injected-only Wagmi without RainbowKit when no project ID is configured", () => {
    render(
      <WalletProvider chainId={1439}>
        <span>Wallet content</span>
      </WalletProvider>,
    );
    expect(screen.getByText("Wallet content")).toBeTruthy();

    expect(walletPrimitives.injected).toHaveBeenCalledOnce();
    expect(walletPrimitives.connectorsForWallets).not.toHaveBeenCalled();
    expect(walletPrimitives.rainbowKitProvider).not.toHaveBeenCalled();
    expect(walletPrimitives.http).toHaveBeenCalledWith(undefined);
    expect(wagmi.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        chains: [
          expect.objectContaining({
            id: 1439,
            rpcUrls: { default: { http: [] } },
          }),
        ],
        connectors: [{ type: "injected" }],
        transports: { 1439: { url: undefined } },
        ssr: true,
      }),
    );
  });
});

describe("WalletConnectButton", () => {
  beforeEach(() => {
    wagmi.account = { address: undefined, chainId: undefined, isConnected: false };
    wagmi.connectors = [injectedConnector, walletConnectConnector];
    wagmi.connectError = null;
    wagmi.isConnecting = false;
    wagmi.isSwitching = false;
    wagmi.connect.mockReset();
    wagmi.disconnect.mockReset();
    wagmi.switchChain.mockReset();
    setInjectedWallet(false);
  });

  it("connects through the injected connector without changing auth state", () => {
    const auth = createSessionPreviewAuthAdapter({
      id: "demo-user",
      handle: "demo",
      initials: "DU",
      profileSlug: "demo",
    });
    const beforeWalletAction = auth.getSnapshot();
    setInjectedWallet(true);

    render(<WalletConnectButton chainId={1439} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(wagmi.connect).toHaveBeenCalledWith({ connector: injectedConnector });
    expect(auth.getSnapshot()).toBe(beforeWalletAction);
    expect(auth.getSnapshot()).toEqual({ status: "signed-out", user: null });
  });

  it("falls back to WalletConnect when no injected wallet is available", () => {
    render(<WalletConnectButton chainId={1439} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(wagmi.connect).toHaveBeenCalledWith({ connector: walletConnectConnector });
  });

  it("masks the connected address and disconnects on click", () => {
    wagmi.account = {
      address: "0x1234567890abcdef1234567890abcdef1234cdef",
      chainId: 1439,
      isConnected: true,
    };

    render(<WalletConnectButton chainId={1439} />);
    const button = screen.getByRole("button", {
      name: "Disconnect wallet 0x1234…cdef",
    });
    fireEvent.click(button);

    expect(button.textContent).toBe("0x1234…cdef");
    expect(wagmi.disconnect).toHaveBeenCalledOnce();
  });

  it("offers a chain switch instead of disconnecting on the wrong network", () => {
    wagmi.account = {
      address: "0x1234567890abcdef1234567890abcdef1234cdef",
      chainId: 1,
      isConnected: true,
    };

    render(<WalletConnectButton chainId={1439} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Injective EVM" }),
    );

    expect(wagmi.switchChain).toHaveBeenCalledWith({ chainId: 1439 });
    expect(screen.getByRole("status").textContent).toBe(
      "Your wallet is connected to an unsupported network.",
    );
  });

  it("shows a stable connector error message", () => {
    wagmi.connectError = new Error("Connector rejected request");

    render(<WalletConnectButton chainId={1439} />);

    expect(screen.getByRole("alert").textContent).toBe(
      "Unable to connect your wallet. Try again.",
    );
  });

  it("reports an unavailable state when no compatible connector exists", () => {
    wagmi.connectors = [];

    render(<WalletConnectButton chainId={1439} />);

    expect(
      (screen.getByRole("button", { name: "Wallet unavailable" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Install or unlock a compatible browser wallet to connect.",
    );
    expect(wagmi.connect).not.toHaveBeenCalled();
  });
});
