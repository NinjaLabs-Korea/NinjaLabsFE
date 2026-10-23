"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { connectorsForWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { http } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { createInjectiveChain } from "@/components/wallet/injective-chain";

/**
 * WalletConnect + injected wallets through RainbowKit. Only `wallet/WalletProvider` renders this, via `next/dynamic`,
 * and only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set, so the RainbowKit bundle and stylesheet stay out of
 * the injected-only chunk. The stylesheet import is the one vendor CSS the Tailwind-only rule allows (docs/design.md).
 */
export function RainbowKitWalletProvider({
  chainId,
  rpcUrl,
  walletConnectProjectId,
  children,
}: {
  chainId: number;
  rpcUrl?: string;
  walletConnectProjectId: string;
  children: ReactNode;
}) {
  const t = useTranslations("common.wallet");
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() => {
    const chain = createInjectiveChain(chainId, rpcUrl);

    return createConfig({
      chains: [chain],
      connectors: connectorsForWallets(
        [
          {
            groupName: t("supportedWallets"),
            wallets: [injectedWallet, walletConnectWallet],
          },
        ],
        {
          appName: "Ninja Labs",
          projectId: walletConnectProjectId,
        },
      ),
      transports: { [chain.id]: http(rpcUrl) },
      ssr: true,
    });
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={chainId}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
