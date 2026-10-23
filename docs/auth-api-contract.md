# Frontend mock and API boundary

## Current completed foundation

- `FoundationProvider` is the runtime boundary for auth state. In **mock mode**, it uses deterministic fixtures and an in-memory session preview that resets on reload. Mock mode is local/test only.
- In **API mode**, the auth adapter (`src/lib/api/auth-adapter.ts`) and account/application/agent client are backed by the real backend (NinjaLabsBE, see its `docs/api-contract.md`). Sign-in is a PKCE-style login-code flow; access/refresh tokens never appear in a URL:
  1. `signIn` (`createLoginChallenge` in `src/lib/api/oauth.ts`) generates a random verifier, stores it in `sessionStorage["ninja.oauthVerifier"]` (tab-local), and full-page-redirects to the backend's `GET /auth/google?returnTo=<origin>&codeChallenge=<S256 base64url>&trace=<id>`. Only the challenge leaves the browser; the backend binds it to its signed OAuth state and rejects a missing challenge with `401 INVALID_CODE_CHALLENGE`.
  2. After Google consent the backend (`GET /auth/google/callback`) redirects to `<origin>/auth/callback#loginCode=<43-char code>` (or `#error=AUTH_FAILED`). The code is single-use, valid for 60 seconds, and stored server-side only as a hash. The locale proxy forwards `/auth/callback` to `/<locale>/auth/callback`; the browser keeps the fragment.
  3. The adapter's `initialize()` (run once by `FoundationProvider` in the browser) calls `exchangeLoginCodeFromLocation`: it strips the fragment with `history.replaceState` before any network work, reads and deletes the verifier, and `POST /auth/exchange { code, codeVerifier }`. The response body `{ accessToken, refreshToken }` is stored in `localStorage` (`ninja.accessToken` / `ninja.refreshToken`) by `src/lib/api/http.ts`. A missing verifier (e.g. a different tab or browser), an expired/reused code, or a mismatching verifier fails with `401 INVALID_LOGIN_CODE`; the adapter then clears tokens, publishes `signed-out`, and `/auth/callback` shows a retry link.
  4. `initialize()` then restores the session via `GET /auth/me`. On the callback page a signed-in user is sent to the first unfinished onboarding step (`onboardingStep` 2 wallet, 3 profile, 4 get-started) or to the locale home.
  Requests send `Authorization: Bearer <accessToken>`; a 401 triggers one refresh-rotation retry (`POST /auth/refresh`). Only a refresh answered with **401/403** clears the session (the refresh token is expired, revoked or rotated away); a refresh that fails with 429, 5xx or a network error keeps the stored tokens and surfaces `REFRESH_UNAVAILABLE`, so a throttled or briefly unavailable backend never signs everyone out. The backend also keeps a 30-second reuse grace for a just-rotated refresh token, which covers two tabs racing the same rotation. Sign-out calls `POST /auth/logout` with the refresh token.
- The Google button performs real Google OAuth in API mode (full-page redirect via the backend, as above). Mock mode still signs into the local preview and advances to `/signup/wallet`.
- In API mode RainbowKit connects an Injective EVM wallet, requests a backend nonce challenge, signs it with EIP-191 `personal_sign`, and verifies it through `/wallets/verify`. The backend stores the corresponding `inj1` address and queues the parent NFT mint. Connection alone never authenticates the user; wallet verification remains optional.
- The profile form persists nickname, bio, and tags through `/users/me/profile`; the completion screen calls `/users/me/complete-onboarding`. Public profile routes load `/users/:nickname` in API mode.
- Agent verification returns the usable API key once; the registration UI shows it only in that response. Later owner views receive and display only the masked prefix.
- Owner/account and admin interactions use durable backend APIs. Backend `AdminGuard` enforces admin reads and mutations; frontend route visibility is not treated as authorization.
- Admin image fields upload validated JPEG/PNG/WebP files to `/admin/media`; the returned immutable `/media/:id` URL is stored on the related bounty, notice, or highlight.
- Production bounty mode is backend-owned. `DIRECT` accepts the signed-in user endpoints, while `AGENT` accepts API-key-authenticated `/agent-api/v1/bounties/:id/applications|submissions` calls.

### RainbowKit CSS exception

The project normally has one application stylesheet, `src/app/globals.css`. Its `@import "@rainbow-me/rainbowkit/styles.css";` line is the single dependency-CSS exception required for the wallet connection UI.

## Runtime environment contract

Start from `.env.example`; it contains no secrets. Do not place OAuth client secrets, API credentials, private keys, session-signing keys, or provider tokens in frontend environment variables.

Runtime configuration is mandatory and fail-closed. Missing, partial, malformed, or disallowed tuples are configuration errors; they never silently select mock mode or an unavailable fallback.

| Variable | Required | Scope |
|---|---:|---|
| `NINJA_DEPLOYMENT_TIER` | Yes | One of `local`, `test`, `staging`, `production`. |
| `NINJA_RUNTIME_MODE` | Yes | One of `mock`, `api`, subject to the allowed tuples below. |
| `NINJA_APP_ORIGIN` | Yes | Localhost origin in mock mode; HTTPS origin in API mode. No path, query, hash, or credentials. |
| `NINJA_MOCK_SEED` | Mock only | Required in mock mode and forbidden in API mode. Selects the deterministic fixture scenario (`default`). |
| `NINJA_API_BASE_URL` | API only | Required HTTPS backend base URL (NinjaLabsBE). Passed to the client through `FoundationConfig`; the API-mode auth adapter and account client fetch it directly. |
| `NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID` | No | Optional Injective EVM `1776` (mainnet) or `1439` (testnet). Omitting wallet variables renders the unavailable connection state. |
| `NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL` | API mode with a chain ID | Public JSON-RPC URL; requires a configured chain ID. Required in API mode whenever a chain ID is set (without it the wagmi chain has no transport and RPC reads fail silently); optional in mock mode. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | Optional public WalletConnect project identifier. Without it, the connection UI remains injected-wallet-only. |

| Deployment tier | Allowed runtime mode |
|---|---|
| `local` | `mock` |
| `test` | `mock`, `api` |
| `staging` | `api` |
| `production` | `api` |

Tuple validation prevents mock mode outside local/test. API mode fetches the configured backend.

## Deferred Production Follow-up Gate

Status of the original gate items (✅ = delivered by the NinjaLabsBE integration, ⏳ = still open):

1. ✅ Real OAuth via the backend callback (`/auth/google` → Google code exchange → one-time `#loginCode` → `POST /auth/exchange` with the PKCE verifier → session issuance). Note the agreed contract uses bearer tokens returned in the exchange response body and stored in `localStorage` with refresh rotation, **not** HttpOnly cookies - revisit if the team wants a BFF/cookie model. Tokens are no longer accepted from a URL fragment.
2. ⏳ HttpOnly, Secure session cookies (superseded by the bearer-token contract above unless revisited).
3. CSRF protections for cookie-authenticated state changes.
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
