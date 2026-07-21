"use client";

import {
  connectorsForWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { type Chain, http } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";

type WalletProviderProps = {
  chainId: number;
  rpcUrl?: string;
  walletConnectProjectId?: string;
  children: ReactNode;
};

function createInjectiveChain(chainId: number, rpcUrl?: string): Chain {
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

export function WalletProvider({
  chainId,
  rpcUrl,
  walletConnectProjectId,
  children,
}: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => {
    const chain = createInjectiveChain(chainId, rpcUrl);

    return createConfig({
      chains: [chain],
      connectors: walletConnectProjectId
        ? connectorsForWallets(
            [
              {
                groupName: "Supported wallets",
                wallets: [injectedWallet, walletConnectWallet],
              },
            ],
            {
              appName: "Ninja Labs",
              projectId: walletConnectProjectId,
            },
          )
        : [injected()],
      transports: { [chain.id]: http(rpcUrl) },
      ssr: true,
    });
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {walletConnectProjectId ? (
          <RainbowKitProvider initialChain={chainId}>{children}</RainbowKitProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
