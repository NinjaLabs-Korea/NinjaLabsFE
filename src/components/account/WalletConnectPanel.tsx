"use client";

import { useEffect, useRef } from "react";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import type { WalletConfig } from "@/lib/runtime/config";

/**
 * The wagmi/viem half of the account wallet card. `WalletSettings` loads this module with `next/dynamic` only when a signed-in
 * user without a linked wallet presses Connect, so every other /account visit ships no wallet stack.
 */
export default function WalletConnectPanel({ wallet, onVerified, autoStart = false }: { wallet: WalletConfig; onVerified: () => void; autoStart?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  // `autoStart`: the card's first "Connect wallet" click opens this panel, so the panel presses its own connect button once.
  // The connector can appear a tick after mount, so wait (briefly) for an enabled button; with no wallet it stays disabled
  // and the panel keeps its normal "unavailable" state.
  useEffect(() => {
    const host = hostRef.current;
    if (!autoStart || !host) return;
    const press = () => {
      if (started.current) return true;
      const button = host.querySelector<HTMLButtonElement>("button:not([disabled])");
      if (!button) return false;
      started.current = true;
      button.click();
      return true;
    };
    if (press()) return;
    const observer = new MutationObserver(() => { if (press()) observer.disconnect(); });
    observer.observe(host, { attributes: true, childList: true, subtree: true });
    const timer = window.setTimeout(() => observer.disconnect(), 1500);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [autoStart]);
  return (
    <div ref={hostRef}>
      <WalletProvider chainId={wallet.chainId} rpcUrl={wallet.rpcUrl}>
        <WalletConnectButton chainId={wallet.chainId} onVerified={onVerified} />
      </WalletProvider>
    </div>
  );
}
