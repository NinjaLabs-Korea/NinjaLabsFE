# NinjaLabsFE

Ninja Labs frontend — a builder community & bounty marketplace for the Injective ecosystem. Every completed bounty mints an on-chain NFT that builds a portfolio the builder owns.

Ported from the team Figma file with explicit mock and API runtime modes. Mock mode is local/test-only; production API mode integrates NinjaLabsBE authentication, onboarding, wallets, agents, bounties, applications/submissions, members, notices, Hall of Fame, and admin management. See [`docs/auth-api-contract.md`](docs/auth-api-contract.md).

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
- Browser-check the local mock SPA, API authentication/onboarding, wallet verification, agent registration, masked agent-key display, and mobile account disclosure after relevant changes.
- Using an AI agent? `.mcp.json` preconfigures the Figma remote MCP; `AGENTS.md` §Team agent workflow holds the lane ownership map and session rules.

## Layout

```
src/app/          routes (public: /, /bounties, /notices, /members, /hall-of-fame, /signup/*,
                  /agents/register · admin: /admin/*) + 404/error/loading states
src/components/   layout (shell and mobile account disclosure) · auth (FoundationProvider/runtime auth) ·
                  wallet (connection + verification) · signup (profile/completion persistence) · account · ui · cards · admin
src/lib/          typed contracts, local/test fixtures, and backend API adapters
public/figma/     assets exported from Figma
docs/figma/       screen recon, frozen design contracts (screen-matrix.md), design-gaps.md
```

**Read `AGENTS.md` before contributing** — it holds the binding conventions (token-only styling, component inventory, Figma node ↔ route mapping, data rules) for humans and AI agents alike. Visual consistency across the Landing / Bounties / Admin owner areas is governed by [`docs/design.md`](docs/design.md) (token semantics + shared UI recipes).

## Remaining work — by owner area

Roles are split into **Landing / Bounties / Admin**. Gaps below are distilled from
[`docs/figma/design-gaps.md`](docs/figma/design-gaps.md) (status + evidence live there); items marked *(blocked)* need design/backend/assets before FE can proceed.

### Landing (`/`, `/notices`, `/members`, `/hall-of-fame`, `/signup/*`)

- Public landing, members/profiles, notices, and Hall of Fame data come from the backend in API mode.
- Real-time nickname availability feedback remains open; submit-time validation and backend conflict handling are implemented.
- Pagination / load-more on notices list *(blocked on design)* — fixed 4-row set, no paging affordance drawn.
- Admin-uploaded notice and Hall of Fame images persist through the backend; missing records still use gradient/initials fallbacks. Member photos and the partner wall remain asset/content work.

### Bounties (`/bounties*`, `/applications`, `/agents`, `/agents/register`)

- Apply/Submit, Agent Sign & Register, `/applications`, and `/agents` use authenticated backend APIs in production.
- Pagination / load-more on bounty list *(blocked on design)* — fixed 9-card set.
- Bounty submission mode (`direct` or agent API) and admin-uploaded cover images are backend-owned in production; records without a cover use the design-native gradient fallback.

### Admin (`/admin/*`)

- Data and mutations are protected by backend AdminGuard; non-admin requests cannot read or change admin records.
- Users, bounties, Hall of Fame, notices, and their uploaded images persist through the admin API in production.
- Table pagination *(blocked on design)* — users/bounties recons explicitly leave it unspecified.
- General column sorting *(blocked on design)* — only HoF display-order re-sort is shipped.

### Cross-cutting (whoever touches it first coordinates)

- Production content must be created through an `is_admin` account; an empty database intentionally renders empty public collections rather than fixture data.

## Design source

Figma file `DKvXU0AY4O9UalcHWXQCcI`, canvas “Screens (원본 분리)”. Design data is pulled via the Figma remote MCP; unresolved design gaps are tracked in `docs/figma/design-gaps.md` and the FigJam board linked there.
