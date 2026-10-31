import type { AuthSnapshot, ClientUser } from "@/lib/contracts/auth";

/**
 * The single answer to "where should this user be?". Every "Get started" / sign-in CTA and the signup entry step ask
 * this instead of re-deriving it: a page that asks a signed-in user to log in again is a bug.
 *
 * - signed out: `/signup` (step 1)
 * - signed in, onboarding unfinished: the step they owe (wallet, profile, complete)
 * - signed in, onboarding finished: nothing to start; they belong on the site (the hub, or where they came from)
 *
 * Product decision: the community hub (`/`) is the PRIMARY service and is reachable by everyone, signed in or not, in
 * every session state. Nothing redirects away from it. `/home` is an opt-in personal dashboard ("My activity"): linked from
 * the user menu and the hub CTA, never forced. `/about` shares the hub's sections.
 */

/** The opt-in personal dashboard for users who finished onboarding (`app/[locale]/home`), the public community overview (`/about`). */
export const HOME_PATH = "/home";

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
  /** Signed in and onboarding finished: there is nothing to "start"; `href` is their profile (the hub CTA uses `HOME_PATH`, "My activity"). */
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

/** True when the session is a signed-in user who finished onboarding (the only user the home page is for). */
export function isFinishedUser(snapshot: AuthSnapshot): boolean {
  return snapshot.status === "signed-in" && snapshot.user.onboardingCompleted === true;
}

export type HomeAccess =
  /** Session still being restored: a neutral checking state, neither the home nor a redirect. */
  | { kind: "wait" }
  | { kind: "show" }
  /** Signed out: the dashboard has nothing to show; back to the hub. */
  | { kind: "intro"; href: "/" }
  /** Signed in with an unfinished onboarding: the step they owe. */
  | { kind: "resume"; href: string };

/**
 * What `/home` does for the session. `preview` (mock mode, where the preview user has no onboarding fields) shows the home
 * to any signed-in session so the screen stays reviewable without a backend.
 */
export function resolveHomeAccess(snapshot: AuthSnapshot, options: { preview?: boolean } = {}): HomeAccess {
  if (snapshot.status === "loading") return { kind: "wait" };
  if (snapshot.status === "signed-out") return { kind: "intro", href: "/" };
  if (options.preview) return { kind: "show" };
  const resume = getOnboardingPath(snapshot.user);
  return resume ? { kind: "resume", href: resume } : { kind: "show" };
}

const NOT_A_DESTINATION = /^\/(?:signup(?:\/|$)|auth\/)/;

/**
 * Where a signed-in, finished user who landed on signup step 1 goes: the same-site page they came from when there is
 * one, otherwise the hub (`/`). Returns a locale-less path (`/bounties/x?y=1`) for the locale-aware router.
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

export type SignupStep = 1 | 2 | 3 | 4;

export type SignupAccess =
  /** Session still being restored: show a neutral checking state, neither the step nor a redirect. */
  | { kind: "wait" }
  /** The step may render. */
  | { kind: "show" }
  /** Signed out on step 2-4: back to step 1, with a message saying why. */
  | { kind: "sign-in-first"; href: "/signup" }
  /** Signed in with an unfinished onboarding on step 1: straight to the step they owe. */
  | { kind: "resume"; href: string }
  /** Signed in and finished: no signup page applies any more; leave for the hub or the page they came from. */
  | { kind: "leave" };

/**
 * What a `/signup*` page does for the current session. Step 1 (the login) exists for signed-out visitors only; steps
 * 2-4 exist for signed-in users who still owe onboarding; a finished user has no business on any of them. Signed-out
 * visitors on step 2-4 are sent to step 1, never shown a broken page.
 */
export function resolveSignupAccess(snapshot: AuthSnapshot, step: SignupStep): SignupAccess {
  const target = resolveStartTarget(snapshot);
  switch (target.kind) {
    case "checking":
      return { kind: "wait" };
    case "sign-up":
      return step === 1 ? { kind: "show" } : { kind: "sign-in-first", href: "/signup" };
    case "member":
      return { kind: "leave" };
    case "resume":
      return step === 1 ? { kind: "resume", href: target.href } : { kind: "show" };
  }
}
