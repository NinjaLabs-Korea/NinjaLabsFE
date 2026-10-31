# Frontend mock and API boundary

## Current completed foundation

- `FoundationProvider` is the runtime boundary for auth state. In **mock mode**, it uses deterministic fixtures and an in-memory session preview that resets on reload. Mock mode is local/test only.
- In **API mode**, the auth adapter (`src/lib/api/auth-adapter.ts`) and account/application/agent client are backed by the real backend (NinjaLabsBE, see its `docs/api-contract.md`). Sign-in is a PKCE-style login-code flow; access/refresh tokens never appear in a URL, and since 2026-10-24 no token is ever stored in Web Storage (see "Cookie session mode" below):
  1. `signIn` (`createLoginChallenge` in `src/lib/api/oauth.ts`) generates a random verifier, stores it in `sessionStorage["ninja.oauthVerifier"]` (tab-local), and full-page-redirects to the backend's `GET /auth/google?returnTo=<origin>&codeChallenge=<S256 base64url>&trace=<id>`. Only the challenge leaves the browser; the backend binds it to its signed OAuth state and rejects a missing challenge with `401 INVALID_CODE_CHALLENGE`.
     - **Turnstile (optional).** When `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, `GoogleLoginButton` renders the Cloudflare Turnstile widget (`components/auth/TurnstileWidget.tsx`, script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` loaded once by `lib/turnstile.ts`), keeps the button disabled until the widget returns a token, and `signIn({ turnstileToken })` adds `&turnstileToken=<token>` to the redirect. The backend verifies it with siteverify only when its `TURNSTILE_SECRET_KEY` is set: missing/rejected → `400 TURNSTILE_FAILED`, Cloudflare unreachable → `503 TURNSTILE_UNAVAILABLE` (JSON page, since this is a navigation). **Known limitation:** the FE cannot show localized copy for these two answers: the browser has already left the FE for the BE origin, so the user sees the raw JSON body and must press Back (the bfcache restore resets the widget for a retry). Only the BE redirecting to `/auth/callback#error=<CODE>` would let the FE map them. Tokens are single use and expire after 300 s: the widget's expired/error states disable the button with localized copy (`common.googleLogin.turnstile*`) and a retry; coming back from the backend via the bfcache resets the widget. Without the site key nothing changes. Deploy the FE key before the BE secret.
  2. After Google consent the backend (`GET /auth/google/callback`) redirects to `<origin>/auth/callback#loginCode=<43-char code>` (or `#error=AUTH_FAILED`). The callback page shows localized copy (`signup.authCallback.errors.<CODE>`, `lib/api/oauth.ts LOGIN_CALLBACK_ERROR_CODES`) for `#error=TURNSTILE_FAILED`, `TURNSTILE_UNAVAILABLE` and `DATABASE_UNAVAILABLE` should the BE ever redirect them; any other code (today only `AUTH_FAILED`) gets the generic failure copy. The code is single-use, valid for 60 seconds, and stored server-side only as a hash. The locale proxy forwards `/auth/callback` to `/<locale>/auth/callback`; the browser keeps the fragment.
  3. The adapter's `initialize()` (run once by `FoundationProvider` in the browser) calls `exchangeLoginCodeFromLocation`: it strips the fragment with `history.replaceState` before any network work, reads and deletes the verifier, and `POST /api/auth/exchange { code, codeVerifier }` (same origin, rewritten to the BE `POST /auth/exchange`, with `credentials: "include"` and `X-Ninja-Session: cookie`). The BE answers `{ accessToken, ... }` without a refresh token and sets the `ninja_rt` refresh cookie; `src/lib/api/http.ts` keeps the access token in memory only (a `refreshToken` in an older BE's body is ignored). A missing verifier (e.g. a different tab or browser), an expired/reused code, or a mismatching verifier fails with `401 INVALID_LOGIN_CODE`; the adapter then ends the session (and revokes any existing cookie via `POST /api/auth/logout`), publishes `signed-out`, and `/auth/callback` shows a retry link. Every other page load instead runs `http.initSession()`: one `POST /api/auth/refresh` (cookie present → access token → signed in; 401 → signed out) when the session hint allows it (see **Page load** below).
  4. `initialize()` then restores the session: from the `user` the exchange/refresh answer carried when it passes `parseMeResponse` (`src/lib/api/me.ts`), otherwise via `GET /auth/me` (see **Carried user** below). On the callback page a signed-in user is sent to the first unfinished onboarding step (`onboardingStep` 2 wallet, 3 profile, 4 get-started) or to the locale home.
  API requests go cross-origin to the BE with `Authorization: Bearer <accessToken>`; a 401 triggers one refresh-rotation retry (`POST /api/auth/refresh`). Only a refresh answered with **401/403** ends the session (the cookie is missing, expired, revoked or rotated away); a refresh that fails with 429, 5xx or a network error keeps the cookie and surfaces `REFRESH_UNAVAILABLE`, so a throttled or briefly unavailable backend never signs everyone out (the next 401 retries the refresh). The backend also keeps a 30-second reuse grace for a just-rotated refresh token, which covers two tabs racing the same rotation in browsers without Web Locks. Sign-out calls `POST /api/auth/logout` (the BE revokes the cookie's token, clears the cookie, 204).

### Cookie session mode (2026-10-24 owner decision)

Why: a refresh token in `localStorage` is readable by any script that runs on the origin (one XSS = a long-lived stolen session). It now exists only as an HttpOnly cookie that JS cannot read; the 15-minute access token stays in each tab's memory.

| Request | Body | BE behaviour |
|---|---|---|
| `POST /api/auth/exchange` | `{ code, codeVerifier }` | Returns `{ accessToken, user, ... }` (no `refreshToken`) and sets `ninja_rt` (HttpOnly; Secure; SameSite=Strict; Path=/api/auth). |
| `POST /api/auth/refresh` | `{}` | Reads the cookie, rotates it, re-sets it, returns `{ accessToken, user, ... }`. 401 when there is no valid cookie. |
| `POST /api/auth/refresh` (migration) | `{ refreshToken }` | Uses the body token instead of the cookie and sets the cookie. |
| `POST /api/auth/logout` | `{}` | Revokes the cookie's token, clears the cookie, 204. |

- **Opt-in / CSRF header.** Every cookie-mode request carries `X-Ninja-Session: cookie` (built by `cookieAuthInit()` in `src/lib/api/http.ts`) plus `credentials: "include"`. A cross-site form or other "simple" request cannot set a custom header, and a cross-origin `fetch` with one needs a CORS preflight that the FE origin never grants; together with `SameSite=Strict` this keeps another site from driving refresh/logout with the user's cookie.
- **Why the `/api/auth` rewrite.** `next.config.ts` rewrites `/api/auth/:path*` → `${NINJA_API_BASE_URL}/auth/:path*` (only when the API URL is set; mock mode has no rewrite, so the path is a plain 404). The browser only ever talks to the FE origin, so the cookie is first-party: no third-party-cookie blocking (Safari ITP, Chrome phase-out), `SameSite=Strict` works, and `Path=/api/auth` keeps it off every other request. `src/proxy.ts` excludes `/api/` from the locale matcher so next-intl never redirects these calls to `/<locale>/api/...`; the CSP `connect-src 'self'` already allows them.
- **CORS.** The BE `CORS_ORIGINS` is irrelevant for `/api/auth/*` (same-origin from the browser's point of view; the rewrite is a server-to-server hop) but is still required for every other API call, which stays cross-origin with the Bearer token.
- **Page load.** JS cannot read the HttpOnly cookie, so a non-secret hint `localStorage["ninja.session"] = "1"` records that a session may exist: set after a successful exchange or refresh, removed on sign-out, on a refresh answered 401/403 and on a cross-tab `signed-out`. With the hint (or a legacy `ninja.refreshToken` to migrate, or on `/auth/callback`) `initSession()` sends one `POST /api/auth/refresh`: 200 → signed in; 401 → signed out; 429/5xx/network → shown signed out without crashing, the cookie is kept and the next 401 retries the refresh. Without it the visitor is signed out immediately and no request is sent, so anonymous traffic does not hit the BE's per-IP refresh limit. The hint is never trusted for authorization; a stale hint only costs one 401, which clears it.
- **Carried user (BE 2026-10-31).** A cookie-mode exchange/refresh 200 also carries `user`: the BE builds it with the same `getMe` that answers `GET /auth/me` for that access token, so it is that answer. `http.ts` hands the raw field up with the result (`RefreshResult` / `SessionStarted` `{ ok: true, user? }`, never stored), and `readMe(http, sessionUser)` uses it only when this tab still holds the session and it passes the codec `parseMeResponse`; a missing field (a BE before this change, or the BE's user lookup failed after the rotation and dropped it) or a malformed one falls back to `GET /auth/me` exactly as before. So a returning user's page load is one round trip (refresh) instead of two (refresh, then `/auth/me`); the login callback and cross-tab adoption (`adoptOtherTabSession`) save the same request. Sign-out races are unchanged: a refresh discarded by `sessionEpoch` is not `ok`, so its user is never shown. Deploy order is free in both directions. `AuthAdapter.refresh()` (explicit re-read after a profile change) and `getAccount` still call `GET /auth/me`.
- **One-time migration.** If `localStorage["ninja.refreshToken"]` (written by builds before cookie mode) exists, `initSession()` sends it once as `{ refreshToken }` so the BE converts it into the cookie, then deletes `ninja.accessToken` and `ninja.refreshToken` whatever the outcome (a rejected or failed migration just means signing in again). The legacy value is re-read inside the refresh lock, so a second tab that waited sends `{}` and uses the cookie the first tab planted. A fresh OAuth login also deletes both keys.
- **Tabs.** All tabs share the cookie jar, so a rotation in one tab updates the cookie for all of them. Refresh stays single-flight per tab and serialized across tabs with the Web Lock `ninja.auth.refresh`, so two tabs never present the same cookie concurrently; each tab still fetches its own access token. Sign-out (and a refresh rejected mid-session) posts `signed-out` on `BroadcastChannel("ninja-auth")` (`src/lib/api/auth-events.ts`; fallback: a `storage` event on `localStorage["ninja.authEvent"]`, which holds only a timestamp); receiving tabs drop their access token and show `signed-out`. A completed login posts `signed-in` so tabs that saw the session end may refresh again.
- **Sign-out races.** Sign-out bumps a module `sessionEpoch` and marks the session ended: a refresh that resolves afterwards is discarded and its re-planted cookie revoked with a best-effort `POST /api/auth/logout`, and later 401s no longer trigger a refresh.
- **Local development.** `Secure` cookies are accepted on `http://localhost` by current browsers; other plain-HTTP hosts will drop the cookie.
- The Google button performs real Google OAuth in API mode (full-page redirect via the backend, as above). Mock mode still signs into the local preview and advances to `/signup/wallet`.
- In API mode the injected (browser extension) wallet connector connects an Injective EVM wallet, requests a backend nonce challenge, signs it with EIP-191 `personal_sign`, and verifies it through `/wallets/verify`. The backend stores the corresponding `inj1` address and queues the parent NFT mint. Connection alone never authenticates the user; wallet verification remains optional.
- The profile form persists nickname, bio, and tags through `/users/me/profile`; the completion screen calls `/users/me/complete-onboarding`. Public profile routes load `/users/:nickname` in API mode.
- Agent verification returns the usable API key once; the registration UI shows it only in that response. Later owner views receive and display only the masked prefix.
- Owner/account and admin interactions use durable backend APIs. Backend `AdminGuard` enforces admin reads and mutations; frontend route visibility is not treated as authorization.
- Admin image fields upload validated JPEG/PNG/WebP files to `/admin/media`; the returned immutable `/media/:id` URL is stored on the related bounty, notice, or highlight.
- Production bounty mode is backend-owned. `DIRECT` accepts the signed-in user endpoints, while `AGENT` accepts API-key-authenticated `/agent-api/v1/bounties/:id/applications|submissions` calls.

## Runtime environment contract

Start from `.env.example`; it contains no secrets. Do not place OAuth client secrets, API credentials, private keys, session-signing keys, or provider tokens in frontend environment variables.

Runtime configuration is mandatory and fail-closed. Missing, partial, malformed, or disallowed tuples are configuration errors; they never silently select mock mode or an unavailable fallback.

| Variable | Required | Scope |
|---|---:|---|
| `NINJA_DEPLOYMENT_TIER` | Yes | One of `local`, `test`, `staging`, `production`. |
| `NINJA_RUNTIME_MODE` | Yes | One of `mock`, `api`, subject to the allowed tuples below. |
| `NINJA_APP_ORIGIN` | Yes | Localhost origin in mock mode; HTTPS origin in API mode. No path, query, hash, or credentials. |
| `NINJA_MOCK_SEED` | Mock only | Required in mock mode and forbidden in API mode. Selects the deterministic fixture scenario (`default`). |
| `NINJA_API_BASE_URL` | API only | Required HTTPS backend base URL (NinjaLabsBE). Passed to the client through `FoundationConfig`; the API client fetches it directly (Bearer). Also read at build time by `next.config.ts` for the `/media/*` and `/api/auth/*` rewrites - set it for `next build`, not only at runtime. |
| `NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID` | No | Optional Injective EVM `1776` (mainnet) or `1439` (testnet). Omitting wallet variables renders the unavailable connection state. |
| `NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL` | API mode with a chain ID | Public JSON-RPC URL; requires a configured chain ID. Required in API mode whenever a chain ID is set (without it the wagmi chain has no transport and RPC reads fail silently); optional in mock mode. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | Currently ignored: since the wagmi 3 upgrade (2026-10-24) the connection UI is injected-wallet-only, because no RainbowKit release supports wagmi 3 and the WalletConnect provider tree still has high advisories. |

| Deployment tier | Allowed runtime mode |
|---|---|
| `local` | `mock` |
| `test` | `mock`, `api` |
| `staging` | `api` |
| `production` | `api` |

Tuple validation prevents mock mode outside local/test. API mode fetches the configured backend.

## Deferred Production Follow-up Gate

Status of the original gate items (✅ = delivered by the NinjaLabsBE integration, ⏳ = still open):

1. ✅ Real OAuth via the backend callback (`/auth/google` → Google code exchange → one-time `#loginCode` → `POST /api/auth/exchange` with the PKCE verifier → session issuance). Tokens are not accepted from a URL fragment.
2. ✅ HttpOnly, Secure, SameSite=Strict refresh cookie through the same-origin `/api/auth` rewrite (2026-10-24, "Cookie session mode" above). The short-lived access token remains a Bearer token held in memory.
3. ✅ CSRF protection for the cookie-authenticated auth endpoints: `SameSite=Strict`, `Path=/api/auth`, and the required `X-Ninja-Session: cookie` header. All other state changes are Bearer-authenticated and not cookie-driven.
4. Trusted-edge rate limiting and Turnstile enforcement where abuse protection is required.
5. ✅ Backend-owned identity, authorization, and AdminGuard enforcement. A frontend login wall remains defense-in-depth UX, not the security boundary.
6. ✅ Wallet signature challenge, EIP-191 verification, nonce/replay protection, `inj1` normalization, and account linking.
7. ✅ Agent API-key authentication plus agent-owned application and submission endpoints. Key rotation (`POST /agents/:id/keys/rotate`, new key revealed once) and agent revocation (`POST /agents/:id/revoke`, behind a destructive confirm) are implemented on the `/agents` page (`account/AgentsView`).

These are deferred requirements, not implementation promises made by the current frontend.

## Verification commands

For changes that affect this foundation, use Node 24 and npm 11:

```bash
npm run test:unit
npm run lint
npm run build
```

Also manually verify the relevant boundary: the mock SPA signs in only to memory and resets on reload; API OAuth resumes at the correct onboarding step; wallet rejection leaves the account unlinked; a successful signature advances to profile; agent API-key displays stay masked; and desktop/mobile account disclosure remains consistent.
