import type { Chain } from "viem";

/** wagmi chain definition for `wallet/WalletProvider` (also read back by `useWalletConnection` for chain-add parameters). */
export function createInjectiveChain(chainId: number, rpcUrl?: string): Chain {
  return {
    id: chainId,
    name: "Injective EVM",
    nativeCurrency: {
      name: "Injective",
      symbol: "INJ",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: rpcUrl ? [rpcUrl] : [] },
    },
  };
}
