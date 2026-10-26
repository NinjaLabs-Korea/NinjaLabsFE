/**
 * "Where to go after sign-in": a same-site path remembered in this tab across the Google round trip.
 * `/recruit` (and any login-gated screen) sends a signed-out visitor to `/signup?returnTo=/recruit`; the sign-in button
 * stores the path before leaving for Google, and the callback goes there once onboarding is finished (an unfinished
 * onboarding keeps the path, and the last signup step offers it). Paths are locale-less, like every `@/i18n/navigation` href.
 */
export const RETURN_PATH_STORAGE_KEY = "ninja.returnTo";

const MAX_LENGTH = 200;
// Where a return would loop or leave the product surface: the sign-up steps and the OAuth callback.
const NOT_A_RETURN_TARGET = /^\/(?:signup(?:\/|$|\?)|auth\/|api\/)/;

/** A same-site absolute path (`/recruit`, `/bounties/x?y=1`): no scheme, no `//host`, no backslash or control character. */
export function isReturnPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_LENGTH &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\u0000- \u007f\\]/.test(value) &&
    !NOT_A_RETURN_TARGET.test(value)
  );
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remembers `path` for after sign-in. An invalid value is ignored (and clears nothing). */
export function rememberReturnPath(path: string): void {
  if (!isReturnPath(path)) return;
  try {
    storage()?.setItem(RETURN_PATH_STORAGE_KEY, path);
  } catch {
    // Blocked storage: the visitor lands on the home instead.
  }
}

/** The remembered path without consuming it. */
export function peekReturnPath(): string | null {
  try {
    const value = storage()?.getItem(RETURN_PATH_STORAGE_KEY);
    return isReturnPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearReturnPath(): void {
  try {
    storage()?.removeItem(RETURN_PATH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** The remembered path, consumed. */
export function takeReturnPath(): string | null {
  const value = peekReturnPath();
  clearReturnPath();
  return value;
}
