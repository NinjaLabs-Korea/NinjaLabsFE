# Frontend mock and API boundary

## Current completed foundation

- `FoundationProvider` is the runtime boundary for auth state. In **mock mode**, it uses deterministic fixtures and an in-memory session preview that resets on reload. Mock mode is local/test only.
- In **API mode**, the auth adapter and account/application/agent client are backed by the real backend (NinjaLabsBE, see its `docs/api-contract.md`). Sign-in redirects to the backend's `/auth/google`; the OAuth callback returns to the app with `#accessToken=..&refreshToken=..` (URL fragment, never sent to servers), which `src/lib/api/http.ts` captures into `localStorage`. Requests send `Authorization: Bearer`; a 401 triggers one refresh-rotation retry (`POST /auth/refresh`), and a failed refresh clears the session.
- The Google button performs real Google OAuth in API mode (full-page redirect via the backend). In mock mode it still signs into the local preview only and then advances to the `/signup/wallet` step. `CompleteSignupLink` only navigates; it does not sign a user in.
- RainbowKit supports browser wallet **connection only**. Connecting or disconnecting a wallet does not authenticate a user, create or link an account, sign a message or transaction, or make a backend request.
- Owner agent keys are masked fixture values only. The UI never displays a usable or unmasked key.
- Owner/account and admin interactions are preview state, not authorization controls or durable persistence. `/admin/*` remains publicly reachable and its admin labeling is decorative.

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
| `NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL` | No | Optional public RPC URL; requires a configured chain ID. |
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

1. ✅ Real OAuth via the backend callback (`/auth/google` → code exchange → session issuance). Note the agreed contract uses bearer tokens delivered over a URL fragment and stored in `localStorage` with refresh rotation, **not** HttpOnly cookies — revisit if the team wants a BFF/cookie model.
2. ⏳ HttpOnly, Secure session cookies (superseded by the bearer-token contract above unless revisited).
3. CSRF protections for cookie-authenticated state changes.
4. Trusted-edge rate limiting and Turnstile enforcement where abuse protection is required.
5. Backend-owned identity, authorization, and admin access enforcement; decorative frontend state is insufficient.
6. Wallet signature challenge, verification, nonce/replay protection, and explicit account-linking policy; wallet connection alone is insufficient.
7. Reviewed agent API contracts covering registration, authentication/authorization, key issuance and rotation, submission/status behavior, validation, and error semantics.

These are deferred requirements, not implementation promises made by the current frontend.

## Verification commands

For changes that affect this foundation, use Node 24 and npm 11:

```bash
npm run test:unit
npm run lint
npm run build
```

Also manually verify the relevant boundary: the mock SPA signs in only to memory and resets on reload; API mode remains unavailable with no network traffic; wallet connect/disconnect does not change auth state; agent API-key displays stay masked; and desktop/mobile account disclosure remains consistent with the mock session.