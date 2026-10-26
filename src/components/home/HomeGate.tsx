"use client";

import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { resolveHomeAccess } from "@/lib/auth-route";
import { setHomeHint } from "@/lib/home-hint";

/**
 * Everything on `/home` renders through this gate, which follows `lib/auth-route.ts resolveHomeAccess`: the home only for a
 * signed-in user who finished onboarding, the Intro for a signed-out visitor (clearing the `ninja_home` hint so `proxy.ts` stops
 * sending them back here), the owed onboarding step for an unfinished sign-up. While the session is restored it shows a neutral
 * checking state, never the content and never a redirect.
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const t = useTranslations("home.gate");
  const router = useRouter();
  const access = resolveHomeAccess(useAuthSnapshot(), { preview: useFoundationMode() === "mock" });
  const destination = access.kind === "intro" || access.kind === "resume" ? access.href : null;
  const leavingForIntro = access.kind === "intro";

  useEffect(() => {
    if (!destination) return;
    if (leavingForIntro) setHomeHint(false);
    router.replace(destination);
  }, [destination, leavingForIntro, router]);

  if (access.kind === "show") return children;
  return (
    <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
      <p className="text-sm text-ink-muted" role="status">{destination ? t("redirecting") : t("checking")}</p>
    </section>
  );
}
