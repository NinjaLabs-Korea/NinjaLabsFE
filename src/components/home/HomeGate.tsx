"use client";

import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { resolveHomeAccess } from "@/lib/auth-route";
import { PageLoading } from "@/components/ui/PageLoading";

/**
 * Everything on `/home` (the opt-in "My activity" dashboard) renders through this gate, which follows
 * `lib/auth-route.ts resolveHomeAccess`: the dashboard only for a signed-in user who finished onboarding, the hub (`/`) for a
 * signed-out visitor, the owed onboarding step for an unfinished sign-up. While the session is restored it shows a neutral
 * checking state, never the content and never a redirect.
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const t = useTranslations("home.gate");
  const router = useRouter();
  const access = resolveHomeAccess(useAuthSnapshot(), { preview: useFoundationMode() === "mock" });
  const destination = access.kind === "intro" || access.kind === "resume" ? access.href : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (access.kind === "show") return children;
  return (
    // min-h-dvh: the real dashboard is several screens tall, so a short placeholder would let the footer jump from the top
    // of the page to the bottom (CLS ~0.4) when the session resolves. Reserving a viewport keeps the footer below the fold.
    <section className="mx-auto min-h-dvh max-w-content px-6 py-16">
      <PageLoading label={destination ? t("redirecting") : t("checking")} />
    </section>
  );
}
