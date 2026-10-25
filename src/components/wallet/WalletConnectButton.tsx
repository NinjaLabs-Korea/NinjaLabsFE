"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  useWalletApi,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { shortWalletAddress, useWalletConnection } from "@/components/wallet/useWalletConnection";
import { ERROR_COPY, errorCopyKey, type ErrorCopyKey } from "@/lib/api/error-copy";
import {
  maskWalletAddress,
  onboardingErrorDetails,
  onboardingLog,
} from "@/lib/onboarding-log";

type WalletConnectButtonProps = {
  chainId: number;
  disabled?: boolean;
};

export function WalletConnectButton({
  chainId,
  disabled = false,
}: WalletConnectButtonProps) {
  const t = useTranslations("common.wallet");
  const tVerifyErrors = useTranslations(ERROR_COPY.walletVerify.messages);
  const router = useRouter();
  const apiClient = useWalletApi();
  const mode = useFoundationMode();
  const [verificationState, setVerificationState] = useState<"idle" | "pending">("idle");
  // 실패 문구 키 (`common.wallet.verifyErrors.<key>`) — BE 코드별 안내, 그 외는 generic. 실패한 주소에 묶는다:
  // 지갑을 끊고 다른 주소로 다시 연결했을 때 이전 주소의 실패("이미 연결된 지갑" 등)를 새 주소 아래에 보여 주지 않는다.
  const [verifyFailure, setVerifyFailure] = useState<{ address: string; key: ErrorCopyKey<typeof ERROR_COPY.walletVerify> } | null>(null);
  const {
    address,
    connectedChainId,
    isWrongNetwork,
    isConnected,
    connector,
    connect,
    connectError: error,
    isConnecting: isPending,
    disconnect,
    signMessageAsync,
    canSwitch,
    switchToTargetChain,
    isSwitching,
    switchError,
  } = useWalletConnection(chainId);

  const unavailable = !connector;
  const buttonClassName =
    "inline-flex min-h-11 items-center justify-center rounded-control border px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

  const verifyConnectedWallet = async () => {
    if (!address) {
      onboardingLog("wallet.verify.skipped", { reason: "NO_CONNECTED_ADDRESS" });
      return;
    }
    setVerifyFailure(null);
    setVerificationState("pending");
    const wallet = maskWalletAddress(address);
    onboardingLog("wallet.challenge.started", { wallet, chainId: connectedChainId });
    try {
      const challenge = await apiClient.createWalletChallenge(address);
      onboardingLog("wallet.challenge.succeeded", { wallet });
      onboardingLog("wallet.signature.requested", { wallet, signatureType: "EIP191" });
      const signature = await signMessageAsync({ message: challenge.message });
      onboardingLog("wallet.signature.received", { wallet });
      onboardingLog("wallet.verify.started", { wallet });
      await apiClient.verifyWallet(address, signature);
      onboardingLog("wallet.verify.succeeded", { wallet, targetPath: "/signup/profile" });
      setVerificationState("idle");
      router.push("/signup/profile");
    } catch (caught) {
      onboardingLog("wallet.verify.failed", {
        wallet,
        ...onboardingErrorDetails(caught),
      });
      setVerifyFailure({ address, key: errorCopyKey(caught, ERROR_COPY.walletVerify) });
      setVerificationState("idle");
    }
  };

  if (isWrongNetwork) {
    // No RPC URL for the configured chain (mock mode): the switch is never requested, the user is asked to switch manually.
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={`${buttonClassName} border-warning-soft bg-warning-soft text-warning`}
          disabled={disabled || isSwitching || !canSwitch}
          onClick={() => {
            onboardingLog("wallet.network-switch.requested", {
              fromChainId: connectedChainId,
              toChainId: chainId,
            });
            switchToTargetChain();
          }}
        >
          {isSwitching ? t("switching") : t("switchNetwork")}
        </button>
        <p className="text-xs text-warning" role="status">
          {canSwitch ? t("unsupportedNetwork") : t("switchUnavailable")}
        </p>
        {switchError ? (
          <p className="text-xs text-danger" role="alert">
            {t(switchError === "rejected" ? "switchRejected" : "switchFailed")}
          </p>
        ) : null}
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
            {verificationState === "pending" ? t("awaitingSignature") : t("verify")}
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-ink-muted hover:text-ink"
            disabled={verificationState === "pending"}
            onClick={() => {
              onboardingLog("wallet.disconnect.clicked", {
                wallet: maskWalletAddress(address),
              });
              disconnect();
            }}
          >
            {t("disconnectAddress", { address: shortWalletAddress(address) })}
          </button>
          {verifyFailure?.address === address ? (
            <p className="text-xs text-danger" role="alert">
              {tVerifyErrors(verifyFailure.key)}
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
        onClick={() => {
          onboardingLog("wallet.disconnect.clicked", {
            wallet: maskWalletAddress(address),
          });
          disconnect();
        }}
        aria-label={t("disconnectWalletLabel", { address: shortWalletAddress(address) })}
      >
        {shortWalletAddress(address)}
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
          {t("unavailable")}
        </button>
        <p className="text-xs text-ink-muted" role="status">
          {t("unavailableHint")}
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
        onClick={() => {
          onboardingLog("wallet.connect.clicked", {
            connectorType: connector.type,
            targetChainId: chainId,
          });
          connect();
        }}
      >
        {isPending ? t("connecting") : t("connect")}
      </button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {t("connectFailed")}
        </p>
      ) : null}
    </div>
  );
}
