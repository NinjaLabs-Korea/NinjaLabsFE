# Real-browser integration harness

End-to-end regression run of this FE (api mode) against a real NinjaLabsBE and a private Postgres, driven through
headless Chrome over the DevTools Protocol. It catches what `npm run test:unit` and the BE e2e suite cannot: hydration
errors, streaming/SSR output, real BE response shapes, cookie attributes, refresh races between tabs, and DB side effects
of UI actions.

It is **not part of the required CI checks** (it needs Chrome, Postgres binaries and a BE checkout, and takes 15+ minutes).
`.github/workflows/integration.yml` runs it on demand (`workflow_dispatch`, input `be_ref` = the BE branch/tag/SHA, default
`main`) and nightly, and uploads `integration/.logs` as an artifact. Run it locally before merging anything that touches
auth, the data layer, routing or a whole user flow.

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
NINJA_BE_DIR=../NinjaLabsBE npm run test:integration          # flows 1-10
NINJA_BE_DIR=../NinjaLabsBE npm run test:integration -- 1 3    # a subset
NINJA_IT_CHROME_FLAGS="--no-sandbox"  # extra Chrome flags (Linux CI)
npm run test:integration -- --reap    # stop + delete the leftovers of dead runs
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
   stopped, temp dir removed), including on failure or Ctrl-C. A SIGKILL of the harness cannot run that code, so see
   [Killed runs](#killed-runs). `NINJA_IT_KEEP_TMP=1` keeps the temp dir for debugging (marked `kept`: later runs skip it, `--reap` removes it).

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

### Killed runs

As soon as anything starts, the run writes `$TMPDIR/ninja-it-*/pids.json` (harness pid, the process groups of BE, FE, proxies
and Chrome, the Postgres data dir). Two things use it:

- a small detached watchdog (`lib/watchdog.mjs`) polls the harness pid and tears the run down if the harness dies without
  cleaning up (for example a tool timeout sending SIGKILL);
- the reaper (`lib/reaper.mjs`) runs at every start and as `npm run test:integration -- --reap`: for each `ninja-it-*` dir whose
  harness is dead it runs `pg_ctl stop -m immediate`, kills the recorded process groups and deletes the dir. Dirs of a live
  harness are never touched, so parallel runs on different ports are safe.
- pids.json is not the only source: teardown and `--reap` also scan the process table (`ps` + `lsof -d cwd` on macOS, `/proc` on
  Linux) for any process whose cwd or command line points into `$TMPDIR/ninja-it-*`, so orphans survive neither a deleted temp
  dir nor a process that escaped its group (e.g. a `next-server` whose `cwd` is a deleted `ninja-it-XXXX/fe`). The temp dir is
  deleted only after every recorded group and stray process is confirmed dead; otherwise it stays and `--reap` retries.
  The matching rule lives in `runDirOf()` (`lib/reaper.mjs`) and is pinned by `src/test/integration-reaper-scan.test.ts`.

If a run stops with "port ... is in use", run `--reap` first. A leftover from before this mechanism existed has no `pids.json`;
stop it by hand (`pg_ctl -D <dir>/pg stop -m immediate`).

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
| 9 | Legacy migration + CSRF | A body-mode refresh token in `localStorage["ninja.refreshToken"]` is migrated by one `POST /api/auth/refresh` (`X-Ninja-Session: cookie`): `ninja_rt` planted, both legacy keys removed, the legacy row revoked with the cookie as its successor, the next reload sends an empty body; a cross-site-style refresh/logout with the cookie but without `X-Ninja-Session` (through the FE rewrite and on the BE) gets 400/401, no `Set-Cookie`, and does not rotate the session; replaying the migrated legacy token is reuse and revokes the chain. |
| 10 | Payout policy + re-apply | Two admins (flow creates `g-admin2`): deleting a funded bounty is 409 `BOUNTY_HAS_OPEN_FUNDS`; admin 1 requests a payout and cannot approve it (403 `PAYOUT_SELF_APPROVAL`); admin 2 approves; delete stays 409 while the payout is open; audit rows name both admins. Then a builder applies in the FE, withdraws (API: the FE has no withdraw control yet), re-applies in the FE: the same application row is PENDING again with the new portfolio URL and `/applications` lists it. Runs last because it leaves an open payout on B1. |

Flows depend on each other's data: 7 and 8 use 4's application and 5's agents, 9 uses 4's application and 5's agents (PendingBot), 10 uses B1's deposit, so run subsets with that in mind.

## Layout

```
integration/
  run-all.mjs        orchestrator (build, start, seed, run, clean up)
  lib/state.mjs      reads the per-run state.json (ports, origins, DB, secret, seed ids) for flows
  lib/cdp.mjs        minimal CDP driver over Node's WebSocket: contexts, pages, request/console capture, report()
  lib/harness.mjs    sql(), signIn() (callback flow), check()/clean()/done(), form and table helpers
  lib/seed.mjs       seed data
  lib/jwt.mjs        HS256 access tokens with the run's secret
  lib/reaper.mjs     pids.json bookkeeping, stale-run teardown (`--reap`)
  lib/watchdog.mjs   detached: tears a run down when the harness pid dies
  lib/agent.mjs      agent registration + EIP-191 verification with a random viem account
  lib/tls-proxy.mjs  HTTPS -> HTTP reverse proxy (cert dir passed at runtime)
  flows/flowN.mjs    the flows; each prints ASSERT lines and a final "FLOW n ... COMPLETED x/y"
```

To rerun one flow, rerun the harness with that flow and the flows it depends on (for example `-- 4 5 7`). Services are
always stopped at the end of a run; there is no long-lived stack to attach to.
