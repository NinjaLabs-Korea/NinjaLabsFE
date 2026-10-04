import { setTokens } from "@/lib/api/http";

const VERIFIER_KEY = "ninja.oauthVerifier";

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** The verifier stays in this tab; only its SHA-256 challenge leaves the browser. */
export async function createLoginChallenge(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  // Fail before redirect if sessionStorage is unavailable: the callback would be unusable.
  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  return base64url(new Uint8Array(digest));
}

/** Remove callback parameters before any asynchronous network work. */
export async function exchangeLoginCodeFromLocation(apiUrl: string): Promise<boolean> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("loginCode") && !params.has("error")) return false;
  const code = params.get("loginCode");
  const error = params.get("error");
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  const codeVerifier = window.sessionStorage.getItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
  if (error || !code || !codeVerifier) throw new Error("Login could not be completed. Please sign in again.");

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/exchange`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (!response.ok) throw new Error("Login could not be completed. Please sign in again.");
  const tokens: unknown = await response.json();
  if (!tokens || typeof tokens !== "object" ||
      !("accessToken" in tokens) || typeof tokens.accessToken !== "string" || !tokens.accessToken ||
      !("refreshToken" in tokens) || typeof tokens.refreshToken !== "string" || !tokens.refreshToken) {
    throw new Error("Invalid login response.");
  }
  setTokens(tokens.accessToken, tokens.refreshToken);
  return true;
}
