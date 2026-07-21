# NinjaLabsFE

Ninja Labs frontend — a builder community & bounty marketplace for the Injective ecosystem. Every completed bounty mints an on-chain NFT that builds a portfolio the builder owns.

Ported 1:1 from the team Figma file (25 screens: 21 designed + 4 FE-state pages captured back). The current foundation is a **frontend-only runtime preview**: `FoundationProvider` supplies an in-memory mock session only in local/test mock mode; API mode is explicitly unavailable and makes no backend fetch. It does not provide production authentication, durable state, wallet verification, or usable API keys. Wallet connection never authenticates an account. See [`docs/auth-api-contract.md`](docs/auth-api-contract.md) for the binding runtime boundary, environment contract, and deferred production-security gate.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.9
- Tailwind CSS 4 (CSS-first `@theme` tokens — no `tailwind.config.js`, no other CSS)
- Node ≥ 24 (`.nvmrc`) · **npm only** (`package-lock.json` is the single lockfile; deps exact-pinned)

## Getting started

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev      # http://localhost:3000
```

- `npm run test:unit` — focused foundation unit tests
- `npm run build` — production build (all routes statically generated)
- `npm run lint` — ESLint
- Browser-check the mock SPA, API isolation (unavailable with no fetch), wallet connect/disconnect without auth changes, masked agent-key display, and mobile account disclosure after relevant changes.

## Layout

```
src/app/          routes (public: /, /bounties, /notices, /members, /hall-of-fame, /signup/*,
                  /agents/register · admin: /admin/*) + 404/error/loading states
src/components/   layout (shell and mobile account disclosure) · auth (FoundationProvider/runtime auth) ·
                  wallet (connection only) · account (applications/agents) · ui (primitives) · cards · filter islands · admin
src/lib/          typed public registries plus contracts, deterministic mocks, and unavailable API/auth adapters
public/figma/     assets exported from Figma
docs/figma/       screen recon, frozen design contracts (screen-matrix.md), design-gaps.md
```

**Read `AGENTS.md` before contributing** — it holds the binding conventions (token-only styling, component inventory, Figma node ↔ route mapping, data rules) for humans and AI agents alike.

## Design source

Figma file `DKvXU0AY4O9UalcHWXQCcI`, canvas “Screens (원본 분리)”. Design data is pulled via the Figma remote MCP; unresolved design gaps are tracked in `docs/figma/design-gaps.md` and the FigJam board linked there.
