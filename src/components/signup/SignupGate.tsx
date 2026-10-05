"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";

/** Sign-up steps 2-4 need a backend session in API mode; mock mode keeps the screens previewable. */
export function SignupGate({ children }: { children: ReactNode }) {
  const t = useTranslations("signup.gate");
  const mode = useFoundationMode();
  const auth = useAuthSnapshot();

  if (mode === "mock" || auth.status === "signed-in") return children;

  if (auth.status === "loading") {
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]" role="status">
        <p className="text-sm text-ink-muted">{t("checking")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
      <p className="text-sm font-semibold text-ink">{t("title")}</p>
      <p className="mt-1 text-sm text-ink-muted">{t("body")}</p>
      <Link
        className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/signup"
      >
        {t("cta")}
      </Link>
    </div>
  );
}
