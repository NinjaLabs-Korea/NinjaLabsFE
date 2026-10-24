"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { http } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { createInjectiveChain } from "@/components/wallet/injective-chain";

type WalletProviderProps = {
  chainId: number;
  rpcUrl?: string;
  children: ReactNode;
};

/**
 * Injected-only (browser extension) wagmi provider. The config is identical on the server and in the browser, so the
 * server HTML and the first client render agree (no hydration mismatch).
 *
 * WalletConnect is intentionally absent since the wagmi 3 upgrade (2026-10-24): RainbowKit 2.x only supports wagmi 2,
 * and wagmi 3's `walletConnect` connector needs `@walletconnect/ethereum-provider`, whose `@reown/appkit` tree still
 * carries high-severity advisories. Re-add it once a RainbowKit release supports wagmi 3 (or the WalletConnect
 * provider tree audits clean) - see AGENTS.md "Stack".
 */
export function WalletProvider({ chainId, rpcUrl, children }: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => {
    const chain = createInjectiveChain(chainId, rpcUrl);

    return createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http(rpcUrl) },
      ssr: true,
    });
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
