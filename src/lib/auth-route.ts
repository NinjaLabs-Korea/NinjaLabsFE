import type { AuthSnapshot, ClientUser } from "@/lib/contracts/auth";

/**
 * The single answer to "where should this user be?". Every "Get started" / sign-in CTA and the signup entry step ask
 * this instead of re-deriving it: a page that asks a signed-in user to log in again is a bug.
 *
 * - signed out: `/signup` (step 1)
 * - signed in, onboarding unfinished: the step they owe (wallet, profile, complete)
 * - signed in, onboarding finished: nothing to start; they belong on the site (their profile / where they came from)
 */

/** The onboarding step a signed-in user still owes, or null when onboarding is finished (or there is no user). */
export function getOnboardingPath(user: ClientUser | null): string | null {
  if (!user || user.onboardingCompleted) return null;
  const step = user.onboardingStep ?? 2;
  if (step <= 2) return "/signup/wallet";
  if (step === 3) return "/signup/profile";
  return "/signup/get-started";
}

export type StartTarget =
  /** The session is still being restored: show neither "sign in" nor "continue" yet. */
  | { kind: "checking" }
  | { kind: "sign-up"; href: "/signup" }
  /** Signed in with an unfinished onboarding: `href` is the step they owe. */
  | { kind: "resume"; href: string }
  /** Signed in and onboarding finished: there is nothing to "start". */
  | { kind: "member"; href: string };

export function resolveStartTarget(snapshot: AuthSnapshot): StartTarget {
  if (snapshot.status !== "signed-in") {
    return snapshot.status === "loading" ? { kind: "checking" } : { kind: "sign-up", href: "/signup" };
  }
  const { user } = snapshot;
  const resume = getOnboardingPath(user);
  if (resume) return { kind: "resume", href: resume };
  return { kind: "member", href: `/members/${user.profileSlug}` };
}

const NOT_A_DESTINATION = /^\/(?:signup(?:\/|$)|auth\/)/;

/**
 * Where a signed-in, finished user who landed on signup step 1 goes: the same-site page they came from when there is
 * one, otherwise the home page. Returns a locale-less path (`/bounties/x?y=1`) for the locale-aware router.
 */
export function returnPathFromReferrer(referrer: string, origin: string, stripLocale: (path: string) => string): string {
  if (!referrer) return "/";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "/";
  }
  if (url.origin !== origin) return "/";
  const path = stripLocale(url.pathname);
  if (NOT_A_DESTINATION.test(path)) return "/";
  return `${path}${url.search}`;
}
