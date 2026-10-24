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
 * framed (frame-ancestors). Next.js emits inline bootstrap scripts and inline styles, so `'unsafe-inline'` stays.
 *
 * Next step (post-launch, deliberately not done here): a per-request nonce in `src/proxy.ts`, passed to the root layout
 * via an `x-nonce` header, replacing script-src `'unsafe-inline'` with `'nonce-…' 'strict-dynamic'`.
 *
 * 새 외부 오리진(스크립트, iframe, fetch 대상)을 붙이면 아래 `contentSecurityPolicy()`의 해당 지시어에 추가하고,
 * `npm run build && npm run start`로 띄운 화면의 브라우저 콘솔에 "Refused to ..." 가 없는지 확인한다.
 * integration 하네스(`integration/lib/harness.mjs clean()`)도 방문하는 모든 화면에서 CSP 위반 0건을 검사한다.
 */
type CspMode = "enforce" | "report-only";

function cspMode(): CspMode {
  return process.env.NODE_ENV === "production" ? "enforce" : "report-only";
}

const CSP_HEADER_NAME: Record<CspMode, string> = {
  enforce: "Content-Security-Policy",
  "report-only": "Content-Security-Policy-Report-Only",
};

function contentSecurityPolicy(mode: CspMode): string {
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
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
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
          cspHeader(),
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
