"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { signInHref } from "@/lib/return-path";
import { PageLoading } from "@/components/ui/PageLoading";

export function AdminGate({ children }: { children: ReactNode }) {
  const auth = useAuthSnapshot();
  const mode = useFoundationMode();
  const t = useTranslations("admin.gate");
  // An admin who was let in and whose session then ended from outside (refresh rejected, signed out in another tab) keeps the
  // page: an open form and everything typed into it would be unmounted by the sign-in prompt. The page says so and offers a
  // sign-in in a NEW tab; that sign-in reaches this tab through the cross-tab "signed-in" event and the banner disappears.
  const [wasAdmin, setWasAdmin] = useState(false);
  if (auth.status === "signed-in" && auth.user.isAdmin && !wasAdmin) setWasAdmin(true);
  if (mode === "mock") return <>{null}{children}</>;

  if (auth.status === "signed-out" && auth.reason === "session-ended" && wasAdmin) {
    // Same element positions as the admin branch below (banner slot, then children), so the page is not remounted when
    // the session ends or comes back and the typed values survive both transitions.
    return (
      <>
        <div className="mx-auto max-w-content px-6 pt-6" role="alert">
          <div className="flex flex-wrap items-center gap-3 rounded-control border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
            <p>{t("sessionExpired")}</p>
            <Link className="font-semibold underline" href={signInHref("/admin")} rel="noopener" target="_blank">{t("signInAgain")}</Link>
          </div>
        </div>
        {children}
      </>
    );
  }

  if (auth.status !== "signed-in") {
    if (auth.status === "loading") {
      return <div className="mx-auto max-w-content px-6 py-20"><PageLoading label={t("checking")} /></div>;
    }
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">{t("signInRequired")}</h1><Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">{t("signIn")}</Link></div>;
  }
  if (!auth.user.isAdmin) {
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">{t("accessOnly")}</h1><p className="mt-3 text-ink-muted">{t("noPermission")}</p></div>;
  }
  return <>{null}{children}</>;
}
