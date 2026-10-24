# Real-browser integration harness

End-to-end regression run of this FE (api mode) against a real NinjaLabsBE and a private Postgres, driven through
headless Chrome over the DevTools Protocol. It catches what `npm run test:unit` and the BE e2e suite cannot: hydration
errors, streaming/SSR output, real BE response shapes, cookie attributes, refresh races between tabs, and DB side effects
of UI actions.

It is **not run in CI** (it needs Chrome, Postgres binaries and a BE checkout, and takes ~10 minutes). Run it before
merging anything that touches auth, the data layer, routing or a whole user flow.

## Prerequisites

| What | Notes |
|---|---|
| Node 22+ | Uses the built-in `WebSocket` and `fetch`. The repo itself requires Node 24. |
| Postgres binaries | `initdb`, `pg_ctl`, `psql` on `PATH` (or `PG_BIN=/path/to/bin`). No running server needed; the harness creates its own cluster. |
| Chrome or Chromium | macOS default path is detected; otherwise set `CHROME_PATH`. |
| `openssl` | Generates a throwaway self-signed certificate for `localhost` at runtime. |
| A BE checkout | `NINJA_BE_DIR=/path/to/NinjaLabsBE` with `node_modules` installed (`npm ci`). |
| FE `node_modules` | `npm ci` in this repo. |

## Run

```sh
NINJA_BE_DIR=../NinjaLabsBE npm run test:integration          # flows 1-8
NINJA_BE_DIR=../NinjaLabsBE npm run test:integration -- 1 3    # a subset
```

Exit code 0 only when every assertion in every selected flow passed. The summary prints one `PASS`/`FAIL` line per flow;
per-flow logs (`ASSERT PASS|FAIL ...` lines plus a JSON page report per screen), service logs and a DB dump go to
`integration/.logs/<timestamp>/` (git-ignored; override with `NINJA_IT_LOG_DIR`).

### What a run does

1. Copies the BE working tree (`NINJA_BE_DIR`) and this FE working tree (tracked + untracked-but-not-ignored files, so
   uncommitted edits are included) into a fresh `$TMPDIR/ninja-it-*` directory, with `node_modules` cloned (APFS clone on
   macOS; Turbopack rejects a symlinked `node_modules`). Neither checkout is written to.
2. Builds both there (`nest build`, `next build`) while it `initdb`s a private Postgres (TCP `127.0.0.1` only, trust auth)
   and runs the BE migration runner (`scripts/migrate.js`).
3. Generates per run: a random `JWT_SECRET` and a self-signed TLS key/cert in the temp dir. Nothing secret is committed.
4. Starts the BE, the FE (`next start`), two HTTPS proxies (`lib/tls-proxy.mjs`; api mode requires https origins) and
   headless Chrome with a throwaway profile.
5. Seeds (`lib/seed.mjs`): users by SQL (admin, builder, onboarding step 3, step 2, a CORE member); bounties, a deposit
   confirmation, notices and a highlight through the BE admin API so they pass real validation.
6. Runs the flows in order, then dumps key tables and **always** tears everything down (process groups killed, Postgres
   stopped, temp dir removed), including on failure or Ctrl-C. `NINJA_IT_KEEP_TMP=1` keeps the temp dir for debugging.

### Ports and environment

| Variable | Default | |
|---|---|---|
| `NINJA_IT_PG_PORT` | 54390 | Postgres |
| `NINJA_IT_BE_PORT` / `NINJA_IT_BE_TLS_PORT` | 4390 / 4391 | BE http / its https proxy (`API` origin) |
| `NINJA_IT_FE_PORT` / `NINJA_IT_FE_TLS_PORT` | 3390 / 3391 | `next start` / its https proxy (app origin) |
| `NINJA_IT_CDP_PORT` | 9390 | Chrome remote debugging |

The run refuses to start if any port is taken. The BE gets `JWT_ACCESS_TTL=60s` so access-token expiry can be reproduced
inside one flow (flows 7 and 8 each wait 65 s). The FE is built and started with `NINJA_RUNTIME_MODE=api`,
`NINJA_DEPLOYMENT_TIER=test` and both origins pointing at the proxies.

## Sessions

Every browser flow signs in through the real cookie-mode login path in its own browser context (fresh cookie jar):
the harness inserts a one-time `oauth_login_code` row exactly like `AuthService.issueLoginCode` (sha256 code hash, S256
challenge), puts the PKCE verifier where `createLoginChallenge()` keeps it (`sessionStorage["ninja.oauthVerifier"]`),
then opens `/en/auth/callback#loginCode=...`. The FE exchanges it via `POST /api/auth/exchange` (Next rewrite to the BE)
and receives the HttpOnly `ninja_rt` cookie. Google is never contacted. Sessions are never shared between flows, because
refresh tokens rotate. Calls outside the browser (seeding, admin approval) use access tokens signed with the run's secret
(`lib/jwt.mjs`).

## Flows

Each flow also asserts, on every screen it visits: no hydration error, no uncaught exception, no forbidden body text
(`undefined`, `NaN`, `Invalid Date`, raw ISO timestamps, `[object Object]`, untranslated `a.b.c` keys) and no unexpected
failed request.

| # | Flow | Asserts |
|---|---|---|
| 1 | Public SSR | `/en` `/ko` `/zh`, bounty list/detail (rewarded `100 INJ`, `Reward TBD`, past deadline), members, notices, Hall of Fame render DB values with HTTP 200; six 404 variants (unknown path, unknown bounty/notice UUID, unknown nickname, non-UUID id, unknown locale) return 404; unminted NFT copy. |
| 2 | Onboarding | A step-3 user is redirected to `/signup/profile`; live nickname check reports taken/available via `/users/check-nickname`; save lands on get-started and the DB row has nickname, bio and step 4. |
| 3 | Wallet without an extension | Signed-out wallet page asks to sign in; a step-2 user is redirected to `/signup/wallet`; with no `window.ethereum` the button reads "Wallet unavailable" and is disabled; no wallet row is written. |
| 4 | Apply / submit | Signed-in badges on the bounty detail; apply `POST 201` and a PENDING application row; `/applications` lists it; after admin approval (API) submit `POST 201`, panel copy, SUBMITTED revision 1 row. |
| 5 | Agents | Verified and pending agents listed; key rotation shows the full key once and its prefix matches the single ACTIVE key in the DB; after reload only the prefix remains; revoke dialog names the agent and the DB row is REVOKED; a revealed key leaves the DOM on sign-out. |
| 6 | Admin CRUD | Member assignment reflected in the DB and `/members`; deadlines shown in the browser time zone; bounty create with single-select field chips and the typed local deadline stored exactly; past-deadline edits (with and without reward) keep deadline and reward; notice create/publish/edit keeps `published_at` and a plain-text summary; highlight create/edit clears the link to NULL; public pages show the edits. |
| 7 | Cookie session + refresh | `ninja_rt` attributes (host-only, `Path=/api/auth`, Secure, HttpOnly, SameSite=Strict, 14 d) and no token in `document.cookie` or Web Storage; reload restores the session with exactly one refresh and rotates the DB row; an action after access expiry goes `401 → refresh 200 → retry 201` with one DB row; two tabs reloading at once (also with refresh held 1.5 s) both stay signed in with no reuse revocation. |
| 8 | Sign-out | `POST /api/auth/logout 204`, cookie cleared, the other tab flips to signed-out without a request or reload, session revoked, the old refresh token is rejected in cookie and body mode; a refresh rejected mid-session flips the UI to signed-out in the same document and the BE clears the dead cookie. |

Flows depend on each other's data: 7 and 8 use 4's application and 5's agents, so run subsets with that in mind.

## Layout

```
integration/
  run-all.mjs        orchestrator (build, start, seed, run, clean up)
  lib/state.mjs      reads the per-run state.json (ports, origins, DB, secret, seed ids) for flows
  lib/cdp.mjs        minimal CDP driver over Node's WebSocket: contexts, pages, request/console capture, report()
  lib/harness.mjs    sql(), signIn() (callback flow), check()/clean()/done(), form and table helpers
  lib/seed.mjs       seed data
  lib/jwt.mjs        HS256 access tokens with the run's secret
  lib/agent.mjs      agent registration + EIP-191 verification with a random viem account
  lib/tls-proxy.mjs  HTTPS -> HTTP reverse proxy (cert dir passed at runtime)
  flows/flowN.mjs    the flows; each prints ASSERT lines and a final "FLOW n ... COMPLETED x/y"
```

To rerun one flow, rerun the harness with that flow and the flows it depends on (for example `-- 4 5 7`). Services are
always stopped at the end of a run; there is no long-lived stack to attach to.
