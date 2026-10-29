"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

/**
 * Signup step 2 for someone whose wallet is already linked (back button after Verify, a reload, a second visit): the wallet is
 * shown read-only with a way on, instead of offering "Verify wallet" again (a second verify is a 409 `WALLET_ALREADY_LINKED`).
 * Everyone else sees `children`, the connect UI. Same rule as the account page's wallet card (`account/WalletSettings`).
 */
export function LinkedWalletGate({ children }: { children: ReactNode }) {
  const t = useTranslations("signup.wallet.linked");
  const snapshot = useAuthSnapshot();
  const address = snapshot.status === "signed-in" ? snapshot.user.walletAddress : undefined;
  if (!address) return children;
  return (
    <div className="mt-5">
      <Badge variant="success">{t("badge")}</Badge>
      <p className="mt-3 break-all text-sm font-semibold text-ink" data-testid="linked-wallet-address">{address}</p>
      <p className="mt-2 text-sm text-ink-muted">{t("note")}</p>
      <Link
        className="mt-5 block w-full rounded-control bg-primary px-5 py-3 text-center text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/signup/profile"
      >
        {t("continue")}
      </Link>
    </div>
  );
}
