// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { addEthereumChainParameterFor, switchChainErrorKind } from "@/components/wallet/useWalletConnection";
import { FoundationProvider, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { IntlWrapper, renderWithIntl } from "@/test/intl";

// Mock-mode FoundationProvider imports its client lazily; warm the module graph so synchronous tests do not leave that
// import resolving after the jsdom environment is torn down.
await import("@/lib/mocks/api-client");

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// The App Router build aliases `next/dynamic` to `app-dynamic` (render-time BailoutToCSR for `ssr: false`); the
// package entry vitest would resolve is the pages-dir variant, so use the same module the app uses.
vi.mock("next/dynamic", async () => {
  const mod = await import("next/dist/shared/lib/app-dynamic");
  return { default: mod.default };
});

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
  switchError: null as Error | null,
  isSwitching: false,
  config: { chains: [{ id: 1439, rpcUrls: { default: { http: ["https://rpc.ninjalabs.example"] } } }] },
  signMessage: vi.fn(),
  // Spies on wagmi's real createConfig (installed in the module mock below): the tests assert the built Config.
  createConfig: vi.fn(),
  providerConfig: vi.fn(),
}));

const walletPrimitives = vi.hoisted(() => ({
  injected: vi.fn(() => () => ({ id: "injected", name: "injected", type: "injected" })),
  injectedWallet: vi.fn(),
  walletConnectWallet: vi.fn(),
  connectorsForWallets: vi.fn(() => [() => ({ id: "rainbow", name: "rainbow", type: "rainbow" })]),
  http: vi.fn((url?: string) => ({ url })),
  rainbowKitProvider: vi.fn(),
  queryClientProvider: vi.fn(),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  wagmi.createConfig.mockImplementation(actual.createConfig as never);
  return {
  useAccount: () => wagmi.account,
  useConnect: () => ({
    connect: wagmi.connect,
    connectors: wagmi.connectors,
    error: wagmi.connectError,
    isPending: wagmi.isConnecting,
  }),
  useDisconnect: () => ({ disconnect: wagmi.disconnect }),
  useSignMessage: () => ({ signMessageAsync: wagmi.signMessage }),
  useSwitchChain: () => ({
    switchChain: wagmi.switchChain,
    isPending: wagmi.isSwitching,
    error: wagmi.switchError,
  }),
  useConfig: () => wagmi.config,
  createConfig: wagmi.createConfig,
  WagmiProvider: ({ children, config }: { children: ReactNode; config: unknown }) => {
    wagmi.providerConfig(config);
    return children;
  },
  };
});

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
const previewUser = {
  id: "demo-user",
  handle: "demo",
  initials: "DU",
  profileSlug: "demo",
};

/** Exposes the provider's own auth snapshot next to the button (the adapter the button actually runs against). */
function AuthProbe() {
  // A plain span: <output> has an implicit "status" role and would collide with the button's own status line.
  return <span data-testid="auth-status">{useAuthSnapshot().status}</span>;
}

function renderWalletButton() {
  return renderWithIntl(
    <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
      <WalletConnectButton chainId={1439} />
      <AuthProbe />
    </FoundationProvider>,
  );
}

/** The latest Config the provider handed to WagmiProvider (built by wagmi's real createConfig). */
function providedConfig(): Config {
  expect(wagmi.providerConfig).toHaveBeenCalled();
  return wagmi.providerConfig.mock.lastCall?.[0] as Config;
}

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

  it("constructs an SSR-safe RainbowKit configuration with injected and WalletConnect wallet metadata", async () => {
    renderWithIntl(
      <WalletProvider
        chainId={1439}
        rpcUrl="https://rpc.ninjalabs.example"
        walletConnectProjectId="project-id"
      >
        <span>Wallet content</span>
      </WalletProvider>,
    );

    // The RainbowKit provider is a client-only next/dynamic chunk: until it resolves (and on the server) the children
    // render inside the injected-only shell, so the content is there from the first paint.
    expect(screen.getByText("Wallet content")).toBeTruthy();
    expect(walletPrimitives.injected).toHaveBeenCalledOnce();
    await waitFor(() => expect(walletPrimitives.rainbowKitProvider).toHaveBeenCalledWith(1439));
    expect(screen.getByText("Wallet content")).toBeTruthy();
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
    // Two configs: the injected shell first, then RainbowKit's (the one the provider ends up with).
    expect(wagmi.createConfig).toHaveBeenCalledTimes(2);
    // wagmi's real createConfig output: one Injective chain, its transport keyed by chain id, SSR mode, RainbowKit connectors.
    const config = providedConfig();
    expect(config.chains.map((chain) => chain.id)).toEqual([1439]);
    expect(config.chains[0].rpcUrls.default.http).toEqual(["https://rpc.ninjalabs.example"]);
    expect(config.chains[0].nativeCurrency).toEqual({ name: "Injective", symbol: "INJ", decimals: 18 });
    expect(Object.keys(config._internal.transports)).toEqual(["1439"]);
    expect(config._internal.transports[1439]).toEqual({ url: "https://rpc.ninjalabs.example" });
    expect(config._internal.ssr).toBe(true);
    expect(config.connectors.map((connector) => connector.type)).toEqual(["rainbow"]);
    expect(walletPrimitives.rainbowKitProvider).toHaveBeenCalledWith(1439);
  });

  it("hydrates the RainbowKit branch without a mismatch: server HTML equals the client's first render (injected shell)", async () => {
    const tree = (
      <IntlWrapper>
        <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
          <WalletProvider chainId={1439} rpcUrl="https://rpc.ninjalabs.example" walletConnectProjectId="project-id">
            <WalletConnectButton chainId={1439} />
          </WalletProvider>
        </FoundationProvider>
      </IntlWrapper>
    );
    // Server (`typeof window === "undefined"` for next/dynamic's bailout): `ssr: false` keeps the RainbowKit chunk out of
    // the HTML and renders the loading shell - the injected-only provider around the very same children.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("window", undefined);
    let html: string;
    try {
      html = renderToString(tree);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(html).toContain("Wallet unavailable");
    expect(walletPrimitives.connectorsForWallets).not.toHaveBeenCalled();

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const recoverable = vi.fn();
    try {
      await act(async () => {
        hydrateRoot(container, tree, { onRecoverableError: recoverable });
      });
      // The only recoverable error is next/dynamic's own bailout ("Switched to client rendering because the server
      // rendering errored: Bail out to client-side rendering" - the boundary Next resumes on the client and filters in
      // its own onRecoverableError); no hydration mismatch was recovered from and React logged no hydration warning.
      const recovered = recoverable.mock.calls.map(([error]) => (error as Error).message);
      expect(recovered.length).toBeGreaterThan(0);
      expect(recovered.every((entry) => /Bail out to client-side rendering: next\/dynamic/.test(entry))).toBe(true);
      expect(recovered.join("\n")).not.toMatch(/hydrat|did not match/i);
      expect(consoleError.mock.calls.flat().map(String).join("\n")).not.toMatch(/hydrat|did not match/i);
      // After hydration the real RainbowKit branch takes over (client only) and the button is still there.
      await waitFor(() => expect(walletPrimitives.rainbowKitProvider).toHaveBeenCalledWith(1439));
      expect(container.textContent).toContain("Wallet unavailable");
    } finally {
      consoleError.mockRestore();
      container.remove();
    }
  });

  it("uses injected-only Wagmi without RainbowKit when no project ID is configured", () => {
    renderWithIntl(
      <WalletProvider chainId={1439}>
        <span>Wallet content</span>
      </WalletProvider>,
    );
    expect(screen.getByText("Wallet content")).toBeTruthy();

    expect(walletPrimitives.injected).toHaveBeenCalledOnce();
    expect(walletPrimitives.connectorsForWallets).not.toHaveBeenCalled();
    expect(walletPrimitives.rainbowKitProvider).not.toHaveBeenCalled();
    expect(walletPrimitives.http).toHaveBeenCalledWith(undefined);
    const config = providedConfig();
    expect(config.chains.map((chain) => chain.id)).toEqual([1439]);
    expect(config.chains[0].rpcUrls.default.http).toEqual([]);
    expect(Object.keys(config._internal.transports)).toEqual(["1439"]);
    expect(config._internal.ssr).toBe(true);
    expect(config.connectors.map((connector) => connector.type)).toEqual(["injected"]);
  });
});

describe("WalletConnectButton", () => {
  beforeEach(() => {
    wagmi.account = { address: undefined, chainId: undefined, isConnected: false };
    wagmi.connectors = [injectedConnector, walletConnectConnector];
    wagmi.connectError = null;
    wagmi.switchError = null;
    wagmi.isConnecting = false;
    wagmi.isSwitching = false;
    wagmi.connect.mockReset();
    wagmi.disconnect.mockReset();
    wagmi.switchChain.mockReset();
    setInjectedWallet(false);
  });

  it("connects through the injected connector without changing the provider's auth state", async () => {
    setInjectedWallet(true);

    renderWalletButton();
    // The mock foundation loads lazily: wait until the provider's real adapter reports signed-out.
    expect(await screen.findByText("signed-out")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(wagmi.connect).toHaveBeenCalledWith({ connector: injectedConnector });
    await waitFor(() => expect(wagmi.connect).toHaveBeenCalledOnce());
    expect(screen.getByTestId("auth-status").textContent).toBe("signed-out");
  });

  it("falls back to WalletConnect when no injected wallet is available", () => {
    renderWalletButton();
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(wagmi.connect).toHaveBeenCalledWith({ connector: walletConnectConnector });
  });

  it("masks the connected address and disconnects on click", () => {
    wagmi.account = {
      address: "0x1234567890abcdef1234567890abcdef1234cdef",
      chainId: 1439,
      isConnected: true,
    };

    renderWalletButton();
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

    renderWalletButton();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Injective EVM" }),
    );

    // addEthereumChainParameter lets wagmi add the chain (wallet_addEthereumChain) when the wallet answers 4902.
    expect(wagmi.switchChain).toHaveBeenCalledWith({
      chainId: 1439,
      addEthereumChainParameter: {
        chainName: "Injective EVM",
        nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
        rpcUrls: ["https://rpc.ninjalabs.example"],
        blockExplorerUrls: ["https://testnet.blockscout.injective.network"],
      },
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Your wallet is connected to an unsupported network.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("distinguishes a user-rejected chain switch from other switch failures", () => {
    wagmi.account = {
      address: "0x1234567890abcdef1234567890abcdef1234cdef",
      chainId: 1,
      isConnected: true,
    };
    // wagmi's injected connector: the provider's 4001 answer is wrapped in viem's UserRejectedRequestError (itself code 4001).
    wagmi.switchError = Object.assign(new Error("User rejected the request."), {
      name: "UserRejectedRequestError",
      code: 4001,
      cause: Object.assign(new Error("User rejected the request."), { code: 4001 }),
    });
    renderWalletButton();
    expect(screen.getByRole("alert").textContent).toBe(
      "You declined the network switch. Approve it in your wallet to continue.",
    );

    cleanup();
    wagmi.switchError = Object.assign(new Error("boom"), { name: "SwitchChainError" });
    renderWalletButton();
    expect(screen.getByRole("alert").textContent).toBe(
      "The network could not be switched. Add Injective EVM to your wallet and try again.",
    );
  });

  it("never requests a chain switch when no RPC URL is configured (mock mode) and shows manual guidance instead", () => {
    wagmi.account = {
      address: "0x1234567890abcdef1234567890abcdef1234cdef",
      chainId: 1,
      isConnected: true,
    };
    const configuredChains = wagmi.config.chains;
    wagmi.config = { chains: [{ id: 1439, rpcUrls: { default: { http: [] } } }] };
    try {
      renderWalletButton();
      const button = screen.getByRole("button", { name: "Switch to Injective EVM" }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      // Without an RPC URL the wallet could not add the chain, so wagmi is not asked to switch at all (canSwitch === false).
      expect(wagmi.switchChain).not.toHaveBeenCalled();
      expect(screen.getByRole("status").textContent).toBe(
        "Automatic network switching is not configured here. Switch your wallet to Injective EVM manually, then try again.",
      );
    } finally {
      wagmi.config = { chains: configuredChains };
    }
  });

  it("builds mainnet chain-add parameters and classifies switch errors", () => {
    expect(addEthereumChainParameterFor(1776, ["https://evm.injective.network"])).toEqual({
      chainName: "Injective EVM",
      nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
      rpcUrls: ["https://evm.injective.network"],
      blockExplorerUrls: ["https://blockscout.injective.network"],
    });
    expect(addEthereumChainParameterFor(999, ["https://rpc.example"])).not.toHaveProperty("blockExplorerUrls");
    expect(addEthereumChainParameterFor(1439, [])).toBeUndefined();
    expect(switchChainErrorKind(null)).toBeNull();
    expect(switchChainErrorKind({ code: 4001 })).toBe("rejected");
    expect(switchChainErrorKind(new Error("x"))).toBe("failed");
    // Any UserRejectedRequestError in the cause chain is a rejection (wagmi wraps the post-add switch rejection without a
    // provider code 4001) - except when it wraps a provider error with a numeric code other than 4001 (the injected
    // connector wraps every wallet_addEthereumChain failure in UserRejectedRequestError).
    const wrapped = (cause: unknown) => Object.assign(new Error("User rejected the request."), { name: "UserRejectedRequestError", code: 4001, cause });
    expect(switchChainErrorKind(wrapped({ code: 4001, message: "User rejected the request." }))).toBe("rejected");
    expect(switchChainErrorKind(wrapped(Object.assign(new Error("Internal JSON-RPC error."), { code: -32603 })))).toBe("failed");
    expect(switchChainErrorKind(wrapped(new Error("User rejected switch after adding network.")))).toBe("rejected");
    expect(switchChainErrorKind(wrapped(undefined))).toBe("rejected");
    expect(switchChainErrorKind(wrapped(Object.assign(new Error("deep"), { cause: { code: -32002 } })))).toBe("failed");
    expect(switchChainErrorKind(Object.assign(new Error("switch failed"), { name: "SwitchChainError", cause: wrapped({ code: 4001 }) }))).toBe("rejected");
    expect(switchChainErrorKind(Object.assign(new Error("switch failed"), { name: "SwitchChainError", cause: wrapped(new Error("after add")) }))).toBe("rejected");
    expect(switchChainErrorKind(Object.assign(new Error("switch failed"), { name: "SwitchChainError", cause: { code: -32603 } }))).toBe("failed");
  });

  it("shows a stable connector error message", () => {
    wagmi.connectError = new Error("Connector rejected request");

    renderWalletButton();

    expect(screen.getByRole("alert").textContent).toBe(
      "Unable to connect your wallet. Try again.",
    );
  });

  it("reports an unavailable state when no compatible connector exists", () => {
    wagmi.connectors = [];

    renderWalletButton();

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
