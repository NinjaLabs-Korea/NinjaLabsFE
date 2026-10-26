"use client";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { resolveStartTarget } from "@/lib/auth-route";

type StartLinkProps = {
  className: string;
  /** Signed out: the original "Get started" label. */
  signUpLabel: string;
  /** Signed in, onboarding unfinished: continues at the step they owe. */
  resumeLabel: string;
  /** Signed in, onboarding finished: there is nothing to start, so the CTA opens their profile. */
  memberLabel: string;
};

/**
 * A "Get started" call to action that follows the auth state (rule: `lib/auth-route.ts`). While the session is being
 * restored it keeps its box but hides itself, so a signed-in visitor never sees (or clicks) a sign-up link.
 */
export function StartLink({ className, signUpLabel, resumeLabel, memberLabel }: StartLinkProps) {
  const target = resolveStartTarget(useAuthSnapshot());

  if (target.kind === "checking") {
    return (
      <span aria-hidden="true" className={`${className} invisible`}>
        {signUpLabel}
      </span>
    );
  }

  const label = target.kind === "sign-up" ? signUpLabel : target.kind === "resume" ? resumeLabel : memberLabel;
  return (
    <Link className={className} href={target.href}>
      {label}
    </Link>
  );
}
