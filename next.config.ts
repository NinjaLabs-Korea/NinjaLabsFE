import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./src/i18n/routing";
import { apiBaseUrl, apiOrigin, cspMode, contentSecurityPolicy, CSP_HEADER_NAME, NONCE_ROUTE_HEADER_SOURCE } from "./src/lib/csp";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const apiUrl = apiBaseUrl();

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

/** The CSP header for this build: enforced in production, report-only otherwise (see `cspMode`). */
function cspHeader(): { key: string; value: string } {
  const mode = cspMode();
  return { key: CSP_HEADER_NAME[mode], value: contentSecurityPolicy(mode) };
}


const nextConfig: NextConfig = {
  // No `X-Powered-By: Next.js`: it only advertises the framework to scanners.
  poweredByHeader: false,
  env: { NINJA_OPTIMIZED_IMAGE_PREFIXES: optimizedImagePrefixes.join(",") },
  images: {
    remotePatterns: optimizedImagePrefixes.map((prefix) => new URL(`${prefix}**`)),
  },
  async headers() {
    // Every route (the CSP: all but the nonce routes), including the `/media/*` + `/api/auth/*` rewrites: none of these
    // headers change how a download or an image response is consumed.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // The nonce routes (`NONCE_ROUTE_PATTERNS`) are excluded: `src/proxy.ts` sends their CSP with a per-request nonce.
      { source: NONCE_ROUTE_HEADER_SOURCE, headers: [cspHeader()] },
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
      // Google-only signup (2026-11): the wallet step is gone. Old links, bookmarks and the previous deploy's resume
      // redirects land on the profile step, whose `SignupGate` then sorts the session (signed out -> /signup, finished -> leave).
      // Temporary on purpose: the BE still sends step-2 users here until its first INSERT moves to step 3.
      {
        source: `/:locale(${routing.locales.join("|")})/signup/wallet`,
        destination: "/:locale/signup/profile",
        permanent: false,
      },
      {
        source: "/signup/wallet",
        destination: "/signup/profile",
        permanent: false,
      },
      // Agents are gone (Google-only, 2026-11): the list, the register page and their bookmarks land on the bounty list.
      // Temporary on purpose, like the wallet redirects above.
      {
        source: `/:locale(${routing.locales.join("|")})/agents`,
        destination: "/:locale/bounties",
        permanent: false,
      },
      {
        source: `/:locale(${routing.locales.join("|")})/agents/register`,
        destination: "/:locale/bounties",
        permanent: false,
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
