"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { getLoginCallbackError } from "@/lib/api/oauth";

export default function AuthCallbackPage() {
  const t = useTranslations("signup.authCallback");
  const { status } = useAuthSnapshot();
  const failed = status === "signed-out";
  // Set synchronously while the adapter parsed `#error=<CODE>`; only read once the sign-in has failed (never on the server).
  const errorCode = failed ? getLoginCallbackError() : null;
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <h1 className="font-display text-2xl text-ink">{failed ? t("failedTitle") : t("signingIn")}</h1>
      <p className="mt-3 text-sm text-ink-muted" role="status">
        {errorCode ? t(`errors.${errorCode}`) : failed ? t("failedBody") : t("restoring")}
      </p>
      {failed ? (
        <Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">
          {t("backToSignIn")}
        </Link>
      ) : null}
    </div>
  );
}
