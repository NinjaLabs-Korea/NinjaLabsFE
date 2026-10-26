"use client";

import { useTranslations } from "next-intl";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { signInHref } from "@/lib/return-path";

export function SignedOutPanel({ message, returnTo }: { message: string; /** Locale-less page to come back to after signing in. */ returnTo?: string }) {
  const t = useTranslations("account.signedOut");
  const tCommon = useTranslations("account.common");
  const snapshot = useAuthSnapshot();
  // The session could not be checked (refresh or /auth/me answered 5xx/429 or never arrived) while the cookie is kept: the
  // visitor is probably still signed in, so do not tell them to sign in; offer a retry (a reload re-runs the restore).
  if (snapshot.status === "signed-out" && snapshot.reason === "unavailable") {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
        <p className="text-sm font-semibold text-ink">{tCommon("sessionUnavailableTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{tCommon("unavailableBody")}</p>
        <button
          className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => window.location.reload()}
          type="button"
        >
          {tCommon("retry")}
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
      <p className="text-sm font-semibold text-ink">{message}</p>
      <p className="mt-1 text-sm text-ink-muted">{t("body")}</p>
      <Link
        className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={returnTo ? signInHref(returnTo) : "/signup"}
      >
        {t("cta")}
      </Link>
    </div>
  );
}
