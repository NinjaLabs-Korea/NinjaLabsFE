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
- Using an AI agent? `.mcp.json` preconfigures the Figma remote MCP; `AGENTS.md` §Team agent workflow holds the lane ownership map and session rules.

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

**Read `AGENTS.md` before contributing** — it holds the binding conventions (token-only styling, component inventory, Figma node ↔ route mapping, data rules) for humans and AI agents alike. Visual consistency across the Landing / Bounties / Admin owner areas is governed by [`docs/design.md`](docs/design.md) (token semantics + shared UI recipes).

## Remaining work — by owner area

Roles are split into **Landing / Bounties / Admin**. Gaps below are distilled from
[`docs/figma/design-gaps.md`](docs/figma/design-gaps.md) (status + evidence live there); items marked *(blocked)* need design/backend/assets before FE can proceed.

### Landing (`/`, `/notices`, `/members`, `/hall-of-fame`, `/signup/*`)

- Real auth for the signup flow *(blocked on backend)* — Google login is a mock-session preview; wallet connect never authenticates.
- Signup profile validation *(blocked on design/backend)* — "duplicate nickname check" is static copy, `Next` is a plain `Link`, no error visuals.
- Pagination / load-more on notices list *(blocked on design)* — fixed 4-row set, no paging affordance drawn.
- Real assets *(blocked on assets)* — 44px signup mascot raster, member/HoF photos, partner wall, notice thumbnails (currently gradient/initials fallbacks).

### Bounties (`/bounties*`, `/applications`, `/agents`, `/agents/register`)

- Apply submission feedback *(blocked on backend)* — no acknowledgement UI after Apply; `ApplyStatusFlow` lifecycle is display-only.
- Agent Sign & Register — signing/verification is mock-only; verification-failure UI not drawn *(blocked on design)*; agent keys are masked fixtures with no real issuance.
- `/applications` · `/agents` run on the mock-session preview only — need real owner data once backend lands.
- Pagination / load-more on bounty list *(blocked on design)* — fixed 9-card set.
- Real bounty cover images *(blocked on assets)* — all 9 covers render the design-native gradient placeholder.

### Admin (`/admin/*`)

- Access gating *(blocked on backend + design)* — `/admin/*` is publicly reachable; "ADMIN ONLY" badge is decorative; login-wall/forbidden states undesigned.
- Persistence — every manager (users, bounties, hall-of-fame, notices) is session-local demo state; Create/Save/Remove/Assign must be wired to a real API.
- Table pagination *(blocked on design)* — users/bounties recons explicitly leave it unspecified.
- General column sorting *(blocked on design)* — only HoF display-order re-sort is shipped.

### Cross-cutting (whoever touches it first coordinates)

- Backend API + durable state — API mode is deliberately unavailable (`docs/auth-api-contract.md` is the binding contract).
- Logged-in header states reflect the mock-session preview only; real session wiring is backend scope.
- Submit feedback outside admin (public Apply, agent register) still has no toast/feedback path.

## Design source

Figma file `DKvXU0AY4O9UalcHWXQCcI`, canvas “Screens (원본 분리)”. Design data is pulled via the Figma remote MCP; unresolved design gaps are tracked in `docs/figma/design-gaps.md` and the FigJam board linked there.
