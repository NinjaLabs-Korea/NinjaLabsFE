import { HOME_HINT_COOKIE } from "@/lib/auth-route";
import { hardNavigate } from "@/lib/hard-navigate";

/** One year: the hint only has to outlive a browser session; `/home` clears it as soon as the real session is gone. */
const HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Whether the browser currently carries the "finished user" hint (client only). */
export function hasHomeHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim() === `${HOME_HINT_COOKIE}=1`);
}

/** Writes or clears the hint cookie (client only). A blocked cookie jar is ignored: the hint is a convenience, not state. */
export function setHomeHint(on: boolean): void {
  if (typeof document === "undefined") return;
  if (hasHomeHint() === on) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${HOME_HINT_COOKIE}=${on ? "1" : ""}; Path=/; Max-Age=${on ? HINT_MAX_AGE_SECONDS : 0}; SameSite=Lax${secure}`;
  } catch {
    // Cookie access refused: nothing to do.
  }
}

/**
 * Leaves for the public Intro (`/<locale>`) with a FULL page load. A soft `router.replace("/")` can be answered from the
 * client router cache: while the hint cookie was set, a prefetch of `/<locale>` was a redirect to `/<locale>/home`, and that
 * cached redirect keeps winning after the hint is cleared, so the visitor stays on `/home` (stuck on its loading
 * placeholder) after signing out or deleting the account. A real navigation asks the proxy again, now without the hint.
 */
export function leaveForIntro(locale: string): void {
  if (typeof window === "undefined") return;
  setHomeHint(false);
  hardNavigate(`/${locale}`);
}
