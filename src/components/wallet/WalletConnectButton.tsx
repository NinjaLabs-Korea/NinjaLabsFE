"use client";

import { useSyncExternalStore } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

type WalletConnectButtonProps = {
  chainId: number;
  disabled?: boolean;
};

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnectButton({
  chainId,
  disabled = false,
}: WalletConnectButtonProps) {
  const hasInjectedWallet = useSyncExternalStore(
    () => () => undefined,
    () => "ethereum" in window,
    () => false,
  );
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isWrongNetwork = isConnected && connectedChainId !== chainId;
  const injectedConnector = connectors.find(
    (connector) => connector.type === "injected",
  );
  const walletConnectConnector = connectors.find(
    (connector) => connector.type === "walletConnect",
  );

  const connector = hasInjectedWallet
    ? injectedConnector
    : walletConnectConnector;

  const unavailable = !connector;
  const buttonClassName =
    "inline-flex min-h-11 items-center justify-center rounded-control border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

  if (isWrongNetwork) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={`${buttonClassName} border-warning-soft bg-warning-soft text-warning`}
          disabled={disabled || isSwitching}
          onClick={() => switchChain({ chainId })}
        >
          {isSwitching ? "Switching network…" : "Switch to Injective EVM"}
        </button>
        <p className="text-xs text-warning" role="status">
          Your wallet is connected to an unsupported network.
        </p>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <button
        type="button"
        className={`${buttonClassName} border-primary-soft-border bg-primary-soft text-primary-strong`}
        disabled={disabled}
        onClick={() => disconnect()}
        aria-label={`Disconnect wallet ${formatAddress(address)}`}
      >
        {formatAddress(address)}
      </button>
    );
  }

  if (unavailable) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={`${buttonClassName} border-border bg-surface text-ink-secondary`}
          disabled
        >
          Wallet unavailable
        </button>
        <p className="text-xs text-ink-muted" role="status">
          Install or unlock a compatible browser wallet to connect.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className={`${buttonClassName} border-primary bg-primary text-on-inverse hover:bg-primary-strong`}
        disabled={disabled || isPending}
        onClick={() => connect({ connector })}
      >
        {isPending ? "Connecting wallet…" : "Connect wallet"}
      </button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          Unable to connect your wallet. Try again.
        </p>
      ) : null}
    </div>
  );
}
