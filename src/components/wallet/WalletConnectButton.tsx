"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import {
  useFoundationApiClient,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";

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
  const router = useRouter();
  const apiClient = useFoundationApiClient();
  const mode = useFoundationMode();
  const [verificationState, setVerificationState] = useState<"idle" | "pending" | "error">("idle");
  const hasInjectedWallet = useSyncExternalStore(
    () => () => undefined,
    () => "ethereum" in window,
    () => false,
  );
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
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

  const verifyConnectedWallet = async () => {
    if (!address) return;
    setVerificationState("pending");
    try {
      const challenge = await apiClient.createWalletChallenge(address);
      const signature = await signMessageAsync({ message: challenge.message });
      await apiClient.verifyWallet(address, signature);
      setVerificationState("idle");
      router.push("/signup/profile");
    } catch {
      setVerificationState("error");
    }
  };

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
    if (mode === "api") {
      return (
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            className={`${buttonClassName} border-primary bg-primary text-on-inverse hover:bg-primary-strong`}
            disabled={disabled || verificationState === "pending"}
            onClick={() => void verifyConnectedWallet()}
          >
            {verificationState === "pending" ? "Waiting for signature…" : "Verify wallet"}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-ink-muted hover:text-ink"
            disabled={verificationState === "pending"}
            onClick={() => disconnect()}
          >
            Disconnect {formatAddress(address)}
          </button>
          {verificationState === "error" ? (
            <p className="text-xs text-danger" role="alert">
              Wallet verification failed. Check the signature request and try again.
            </p>
          ) : null}
        </div>
      );
    }

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
