"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { useRouter } from "@/i18n/navigation";
import { stripLocale } from "@/i18n/routing";
import { pushFlash } from "@/lib/flash";
import { resolveSignupAccess, returnPathFromReferrer, type SignupAccess, type SignupStep } from "@/lib/auth-route";
import { PageLoading } from "@/components/ui/PageLoading";

/**
 * Every signup page (`step` 1-4) renders through this gate, which follows `lib/auth-route.ts resolveSignupAccess`:
 * the login (step 1) only for signed-out visitors, steps 2-4 only for a signed-in user who still owes onboarding, and
 * a redirect for everyone else (never a flash of the wrong step). Mock mode keeps steps 2-4 previewable signed out.
 * Once a step has rendered it stays: finishing onboarding on the last step must not bounce the user off the page
 * that celebrates it, and a session that ends mid-step must not wipe what the user typed.
 */
export function SignupGate({ children, step }: { children: ReactNode; step: SignupStep }) {
  const t = useTranslations("signup.gate");
  const mode = useFoundationMode();
  const router = useRouter();
  const snapshot = useAuthSnapshot();
  const [shown, setShown] = useState(false);

  let access: SignupAccess = resolveSignupAccess(snapshot, step);
  if (mode === "mock" && step > 1 && snapshot.status === "signed-out") access = { kind: "show" };
  if (access.kind === "show" && !shown) setShown(true);
  // A session that ends while a step is open (revoked, expired, signed out in another tab) must not tear the step down:
  // the form the user is typing into stays, and says why it cannot save (ProfileForm shows the session message).
  // A deliberate sign-out (no `session-ended` reason) is not such a session: the step is left like any other gated page.
  const deliberateSignOut = snapshot.status === "signed-out" && snapshot.reason !== "session-ended";
  if (shown && !deliberateSignOut && (access.kind === "leave" || access.kind === "sign-in-first")) access = { kind: "show" };

  const destination =
    access.kind === "resume" || access.kind === "sign-in-first"
      ? access.href
      : access.kind === "leave"
        ? returnPathFromReferrer(document.referrer, window.location.origin, stripLocale)
        : null;

  useEffect(() => {
    if (!destination) return;
    // Not after a sign-out the user just chose: "sign in to continue" would answer a request nobody made.
    if (access.kind === "sign-in-first" && !shown) pushFlash("signInRequired");
    router.replace(destination);
  }, [access.kind, destination, router, shown]);

  if (access.kind === "show") return children;
  return (
    <PageLoading className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]" label={t("checking")} variant="list" />
  );
}
