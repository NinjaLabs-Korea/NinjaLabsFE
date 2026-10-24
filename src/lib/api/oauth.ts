import { AUTH_PROXY_PATH, cookieAuthInit, installSession, isAuthCallbackPath } from "@/lib/api/http";

export { isAuthCallbackPath };

const VERIFIER_KEY = "ninja.oauthVerifier";

/** A sign-in round trip (BE → Google consent → callback) that takes longer than this is abandoned. */
export const LOGIN_VERIFIER_TTL_MS = 10 * 60 * 1000;

type StoredVerifier = { verifier: string; createdAt: number };

function readStoredVerifier(): StoredVerifier | null {
  try {
    const raw = window.sessionStorage.getItem(VERIFIER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" ||
        !("verifier" in parsed) || typeof parsed.verifier !== "string" || !parsed.verifier ||
        !("createdAt" in parsed) || typeof parsed.createdAt !== "number") return null;
    return { verifier: parsed.verifier, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

/**
 * Drops the PKCE verifier. The auth adapter calls this when any page other than the callback initializes: the
 * sign-in that created the verifier was abandoned (back button, closed consent screen), and a verifier left
 * behind would let a later planted `#loginCode` be exchanged into a session the user never started.
 */
export function discardLoginVerifier(): void {
  try {
    window.sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    // storage unavailable: nothing was stored either
  }
}

/** Reads and always removes the verifier; a missing, malformed or older-than-TTL one counts as absent. */
function takeFreshVerifier(now = Date.now()): string | null {
  const stored = readStoredVerifier();
  discardLoginVerifier();
  if (!stored) return null;
  const age = now - stored.createdAt;
  return age >= 0 && age <= LOGIN_VERIFIER_TTL_MS ? stored.verifier : null;
}

/**
 * `attempted` is true only when POST /auth/exchange was actually sent. The auth adapter
 * ends the current session only in that case; a missing verifier or an `#error=` fragment must
 * not log the current session out (a link could plant either one).
 */
export class LoginExchangeError extends Error {
  constructor(message: string, readonly attempted: boolean) {
    super(message);
    this.name = "LoginExchangeError";
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * The verifier stays in this tab; only its SHA-256 challenge leaves the browser. It is stored with its creation time
 * and honoured for `LOGIN_VERIFIER_TTL_MS` only.
 */
export async function createLoginChallenge(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  // Fail before redirect if sessionStorage is unavailable: the callback would be unusable.
  window.sessionStorage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, createdAt: Date.now() } satisfies StoredVerifier));
  return base64url(new Uint8Array(digest));
}

/**
 * Only the callback route processes the fragment: anywhere else `#loginCode=`/`#error=` is an
 * ordinary anchor and is left alone. Callback parameters are removed before any asynchronous
 * network work.
 *
 * The exchange goes to the same-origin `/api/auth/exchange` (rewritten to the BE `/auth/exchange`) in cookie mode:
 * the BE answers `{ accessToken }` and sets the HttpOnly `ninja_rt` refresh cookie on the FE origin. Only the access
 * token is kept, in memory (`lib/api/http.ts`); a `refreshToken` in the body (older BE) is ignored, never stored.
 */
export async function exchangeLoginCodeFromLocation(): Promise<boolean> {
  if (!isAuthCallbackPath(window.location.pathname)) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("loginCode") && !params.has("error")) return false;
  const code = params.get("loginCode");
  const error = params.get("error");
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  const codeVerifier = takeFreshVerifier();
  if (error || !code || !codeVerifier) {
    throw new LoginExchangeError("Login could not be completed. Please sign in again.", false);
  }

  const response = await fetch(`${AUTH_PROXY_PATH}/exchange`, cookieAuthInit({ code, codeVerifier }));
  if (!response.ok) throw new LoginExchangeError("Login could not be completed. Please sign in again.", true);
  const tokens: unknown = await response.json();
  if (!tokens || typeof tokens !== "object" ||
      !("accessToken" in tokens) || typeof tokens.accessToken !== "string" || !tokens.accessToken) {
    throw new LoginExchangeError("Invalid login response.", true);
  }
  installSession(tokens.accessToken);
  return true;
}
