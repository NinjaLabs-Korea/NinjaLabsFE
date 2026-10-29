"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { clearReturnPath, peekReturnPath } from "@/lib/return-path";

const subscribe = () => () => undefined;
// The server and hydration see no path (sessionStorage is client-only); the client re-reads right after hydrating.
const getServerPath = () => null;

/**
 * Signup's last step offers the page that asked for the sign-in (`lib/return-path.ts`), e.g. the recruitment application, when
 * the visitor had to finish onboarding first. Renders nothing without a remembered path (read after mount: sessionStorage is client-only).
 */
export function ReturnPathNotice() {
  const t = useTranslations("signup.getStarted.returnNotice");
  const path = useSyncExternalStore(subscribe, peekReturnPath, getServerPath);
  if (!path) return null;
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-tile border border-border bg-primary-soft p-4 text-left sm:flex-row sm:items-center">
      <p className="text-sm text-ink-notice">{t("message")}</p>
      <Link
        className="rounded-control bg-primary px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={path}
        onClick={clearReturnPath}
      >
        {t("cta")}
      </Link>
    </div>
  );
}
