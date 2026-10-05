"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";

export function AdminGate({ children }: { children: ReactNode }) {
  const auth = useAuthSnapshot();
  const mode = useFoundationMode();
  const t = useTranslations("admin.gate");
  if (mode === "mock") return children;

  if (auth.status !== "signed-in") {
    if (auth.status === "loading") {
      return <div className="mx-auto max-w-content px-6 py-20 text-sm text-ink-muted">{t("checking")}</div>;
    }
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">{t("signInRequired")}</h1><Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">{t("signIn")}</Link></div>;
  }
  if (!auth.user.isAdmin) {
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">{t("accessOnly")}</h1><p className="mt-3 text-ink-muted">{t("noPermission")}</p></div>;
  }
  return children;
}
