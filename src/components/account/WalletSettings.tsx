"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import type { WalletConfig } from "@/lib/runtime/config";

/** wagmi/viem stay out of the page bundle until Connect is pressed (the linked-wallet display never needs them). */
const loadPanel = () => import("@/components/account/WalletConnectPanel");
const connectClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-primary bg-primary px-4 py-2 text-sm font-semibold text-on-inverse transition hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

/** Same size and look as the real Connect button, so the card does not shift while the chunk loads. */
function PanelLoading() {
  const t = useTranslations("common.wallet");
  return <button className={connectClass} disabled type="button">{t("connecting")}</button>;
}

const WalletConnectPanel = dynamic(loadPanel, { ssr: false, loading: () => <PanelLoading /> });

/**
 * The wallet card of the account page. Someone who chose "connect later" during signup connects here (same challenge, signature
 * and verify as signup step 2, reusing `WalletConnectButton`). A linked wallet is shown read-only: the BE keeps one primary wallet
 * per account and has no unlink endpoint, so there is nothing to disconnect here.
 */
export function WalletSettings({ wallet }: { wallet: WalletConfig | null }) {
  const t = useTranslations("account.settings.wallet");
  const snapshot = useAuthSnapshot();
  const { refresh } = useAuthActions();
  const tCommon = useTranslations("common.wallet");
  const headingId = useId();
  const [panelOpen, setPanelOpen] = useState(false);
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
              panelOpen ? (
                <WalletConnectPanel onVerified={() => void refresh?.().catch(() => undefined)} wallet={wallet} />
              ) : (
                <button
                  className={connectClass}
                  onClick={() => setPanelOpen(true)}
                  onFocus={() => void loadPanel()}
                  onPointerEnter={() => void loadPanel()}
                  type="button"
                >
                  {tCommon("connect")}
                </button>
              )
            ) : (
              <p className="text-xs text-ink-muted" role="status">{t("unavailable")}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
