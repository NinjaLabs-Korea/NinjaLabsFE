<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# NinjaLabsFE — Project Conventions

Ninja Labs frontend: a builder community & bounty marketplace for the Injective ecosystem.
Pages are ported 1:1 from the Figma design file below. Read this whole file before writing code.

## Stack (pinned — do not upgrade without team decision)

- Next.js 16.2.10 (App Router, Turbopack) / React 19.2.4 / TypeScript 5.9.3
- Tailwind CSS 4.3.3 (v4 — CSS-first config, **no** `tailwind.config.js`)
- Node >= 24 (`.nvmrc`), npm 11 only. **Never** use bun/pnpm/yarn here; `package-lock.json` is the single lockfile.
- All deps are exact-pinned; `.npmrc` has `save-exact=true`. Never introduce `^`/`~` ranges.

## Commands

- `npm run dev` — dev server (localhost:3000)
- `npm run test:unit` — focused foundation unit tests
- `npm run build` — production build; **must pass before any work is considered done**
- `npm run lint` — ESLint

## Styling rules

- **Tailwind utility classes only.** No CSS Modules, no styled-components, no `style={}` props, no new `.css` files.
- The single CSS file is `src/app/globals.css`. Design tokens live there in the Tailwind v4 `@theme` block
  (`--color-*`, `--font-*`, `--radius-*`, ...) and are consumed as utilities (`bg-surface`, `text-accent`, ...).
- New color/spacing/typography values from Figma go into `@theme` as tokens first — never hardcode hex values in components.

## Folder structure

```
src/
  app/                    # App Router routes only (page.tsx, layout.tsx, route groups)
  components/
    layout/               # App shell shared by every page: Header, Footer
    ui/                   # Reusable primitives: Badge, RewardPill, SectionHeader, StepIndicator, ...
    cards/                # Composed cards: BountyCard, NewsCard, MemberCard, ...
  lib/                    # Pure utils, constants, mock data (no React imports)
public/
  figma/                  # Brand/design assets: Figma-exported token icons + user-supplied mascot PNG
```

- Server Components by default; add `"use client"` only where interactivity requires it.
- One component per file, named export matching the filename.

## Figma → code mapping

- File: `https://www.figma.com/design/DKvXU0AY4O9UalcHWXQCcI` (fileKey `DKvXU0AY4O9UalcHWXQCcI`)
- Canvas `19:2` "Screens (원본 분리)" holds every screen. Node IDs:

| Screen | nodeId | Route |
|---|---|---|
| 01 Landing | `19:3` | `/` |
| 05 User Profile (+ Empty `19:422`) | `19:244` | `/members/[id]` |
| 06 Hall of Fame | `19:553` | `/hall-of-fame` |
| 07 Members | `19:704` | `/members` |
| 08 Notices List | `19:851` | `/notices` |
| 09 Notice Detail | `19:977` | `/notices/[id]` |
| 10 Sign Up - Google | `19:1068` | `/signup` |
| 11 Sign Up - Wallet | `19:1159` | `/signup/wallet` |
| 12 Sign Up - Profile | `19:1271` | `/signup/profile` |
| 13 Sign Up - Get Started | `19:1385` | `/signup/get-started` |
| 14 Bounty List | `19:1480` | `/bounties` |
| 15 Bounty Detail | `19:1739` | `/bounties/[id]` |
| 15v Bounty Detail - Apply Variant | `19:1911` | `/bounties/[id]` (state: `applicationRequired`) |
| 16 Bounty Apply (explainer) | `19:2093` | `/bounties/apply` |
| 17 Agent Register | `19:2201` | `/agents/register` |
| 18 Admin - Users | `19:2341` | `/admin/users` |
| 19 Admin - Bounties | `19:2527` | `/admin/bounties` |
| 20 Admin - Hall of Fame | `19:2754` | `/admin/hall-of-fame` |
| 21 Admin - Notices | `19:2937` | `/admin/notices` |
| 30 My Applications (FE) | frame `63:2` on page `FE Captures (22-31)` | `/applications` (owner-private, session-gated) |
| 31 My Agents (FE) | frame `64:2` on page `FE Captures (22-31)` | `/agents` (owner-private, session-gated) |

- `/admin` redirects to `/admin/users`. `/bounties` masthead links to `/bounties/apply` (user-requested addition, no Figma node).
- Admin screens keep the PUBLIC chrome; admin nav is an in-page tab strip (`components/admin/AdminTabs`), no nested layout.

- Design data comes from the Figma remote MCP (`https://mcp.figma.com/mcp`): `get_design_context` for
  per-screen code/screenshot, `get_metadata` for structure, `download_assets` for images.
- Every screen shares the same Header/Footer (rendered once in `src/app/layout.tsx`, not per page).
- Implemented component inventory (37 files; keep in sync with `src/components/`):
  - `layout/Header`, `layout/Footer` — the shared shell chrome (rendered once in `layout.tsx`)
  - `ui/Badge` — pill chip; variants `primary-soft` (default) / `selected` (`bg-primary text-primary-soft`) / `success` / `danger` / `warning` / `neutral` / `inverse` (StepIndicator's white active step is intentional and NOT a Badge)
  - `ui/RewardPill` — `{ amount, currency: 'INJ' | 'USDC' }`; INJ token icon vs `$` glyph
  - `ui/SectionHeader` — eyebrow + heading (`level` 1|2|3, `size` 'lg'|'xl') + optional action link
  - `ui/StepIndicator` — 4-step sign-up progress (`current` 1–4); wraps below 768
  - `cards/BountyCard` — cover (gradient fallback) + Badge + title + optional summary (`showSummary`) + RewardPill + deadline·sponsor
  - `cards/NewsCard` — vertical notice preview (Landing); consumes `NoticePreview`
  - `cards/NoticeRow` — horizontal thumb + content row (Notices list)
  - `cards/MemberCard` — photo/initials fallback + name + role line + bio + links
  - `bounties/BountyFilters`, `notices/NoticeFilters`, `members/MemberFilters` — `"use client"` islands (list filtering + empty states with Reset)
  - `layout/NavLinks` — `"use client"` island for active-nav highlight (`aria-current`); `src/app/error.tsx`/`global-error.tsx` are also client (Next error-boundary contract exception; global-error loads its own globals.css + fonts)
  - `admin/AdminTabs` — in-page admin tab strip (`active` prop); `admin/AdminTable` — lavender-header table (`columns`, `minWidthClass`, `<tr>` children); admin controls are interactive with session-local demo state (disclosed, never persisted)
  - `ui/Modal` (native `<dialog>`: ESC/backdrop/focus-trap built in), `ui/ConfirmDialog` (`destructive` variant = solid `bg-danger` action + danger-soft callout), `ui/Toast` (success/danger/warning/info; danger = `role="alert"`, others auto-dismiss) — FE-designed (no Figma origin), captured back as pages 26–28
  - `admin/UserActions` — `"use client"` island wiring Remove→ConfirmDialog and Assign→role modal; replaces the inline role panel drawn in Figma 18 (user-approved divergence)
  - `admin/AdminSelect` — APG select-only combobox (`role="combobox"` trigger + `aria-activedescendant` listbox, keyboard-complete); `admin/AdminToastHost` — single page-level toast stack (`pushAdminToast`)
  - `admin/UserDirectory`, `admin/BountyManager`, `admin/HighlightManager`, `admin/PostManager` — per-page manager islands (live search/filter, Edit-prefill forms, Create/Save with **session-local demo state**: initialized from registries via props, never mutating `src/lib`, always disclosed as "session preview" in toasts/dialogs/footnote lines); `BountyManager` also manages submission guide, deliverables, and review process values that mirror the public bounty detail meta-row shape in its session preview only (the detail's `deadlineDetail` intentionally has no form input — the single `deadline` field suffices via the public `deadlineDetail ?? deadline` fallback).
  - `ui/Markdown` — server-component markdown renderer (react-markdown + remark-gfm, exact-pinned): `allowedElements` subset (p/a/strong/em/ul/ol/li/h2/h3/code/pre/blockquote/br/del), token-mapped renderers, no `rehype-raw` (raw HTML disabled), external links get `target=_blank rel=noreferrer`; used by bounty detail (description + Submission guide) and notice detail; NO `@tailwindcss/typography`
  - `auth/FoundationProvider` — `"use client"` runtime boundary: mock mode uses an in-memory session preview; API mode exposes an unavailable auth adapter. `layout/AuthArea` + `layout/UserMenu` consume it for desktop account menu and signed-in mobile account disclosure; `signup/CompleteSignupLink` is navigation only.
  - `auth/GoogleLoginButton` — signs into the in-memory mock preview only; API mode reports sign-in unavailable. `wallet/WalletProvider` + `wallet/WalletConnectButton` provide browser wallet connection only, never authentication, account linking, signing, or network-backed identity.
  - `account/ApplicationsView`, `account/AgentsView`, `account/SignedOutPanel` — FoundationProvider-aware `"use client"` views: mock data is session-memory only and resets on reload; API mode is unavailable. `/applications` renders the 15v apply lifecycle strip (`ol` with `aria-current="step"`); `/agents` displays masked fixture API-key values only, which cannot be unmasked in the UI. Owner views are separate from the public profile projection by design (private data: keys, application notes).
- Data: typed registries and contracts in `src/lib/` (`types.ts` is the shared public-data contract; `contracts/` defines frontend boundaries; `mocks/` supplies deterministic fixtures and the mock API client, with `mocks/fixtures.ts` as the canonical account fixture source; `foundation/` supplies unavailable API/auth adapters; `bounties`/`notices`/`members`/`hall-of-fame`/`landing`/`signup`; `admin.ts` = keyed admin adapters/overlays — public registries untouched, draft posts exist only there). List+detail derive from one record; `generateStaticParams` enumerates registry slugs; unknown → `notFound()`; empty-profile demo id is `PROFILE_EMPTY_ID` (`sora`).
- Long-form prose is **markdown by contract**: `Bounty.descriptionMarkdown` + optional `Bounty.submissionGuideMarkdown`, `Notice.bodyMarkdown` — rendered via `ui/Markdown`; structured fields (`deliverables[]`, `completionSteps[]`, `reviewProcess`) stay typed, never markdown.
- Bounty deadlines: `deadline` is the list label (`D-7`), `deadlineDetail` the full timestamp shown on detail (19:1480 vs 19:1739).
- Figma raster exports render **empty** via the export API (recorded as `figma-render-empty` in `src/lib/assets.ts`); covers/thumbnails use the design-native gradient placeholder. The two SVGs and one user-supplied mascot PNG in `public/figma/` are the available assets; the mascot PNG is not a Figma export.
- Every user-visible route has metadata (`metadata` or variant-aware `generateMetadata`); the landing page inherits root-layout metadata and `/admin` (redirect-only) is exempt; app-level states: branded `not-found.tsx`/`error.tsx`/`global-error.tsx`, `loading.tsx` skeletons on the 3 dynamic routes, skip-to-content link, `icon.png` favicon (scaffold favicon.ico removed).
- Design-required gaps (auth states, form errors, confirmations, pagination, real assets) are tracked in `docs/figma/design-gaps.md` + the FigJam board linked there.

## Definition of done

1. Matches the Figma screen (verify against `get_screenshot` of the node).
2. Tokens from `@theme`, no hardcoded values, Tailwind-only styling.
3. `npm run test:unit`, `npm run build`, and `npm run lint` pass. Browser-check the mock SPA, API isolation (unavailable with no fetch), wallet connect/disconnect (no auth change), masked agent keys, and mobile account disclosure where affected.
