// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { addEthereumChainParameterFor, switchChainErrorKind } from "@/components/wallet/useWalletConnection";
import { FoundationProvider } from "@/components/auth/FoundationProvider";
import { renderWithIntl } from "@/test/intl";

// Mock-mode FoundationProvider imports its client lazily; warm the module graph so synchronous tests do not leave that
// import resolving after the jsdom environment is torn down.
await import("@/lib/mocks/api-client");

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
  http: vi.fn((url?: string) => ({ url })),
  queryClientProvider: vi.fn(),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  wagmi.createConfig.mockImplementation(actual.createConfig as never);
  // wagmi 3 shapes: `useConnection` (was useAccount), `useConnectors`, and TanStack-style `mutate`/`mutateAsync` mutations.
  return {
  useConnection: () => wagmi.account,
  useConnectors: () => wagmi.connectors,
  useConnect: () => ({
    mutate: wagmi.connect,
    error: wagmi.connectError,
    isPending: wagmi.isConnecting,
  }),
  useDisconnect: () => ({ mutate: wagmi.disconnect }),
  useSignMessage: () => ({ mutateAsync: wagmi.signMessage }),
  useSwitchChain: () => ({
    mutate: wagmi.switchChain,
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


const previewUser = {
  id: "demo-user",
  handle: "demo",
  initials: "DU",
  profileSlug: "demo",
};

/** The latest Config the provider handed to WagmiProvider (built by wagmi's real createConfig). */
function providedConfig(): Config {
  expect(wagmi.providerConfig).toHaveBeenCalled();
  return wagmi.providerConfig.mock.lastCall?.[0] as Config;
}

describe("WalletProvider", () => {
  beforeEach(() => {
    wagmi.createConfig.mockClear();
    wagmi.providerConfig.mockClear();
    walletPrimitives.injected.mockClear();
    walletPrimitives.http.mockClear();
    walletPrimitives.queryClientProvider.mockClear();
  });

  it("builds an SSR-safe injected-only wagmi config for the Injective chain", () => {
    renderWithIntl(
      <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
        <WalletProvider chainId={1439} rpcUrl="https://rpc.ninjalabs.example">
          <span>Wallet content</span>
        </WalletProvider>
      </FoundationProvider>,
    );

    expect(screen.getByText("Wallet content")).toBeTruthy();
    expect(walletPrimitives.injected).toHaveBeenCalledOnce();
    expect(walletPrimitives.http).toHaveBeenCalledWith("https://rpc.ninjalabs.example");
    expect(wagmi.createConfig).toHaveBeenCalledOnce();
    expect(walletPrimitives.queryClientProvider).toHaveBeenCalled();
    // wagmi's real createConfig output: one Injective chain, its transport keyed by chain id, SSR mode, injected connector.
    const config = providedConfig();
    expect(config.chains.map((chain) => chain.id)).toEqual([1439]);
    expect(config.chains[0].rpcUrls.default.http).toEqual(["https://rpc.ninjalabs.example"]);
    expect(config.chains[0].nativeCurrency).toEqual({ name: "Injective", symbol: "INJ", decimals: 18 });
    expect(Object.keys(config._internal.transports)).toEqual(["1439"]);
    expect(config._internal.transports[1439]).toEqual({ url: "https://rpc.ninjalabs.example" });
    expect(config._internal.ssr).toBe(true);
    expect(config.connectors.map((connector) => connector.type)).toEqual(["injected"]);
  });

  it("keeps the chain RPC list empty without an RPC URL (mock mode)", () => {
    renderWithIntl(
      <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
        <WalletProvider chainId={1439}>
          <span>Wallet content</span>
        </WalletProvider>
      </FoundationProvider>,
    );
    expect(screen.getByText("Wallet content")).toBeTruthy();

    expect(walletPrimitives.http).toHaveBeenCalledWith(undefined);
    const config = providedConfig();
    expect(config.chains.map((chain) => chain.id)).toEqual([1439]);
    expect(config.chains[0].rpcUrls.default.http).toEqual([]);
    expect(Object.keys(config._internal.transports)).toEqual(["1439"]);
    expect(config._internal.ssr).toBe(true);
    expect(config.connectors.map((connector) => connector.type)).toEqual(["injected"]);
  });

});

describe("useWalletConnection helpers", () => {
  it("builds mainnet chain-add parameters and classifies switch errors", () => {
    expect(addEthereumChainParameterFor(1776, ["https://evm.injective.network"])).toEqual({
      chainName: "Injective EVM",
      nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
      rpcUrls: ["https://evm.injective.network"],
      blockExplorerUrls: ["https://blockscout.injective.network"],
    });
    // Only the mainnet entry is plain "Injective EVM"; the testnet is labelled so the wallet's two entries differ.
    expect(addEthereumChainParameterFor(1439, ["https://rpc.example"])?.chainName).toBe("Injective EVM Testnet");
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
});
