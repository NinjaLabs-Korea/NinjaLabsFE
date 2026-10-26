"use client";

import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { stripLocale } from "@/i18n/routing";
import { resolveStartTarget, returnPathFromReferrer } from "@/lib/auth-route";

/**
 * Signup step 1 (the Google login) is only for visitors who are not signed in. A signed-in user is sent where they
 * belong (rule: `lib/auth-route.ts`): the step they still owe, or, when onboarding is finished, the page they came from
 * (home otherwise). Until the session is known, and while that redirect runs, the login is never shown.
 */
export function SignupEntryGate({ children }: { children: ReactNode }) {
  const t = useTranslations("signup.gate");
  const router = useRouter();
  const target = resolveStartTarget(useAuthSnapshot());
  const destination =
    target.kind === "resume"
      ? target.href
      : target.kind === "member"
        ? returnPathFromReferrer(document.referrer, window.location.origin, stripLocale)
        : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (target.kind === "sign-up") return children;
  return (
    <div className="mt-5" role="status">
      <p className="text-sm text-ink-muted">{t("checking")}</p>
    </div>
  );
}
