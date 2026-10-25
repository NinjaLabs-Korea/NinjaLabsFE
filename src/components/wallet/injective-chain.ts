import type { Chain } from "viem";

/**
 * Display name a wallet shows for the chain. The testnet says so: `wallet_addEthereumChain` registers it next to the
 * mainnet entry, and two networks both named "Injective EVM" are easy to confuse when signing or sending funds.
 */
export function injectiveChainName(chainId: number): string {
  return chainId === 1439 ? "Injective EVM Testnet" : "Injective EVM";
}

/** wagmi chain definition for `wallet/WalletProvider` (also read back by `useWalletConnection` for chain-add parameters). */
export function createInjectiveChain(chainId: number, rpcUrl?: string): Chain {
  return {
    id: chainId,
    name: injectiveChainName(chainId),
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
