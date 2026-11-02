# NinjaLabsFE

Frontend for Ninja Labs, a builder community and bounty marketplace for the Injective ecosystem. Builders join the community, take on bounties, and every completed bounty mints an on-chain NFT that becomes a portfolio they own. The backend is [NinjaLabsBE](https://github.com/NinjaLabs-Korea/NinjaLabsBE).

Production: https://ninjalabs-korea-platform.vercel.app

| | |
|---|---|
| Stack | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 · Tailwind CSS 4 (`@theme` tokens, no `tailwind.config.js`) |
| Wallet | wagmi 3 + viem, injected wallets only (no WalletConnect for now) |
| i18n | `en` / `ko` / `zh` with next-intl, every URL is locale-prefixed |
| Runtime | Node 24 (`.nvmrc`) · **npm only**, all dependencies exact-pinned |
| Branches | `develop` = integration (Vercel preview) · `main` = production (Vercel) |

## Quick start

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev      # http://localhost:3000
```

The default `.env.example` runs in **mock mode**: every page renders from local fixtures and no backend is needed. Good for UI work.

To run against a real backend, start NinjaLabsBE locally (see its README; it listens on `http://localhost:4000` and already allows `http://localhost:3000`), then set in `.env.local`:

```bash
NINJA_RUNTIME_MODE=api
NINJA_API_BASE_URL=http://localhost:4000
```

Do not point a local FE at the production backend: production CORS deliberately rejects `localhost`.

### Environment variables

All of these are documented inline in [`.env.example`](.env.example). None of them are secrets.

| Variable | What it does |
|---|---|
| `NINJA_DEPLOYMENT_TIER` | `local`, `test`, `staging` or `production` |
| `NINJA_RUNTIME_MODE` | `mock` (local/test only) or `api` |
| `NINJA_MOCK_SEED` | Fixture scenario for mock mode |
| `NINJA_APP_ORIGIN` | Exact browser origin of this app |
| `NINJA_API_BASE_URL` | Backend base URL (api mode). `/api/auth/*` and `/media/*` are proxied here |
| `NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID`, `NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL` | Wallet network. Chain ID and RPC host must be the same network (`1776` mainnet, `1439` testnet) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional Cloudflare Turnstile on sign-in. Deploy this **before** the backend secret |
| `NEXT_PUBLIC_ONBOARDING_DEBUG` | Optional auth/onboarding console logs |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run lint` | ESLint |
| `npx next typegen && npx tsc --noEmit` | Type check (run `typegen` first or route `PageProps` types are missing) |
| `npm run test:unit` | Vitest unit and guard tests (includes en/ko/zh message parity) |
| `npm run build` | Production build. Must pass before any work is done |
| `npm run test:integration` | Real-browser harness against a real backend and Postgres ([integration/README.md](integration/README.md)) |

CI runs lint, type check, unit tests, build and a blocking `npm audit` on every PR. The integration harness runs nightly and on demand, not on every PR; run it locally before merging changes to auth, the data layer, routing, or a whole user flow.

## Pages

| Area | Routes |
|---|---|
| Community (public) | `/` hub · `/about` · `/members`, `/members/[id]` · `/hall-of-fame` · `/notices`, `/notices/[id]` · `/recruit` (cohort application) |
| Bounties | `/bounties`, `/bounties/[id]`, `/bounties/apply` · `/applications` (my applications) |
| Agents | `/agents` · `/agents/register` · `/skill.md` (agent-readable guide) |
| Account | `/signup` → `/signup/wallet` → `/signup/profile` → `/signup/get-started` · `/auth/callback` · `/home` (my activity) · `/account` |
| Admin (`is_admin` only) | `/admin` · `users` · `bounties` · `operations` (deposits, reviews, payouts) · `nft-jobs` · `hall-of-fame` · `notices` · `recruitment` · `audit` |
| Legal | `/privacy` · `/terms` |

Every route lives under `src/app/[locale]/`. Admin access is enforced by the backend's `AdminGuard`; the FE only hides what a non-admin cannot use.

## Code layout

```
src/app/[locale]/   routes (one folder per page above) + error, loading and 404 states
src/components/     ui/ primitives · layout/ header, footer, shell · cards/ · hooks/ shared client hooks
                    feature folders: auth, wallet, signup, account, bounties, agents, members, notices,
                    community, home, recruit, admin, legal
src/lib/            pure logic, no React: api/ (http client, codecs, error copy), contracts/ (typed API shapes),
                    single-source rules (bounty-status.ts, bounty-categories.ts, input-limits.ts, ...), mocks/
src/i18n/           next-intl routing, navigation, message loading
messages/<locale>/  one JSON file per namespace, identical keys across en/ko/zh
integration/        real-browser regression harness (flows 1-17)
docs/               design rules, auth/API contract, Figma recon
```

## Before you contribute

**Read [`AGENTS.md`](AGENTS.md) first.** It is the binding rulebook for humans and AI agents: pinned stack, git flow, token-only styling, the component inventory (reuse before you build), Figma node ↔ route mapping, i18n rules, and the definition of done.

| Document | What is in it |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Conventions, component inventory, Figma mapping, definition of done |
| [`docs/design.md`](docs/design.md) | Design token meanings and shared UI recipes |
| [`docs/auth-api-contract.md`](docs/auth-api-contract.md) | Login, session cookie and API contract with the backend |
| [`integration/README.md`](integration/README.md) | How to run the browser harness and what each flow checks |
| [`docs/figma/`](docs/figma/) | Screen recon, frozen screen matrix, known design gaps |

### Branches and releases

- Work on `<type>/<slug>` branches off `develop` and open the PR against `develop`. Commits follow Conventional Commits.
- Releases are a PR from `develop` to `main`, merged with a **merge commit** (no squash or rebase). Merging to `main` deploys production on Vercel.
- If a change needs a new backend route or field, the backend ships first (its `main` merge is a production deploy). See the backend's `docs/runbook.md`.

### Design source

Figma file [`assDqL6bnfovzvql7XlcH1`](https://www.figma.com/design/assDqL6bnfovzvql7XlcH1/ninjalabs-design?node-id=31-3) (node `31-3`, screens 01-21). The older file `DKvXU0AY4O9UalcHWXQCcI` is only referenced by `docs/figma/recon/*`. Intentional differences from the design are listed in [`docs/figma/design-gaps.md`](docs/figma/design-gaps.md).
