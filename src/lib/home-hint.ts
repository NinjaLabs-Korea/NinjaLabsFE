import { HOME_HINT_COOKIE } from "@/lib/auth-route";

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
