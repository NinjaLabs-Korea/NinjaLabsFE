"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";

export default function AuthCallbackPage() {
  const t = useTranslations("signup.authCallback");
  const { status } = useAuthSnapshot();
  const failed = status === "signed-out";
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <h1 className="font-display text-2xl text-ink">{failed ? t("failedTitle") : t("signingIn")}</h1>
      <p className="mt-3 text-sm text-ink-muted" role="status">
        {failed ? t("failedBody") : t("restoring")}
      </p>
      {failed ? (
        <Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">
          {t("backToSignIn")}
        </Link>
      ) : null}
    </div>
  );
}
