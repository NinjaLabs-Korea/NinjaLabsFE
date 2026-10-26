"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import type { WalletConfig } from "@/lib/runtime/config";

/**
 * The wallet card of the account page. Someone who chose "connect later" during signup connects here (same challenge, signature
 * and verify as signup step 2, reusing `WalletConnectButton`). A linked wallet is shown read-only: the BE keeps one primary wallet
 * per account and has no unlink endpoint, so there is nothing to disconnect here.
 */
export function WalletSettings({ wallet }: { wallet: WalletConfig | null }) {
  const t = useTranslations("account.settings.wallet");
  const snapshot = useAuthSnapshot();
  const { refresh } = useAuthActions();
  const headingId = useId();
  if (snapshot.status !== "signed-in") return null;
  const address = snapshot.user.walletAddress;
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-border bg-surface p-6 shadow-card" id="wallet">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink" id={headingId}>{t("heading")}</h2>
        <Badge variant={address ? "success" : "warning"}>{address ? t("connected") : t("notConnected")}</Badge>
      </div>
      {address ? (
        <>
          <p className="mt-3 break-all text-sm font-semibold text-ink">{address}</p>
          <p className="mt-2 text-sm text-ink-muted">{t("linkedNote")}</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink-muted">{t("body")}</p>
          <div className="mt-4 [&_button]:w-full sm:[&_button]:w-auto">
            {wallet ? (
              <WalletProvider chainId={wallet.chainId} rpcUrl={wallet.rpcUrl}>
                <WalletConnectButton chainId={wallet.chainId} onVerified={() => void refresh?.().catch(() => undefined)} />
              </WalletProvider>
            ) : (
              <p className="text-xs text-ink-muted" role="status">{t("unavailable")}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
