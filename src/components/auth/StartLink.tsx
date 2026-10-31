"use client";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { resolveStartTarget } from "@/lib/auth-route";
import { useMemberHint } from "@/lib/foundation/session-hint";

type StartLinkProps = {
  className: string;
  /** Signed out: the original "Get started" label. */
  signUpLabel: string;
  /** Signed in, onboarding unfinished: continues at the step they owe. */
  resumeLabel: string;
  /** Signed in, onboarding finished: there is nothing to start, so the CTA opens `memberHref` (their profile unless overridden). */
  memberLabel: string;
  /** Where a finished user goes instead of their profile (the hub sends them to their dashboard, `HOME_PATH`). */
  memberHref?: string;
};

/**
 * A "Get started" call to action that follows the auth state (rule: `lib/auth-route.ts`). While the session is being
 * restored it keeps its box but hides itself, so a signed-in visitor never sees (or clicks) a sign-up link and the page does not shift when the label arrives.
 * A browser whose last session was a finished member shows the member link right away (see `useMemberHint`).
 */
export function StartLink({ className, signUpLabel, resumeLabel, memberLabel, memberHref }: StartLinkProps) {
  const target = resolveStartTarget(useAuthSnapshot());
  const likelyMember = useMemberHint();

  // A returning member (`useMemberHint`) gets the member link at hydration instead of waiting for the session restore.
  // Only with a fixed `memberHref`: the default target (their profile) needs the slug, which only the restore knows.
  // Same element and classes as the confirmed member link below, so confirming the session does not restart the fade.
  const linkClassName = `${className} animate-fade-in motion-reduce:animate-none`;
  if (target.kind === "checking" && likelyMember && memberHref) {
    return (
      <Link className={linkClassName} href={memberHref}>
        {memberLabel}
      </Link>
    );
  }

  if (target.kind === "checking") {
    return (
      <span aria-hidden="true" className={`${className} invisible`}>
        {signUpLabel}
      </span>
    );
  }

  const label = target.kind === "sign-up" ? signUpLabel : target.kind === "resume" ? resumeLabel : memberLabel;
  return (
    // Fades in when it replaces the hidden placeholder, so the CTA does not pop in once the session is known.
    <Link className={linkClassName} href={target.kind === "member" && memberHref ? memberHref : target.href}>
      {label}
    </Link>
  );
}
