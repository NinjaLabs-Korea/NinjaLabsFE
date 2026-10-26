"use client";

import { useEffect } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { resolveIntroAccess } from "@/lib/auth-route";

/**
 * Renders nothing. A user who finished onboarding does not belong on the Intro (`/`): once the session says so, replace the
 * route with their home (`lib/auth-route.ts resolveIntroAccess`). This is the fallback for a browser without the `ninja_home`
 * hint cookie; with it, `proxy.ts` already redirected before the Intro rendered. The Intro content stays at `/about`.
 */
export function IntroRedirect() {
  const router = useRouter();
  const access = resolveIntroAccess(useAuthSnapshot());
  const home = access.kind === "home" ? access.href : null;
  useEffect(() => {
    if (home) router.replace(home);
  }, [home, router]);
  return null;
}
