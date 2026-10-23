import type { Chain } from "viem";

/** wagmi chain definition shared by the injected-only and RainbowKit wallet providers. */
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
