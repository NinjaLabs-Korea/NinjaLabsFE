"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { createContext, type ReactNode, useContext, useState } from "react";
import { http } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { createInjectiveChain } from "@/components/wallet/injective-chain";

type WalletProviderProps = {
  chainId: number;
  rpcUrl?: string;
  walletConnectProjectId?: string;
  children: ReactNode;
};

type InjectedWalletProviderProps = Omit<WalletProviderProps, "walletConnectProjectId">;

// What the RainbowKit chunk's loading fallback renders: the same children inside the injected-only provider.
const PendingWalletContext = createContext<InjectedWalletProviderProps | null>(null);

/**
 * Server render and the first client render of the RainbowKit branch: the injected-only shell. RainbowKit's
 * `connectorsForWallets` lists different connectors on the server and in the browser (wallet detection), which made the
 * button hydrate against mismatching markup; the shell's wagmi config is identical on both sides, so the HTML agrees.
 */
function InjectedWalletShell() {
  const pending = useContext(PendingWalletContext);
  return pending ? <InjectedWalletProvider {...pending} /> : null;
}

// RainbowKit (+ its stylesheet) is loaded only when a WalletConnect project id is configured, and only in the browser
// (`ssr: false`); the injected-only branch below never pulls it into the chunk.
const RainbowKitWalletProvider = dynamic(
  () => import("@/components/wallet/RainbowKitWalletProvider").then((module) => module.RainbowKitWalletProvider),
  { ssr: false, loading: InjectedWalletShell },
);

export function WalletProvider({
  chainId,
  rpcUrl,
  walletConnectProjectId,
  children,
}: WalletProviderProps) {
  if (walletConnectProjectId) {
    return (
      <PendingWalletContext.Provider value={{ chainId, rpcUrl, children }}>
        <RainbowKitWalletProvider chainId={chainId} rpcUrl={rpcUrl} walletConnectProjectId={walletConnectProjectId}>
          {children}
        </RainbowKitWalletProvider>
      </PendingWalletContext.Provider>
    );
  }
  return <InjectedWalletProvider chainId={chainId} rpcUrl={rpcUrl}>{children}</InjectedWalletProvider>;
}

function InjectedWalletProvider({ chainId, rpcUrl, children }: InjectedWalletProviderProps) {
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
