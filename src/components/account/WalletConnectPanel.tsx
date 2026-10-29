"use client";

import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import type { WalletConfig } from "@/lib/runtime/config";

/**
 * The wagmi/viem half of the account wallet card. `WalletSettings` loads this module with `next/dynamic` only when a signed-in
 * user without a linked wallet presses Connect, so every other /account visit ships no wallet stack.
 */
export default function WalletConnectPanel({ wallet, onVerified }: { wallet: WalletConfig; onVerified: () => void }) {
  return (
    <WalletProvider chainId={wallet.chainId} rpcUrl={wallet.rpcUrl}>
      <WalletConnectButton chainId={wallet.chainId} onVerified={onVerified} />
    </WalletProvider>
  );
}
