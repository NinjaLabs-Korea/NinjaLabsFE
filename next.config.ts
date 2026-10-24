import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./src/i18n/routing";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Same env the runtime config reads (`lib/runtime/config.ts`); unset in mock mode. */
const apiUrl = process.env.NINJA_API_BASE_URL?.replace(/\/$/, "");

/** Origin form for `connect-src`; omitted when there is no API (mock mode) or the value is not a URL. */
function apiOrigin(): string | null {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

function appOrigin(): string | null {
  try {
    return process.env.NINJA_APP_ORIGIN ? new URL(process.env.NINJA_APP_ORIGIN).origin : null;
  } catch {
    return null;
  }
}

/**
 * Absolute image URLs the optimizer may fetch: BE media on the API origin and anything on the app origin.
 * `lib/image.ts imageProps()` renders every other `safeHttpUrl`-admitted URL `unoptimized`, so the two
 * lists must agree - hence the same prefixes are inlined into the bundle through `env` below.
 */
const optimizedImagePrefixes = [
  apiOrigin() ? `${apiOrigin()}/media/` : null,
  appOrigin() ? `${appOrigin()}/` : null,
].filter((prefix): prefix is string => prefix !== null);

/**
 * Report-only CSP: it is NOT enforced, so a violation only logs to the browser console
 * (no `report-to`/`report-uri` endpoint yet). Enforcing it today would break the app because
 * Next.js emits inline bootstrap scripts (`'unsafe-inline'` in script-src) and inline styles; dev mode also needs `'unsafe-eval'`. To enforce it, generate a per-request
 * nonce in `src/proxy.ts`, pass it to `<Script>`/`next/script` and the root layout via the
 * `x-nonce` header, replace `'unsafe-inline'`/`'unsafe-eval'` with `'nonce-…' 'strict-dynamic'`,
 * audit the remaining inline styles, and only then rename this header to `Content-Security-Policy`.
 */
function contentSecurityPolicy(): string {
  // The wallet stack is injected-only since the wagmi 3 upgrade (2026-10-24): the browser extension talks to its own
  // RPC, and the page only reaches the configured Injective JSON-RPC through viem's http transport. RainbowKit /
  // WalletConnect origins (relay websockets, web3modal, rainbow.me) were dropped with them; re-add them if WalletConnect
  // returns (see AGENTS.md "Stack").
  const connectSrc = [
    "'self'",
    apiOrigin(),
    "https://*.injective.network",
    "wss://*.injective.network",
    "https://k8s.testnet.json-rpc.injective.network",
  ].filter((source): source is string => source !== null);
  return [
    "default-src 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // No `X-Powered-By: Next.js`: it only advertises the framework to scanners.
  poweredByHeader: false,
  env: { NINJA_OPTIMIZED_IMAGE_PREFIXES: optimizedImagePrefixes.join(",") },
  images: {
    remotePatterns: optimizedImagePrefixes.map((prefix) => new URL(`${prefix}**`)),
  },
  async headers() {
    // Every route, including `/skill.md` (download) and the `/media/*` + `/api/auth/*` rewrites: none of these
    // headers change how a download or an image response is consumed.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
  async redirects() {
    // `[locale]/opengraph-image.tsx` exports generateImageMetadata (localized `alt`), so the image lives at
    // `/<locale>/opengraph-image/social`. Scrapers that cached the earlier id-less og:image URL keep resolving.
    // Redirects run before the proxy, so this path never reaches its in-locale 404 rewrite.
    return [
      {
        source: `/:locale(${routing.locales.join("|")})/opengraph-image`,
        destination: "/:locale/opengraph-image/social",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // `/api/auth/*` is the cookie-mode auth proxy (exchange/refresh/logout, `lib/api/http.ts`): the browser talks to
    // the FE origin, so the BE's HttpOnly `ninja_rt` refresh cookie (Path=/api/auth) is first-party and never readable
    // by JS. `src/proxy.ts` excludes `/api/` so the locale middleware never redirects it. Mock mode has no API URL,
    // so there is no rewrite and the path is a plain 404.
    return apiUrl
      ? [
          { source: "/media/:path*", destination: `${apiUrl}/media/:path*` },
          { source: "/api/auth/:path*", destination: `${apiUrl}/auth/:path*` },
        ]
      : [];
  },
};

export default withNextIntl(nextConfig);
