import { routing } from "../i18n/routing";

/**
 * Same env the runtime config reads (`lib/runtime/config.ts`, which trims it); unset in mock mode. Trimmed here too: a
 * pasted trailing newline would otherwise land in the rewrite destinations (`/api/auth`, `/media`) and break every
 * cookie-mode auth call, while the runtime config (which validates the same value) kept accepting it.
 */
export function apiBaseUrl(): string | undefined {
  return process.env.NINJA_API_BASE_URL?.trim().replace(/\/$/, "") || undefined;
}

/** Origin form for `connect-src`; omitted when there is no API (mock mode) or the value is not a URL. */
export function apiOrigin(): string | null {
  const apiUrl = apiBaseUrl();
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

/** Origin of the configured Injective JSON-RPC (`NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL`), so `connect-src` follows the env var. */
function rpcOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    // Same protocols runtime/config.ts accepts (http only survives there for local/test tiers).
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Vercel preview deployments inject the Vercel toolbar (vercel.live); production and local builds never do. */
const VERCEL_LIVE = "https://vercel.live";
function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/** Cloudflare Turnstile (sign-in bot check, `lib/turnstile.ts`): api.js, the challenge iframe and its fetches. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * CSP 모드 - 바꿀 곳은 여기 한 군데다. `src/test/next-config.test.ts`가 모드별 헤더 이름과 지시어를 고정한다.
 *
 * - production (`next build` / `next start`, Vercel 포함. Next가 NODE_ENV=production으로 고정한다):
 *   헤더 이름이 `Content-Security-Policy`라서 브라우저가 실제로 차단한다. `'unsafe-eval'` 없음.
 * - 그 외 (`next dev`, vitest): `Content-Security-Policy-Report-Only`. 위반은 콘솔에만 찍힌다.
 *   dev 서버의 React Refresh / 에러 오버레이가 `eval`을 쓰므로 `'unsafe-eval'`을 허용한다.
 * - 어느 모드든 `report-to`/`report-uri` 수집 엔드포인트는 아직 없다 (위반은 브라우저 콘솔에만 남는다).
 *
 * Why enforce with `'unsafe-inline'` still in script-src: the access token lives in JS memory, so an injected script
 * must not be able to pull more code from another origin (script-src), fetch/beacon to an unknown origin (connect-src),
 * post a form off-site (form-action), embed a plugin (object-src), rebase relative URLs (base-uri) or have the page
 * framed (frame-ancestors). Next.js emits inline bootstrap scripts and inline styles, so `'unsafe-inline'` stays on
 * every statically generated page (a nonce needs a per-request render, which would make the whole site dynamic).
 *
 * The routes that hold tokens or the one-time agent API key (`NONCE_ROUTE_PATTERNS`) are the exception: `src/proxy.ts`
 * gives them a per-request nonce policy (`contentSecurityPolicy(mode, nonce)`) and they render dynamically
 * (`await connection()` in their layout/page). A hard load of one of those URLs is therefore script-injection hardened;
 * a client-side navigation into them from a public page keeps that document's policy.
 *
 * 새 외부 오리진(스크립트, iframe, fetch 대상)을 붙이면 아래 `contentSecurityPolicy()`의 해당 지시어에 추가하고,
 * `npm run build && npm run start`로 띄운 화면의 브라우저 콘솔에 "Refused to ..." 가 없는지 확인한다.
 * integration 하네스(`integration/lib/harness.mjs clean()`)도 방문하는 모든 화면에서 CSP 위반 0건을 검사한다.
 */
export type CspMode = "enforce" | "report-only";

export function cspMode(): CspMode {
  return process.env.NODE_ENV === "production" ? "enforce" : "report-only";
}

export const CSP_HEADER_NAME: Record<CspMode, string> = {
  enforce: "Content-Security-Policy",
  "report-only": "Content-Security-Policy-Report-Only",
};

/**
 * Locale-stripped route patterns that get the nonce policy (and must therefore render per request). Prefix match:
 * `/admin` covers every admin page. Keep in sync with `src/lib/locale-routes.ts`; `src/test/csp.test.ts` checks that each
 * entry is a real route and that the dynamic layouts/pages call `connection()`.
 */
export const NONCE_ROUTE_PATTERNS = ["/account", "/admin", "/agents", "/auth/callback"] as const;

const NONCE_ROUTE_ALTERNATION = NONCE_ROUTE_PATTERNS.map((pattern) => pattern.slice(1)).join("|");
const LOCALE_ALTERNATION = routing.locales.join("|");

/**
 * `next.config.ts headers()` source for the shared CSP: every path EXCEPT the nonce routes (those get their CSP from the
 * proxy, and two CSP headers would be intersected). Built from the same list as `isNonceRoute`.
 */
export const NONCE_ROUTE_HEADER_SOURCE = `/:path((?!(?:${LOCALE_ALTERNATION})/(?:${NONCE_ROUTE_ALTERNATION})(?:/|$)).*)`;

// Case-insensitive on purpose: Next matches the header source below case-insensitively, so /en/Account is excluded from the
// shared CSP and must reach the proxy's nonce branch (its 404 rewrite then carries the public policy) instead of getting none.
const NONCE_ROUTE_REGEX = new RegExp(`^/(?:${LOCALE_ALTERNATION})/(?:${NONCE_ROUTE_ALTERNATION})(?:/|$)`, "i");

/** True when `pathname` (with locale prefix, as the proxy sees it) is a nonce-CSP page. */
export function isNonceRoute(pathname: string): boolean {
  return NONCE_ROUTE_REGEX.test(pathname);
}

/** A fresh CSP nonce: 128 bits from the platform CSPRNG, base64 (the alphabet Next's nonce parser accepts). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function contentSecurityPolicy(mode: CspMode, nonce?: string): string {
  const preview = isVercelPreview();
  // The wallet stack is injected-only since the wagmi 3 upgrade (2026-10-24): the browser extension talks to its own
  // RPC, and the page only reaches the configured Injective JSON-RPC through viem's http transport. RainbowKit /
  // WalletConnect origins (relay websockets, web3modal, rainbow.me) were dropped with them; re-add them if WalletConnect
  // returns (see AGENTS.md "Stack").
  const connectSrc = [
    "'self'",
    apiOrigin(),
    rpcOrigin(),
    "https://*.injective.network",
    "wss://*.injective.network",
    "https://k8s.testnet.json-rpc.injective.network",
    TURNSTILE_ORIGIN,
    ...(preview ? [VERCEL_LIVE, "wss://ws-us3.pusher.com"] : []),
  ].filter((source): source is string => source !== null);
  // With a nonce (`isNonceRoute` pages only) the script policy is nonce-based and has no 'unsafe-inline': Next stamps the
  // nonce on its own bootstrap/flight scripts (`getScriptNonceFromHeader` reads it from the request CSP), everything else
  // inline is blocked. No 'strict-dynamic': the host list stays authoritative, so Turnstile's origin keeps working as today.
  const scriptSrc = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : "'unsafe-inline'",
    mode === "report-only" ? "'unsafe-eval'" : null,
    TURNSTILE_ORIGIN,
    preview ? VERCEL_LIVE : null,
  ].filter(
    (source): source is string => source !== null,
  );
  return [
    "default-src 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${preview ? ` ${VERCEL_LIVE}` : ""}`,
    `font-src 'self' https://fonts.gstatic.com data:${preview ? ` ${VERCEL_LIVE} https://assets.vercel.com` : ""}`,
    `img-src 'self' data: blob: https:${preview ? ` ${VERCEL_LIVE} https://vercel.com` : ""}`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${TURNSTILE_ORIGIN}${preview ? ` ${VERCEL_LIVE}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

