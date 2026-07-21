# NinjaLabsFE Design System

Single source of truth for visual consistency. With ownership split across **Landing / Bounties / Admin**,
every area MUST build from the same tokens and recipes below — do not invent per-area colors, radii, or
button styles. Tokens live in the `@theme` block of `src/app/globals.css`; this doc explains what each one
means and gives copy-paste recipes for the recurring patterns.

Rules of engagement (binding, same as `AGENTS.md`):

1. **Tailwind utilities only** — no CSS files, no `style={}`, no CSS Modules.
2. **Tokens first** — a new color/size from Figma goes into `@theme` before it appears in a component. Never hardcode hex.
3. **Arbitrary values** (`px-[21px]`, `h-[46px]`) are allowed only when they transcribe an exact Figma measurement that has no token/scale equivalent.
4. Reuse the recipes below before writing a new variant. If a screen genuinely needs a new pattern, add it here in the same PR.

## Color roles

| Token | Utility | Use for |
|---|---|---|
| `page` `#FBFBFE` | `bg-page` | App background (set once in layout) |
| `surface` `#FFFFFF` | `bg-surface` | Cards, panels, table bodies |
| `surface-subtle` `#F5F6FB` | `bg-surface-subtle` | Empty panels, future steps, neutral badge fill |
| `ink` `#111A2E` | `text-ink` | Headings, primary text |
| `ink-secondary` `#4F5D77` | `text-ink-secondary` | Nav, rich body copy, table cells |
| `ink-muted` `#77839C` | `text-ink-muted` | Metadata, excerpts, footnotes |
| `ink-placeholder` `#9CA3AF` | `placeholder:text-ink-placeholder` | Input placeholders |
| `primary` `#4D3DFF` | `bg-primary` / `text-primary` | Solid CTAs, eyebrows, active chips, focus outline |
| `primary-strong` `#3D2ED9` | `text-primary-strong` | Outline-button labels, badge text |
| `primary-soft` `#EEEFFF` | `bg-primary-soft` | Badge/pill/callout fills |
| `primary-soft-border` `#DFDDFF` | `border-primary-soft-border` | RewardPill border |
| `primary-outline` `#C3BEFF` | `border-primary-outline` | Outline-button borders |
| `border` `#E3E7F1` | `border-border` | Card/table hairlines |
| `border-dashed` `#D1D7E6` | `border-border-dashed` | Dashed upload/empty frames |
| `success` / `success-soft` | `text-success` on `bg-success-soft` | Verified, open, positive badges |
| `danger` / `danger-soft` | `text-danger` on `bg-danger-soft` | Destructive actions, error toasts |
| `warning` / `warning-soft` | `text-warning` on `bg-warning-soft` | Pending, caution states |
| `inverse-surface` `#0B1322` | `bg-inverse-surface` | Footer, dark hero panels |
| `on-inverse` (+`-secondary`, `-muted`) | `text-on-inverse*` | Text on dark surfaces and solid-primary buttons |
| `hero-from/via/to`, `glow`, `accent-soft`, `nft-deep` | gradient stops | Hero + NFT gradient surfaces only |

Status colors always pair `*-soft` fill with the saturated `*` text — same contract as `ui/Badge`.

## Typography

- `font-display` (Space Grotesk) — headings, brand, big numbers. `font-sans` (Inter) — everything else. No other fonts.
- Type scale is paired with its leading in `@theme`; use scale steps (`text-xs` … `text-hero`), never raw `text-[NNpx]`:

| Step | px | Role |
|---|---|---|
| `text-xs` | 12/18 | Badges, footnotes, session-preview disclaimers |
| `text-sm` | 14/20 | Buttons, body-secondary, table cells |
| `text-base` | 16/24 | Body, large CTAs |
| `text-lg` | 18/28 | Lead paragraphs |
| `text-xl` | 20/30 | Brand wordmark, card titles |
| `text-2xl` | 24/27.6 | H2 |
| `text-4xl` | 36/41.4 | Section heroes |
| `text-5xl` | 48/55.2 | H1 |
| `text-hero` | 60/63 | Landing hero only |

## Radius semantics

| Token | px | Use for |
|---|---|---|
| `rounded-card` | 20 | Cards, list rows, empty-state frames |
| `rounded-panel` | 28 | Large panels (hero frames, signup panels) |
| `rounded-tile` | 14 | Inner tiles, avatar tiles |
| `rounded-control` | 10 | Buttons, inputs, selects |
| `rounded-logo` | 8 | Logo marks |
| `rounded-full` | — | Badges, pills, chips, avatars |

Never mix: a button is always `rounded-control`, a card always `rounded-card`.

## Shadows & container

- `shadow-card` — resting cards. `hover:shadow-frame` — card hover lift (see BountyCard). `shadow-frame` — floating frames/modals. `shadow-nft` — NFT tiles only. `shadow-tile-text` — text legibility on gradient tiles.
- Page shell (every route's top-level wrapper): `mx-auto max-w-content px-6 py-16 pb-20` (error/404 pages use `py-24 text-center`). Do not introduce other max-widths or paddings for page shells.

## Recipes (copy verbatim)

**Focus ring (every interactive element):**

```
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
```

**Primary (solid) CTA** — public pages:

```
rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 + focus ring
```

(`text-base` + larger padding only for hero/signup full-width CTAs.)

**Secondary (outline) action:**

```
rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 + focus ring
```

**Disabled:** add `opacity-50` (or `disabled:opacity-60` for async buttons) + `disabled` attr; keep the same recipe otherwise.

**Admin solid button** — existing admin managers use `text-primary-soft` on `bg-primary` (`h-11`/`h-[45px]`, `px-4`); keep that inside `/admin/*` for consistency with shipped screens. Do not port it to public pages — public solid CTAs stay `text-on-inverse`.

**Card shell:**

```
rounded-card border border-border bg-surface shadow-card [interactive: transition-shadow hover:shadow-frame + focus ring]
```

**Empty state / placeholder frame:**

```
rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center
```

with `font-display` title, `text-ink-muted` copy, and one CTA using the recipes above.

**Status chip:** use `ui/Badge` — variants `primary-soft` (default) / `selected` / `success` / `danger` / `warning` / `neutral` / `inverse`. Never hand-roll a chip; if a new status appears, add a Badge variant.

**Reward display:** always `ui/RewardPill` (`{ amount, currency: 'INJ' | 'USDC' }`) — never re-create the token-icon + amount pair.

**Section heading:** always `ui/SectionHeader` (eyebrow + heading + optional action link) — the action link already carries the outline-button recipe.

**Feedback:** modals via `ui/Modal` (native `<dialog>`), destructive confirms via `ui/ConfirmDialog` (`destructive` = solid `bg-danger`), toasts via `ui/Toast` (danger = `role="alert"`, persistent; others auto-dismiss). Admin pages push through `admin/AdminToastHost` (`pushAdminToast`).

**Session-preview disclosure (admin):** every session-local Create/Save form ends with

```
<p class="mt-3 text-xs text-ink-muted">Session preview — changes are local to this tab and reset on reload.</p>
```

## Per-area checklist before PR

- [ ] Every color/size traces to a `@theme` token or a documented Figma px value.
- [ ] Buttons/chips/cards use the recipes above (no new one-off variants).
- [ ] Headings use `font-display`; body uses the type scale (no `text-[NNpx]`).
- [ ] All interactive elements have the shared focus ring.
- [ ] Empty/loading/error states reuse the shipped patterns (dashed frame, skeletons, branded error pages).
- [ ] Screen verified against its Figma node (`docs/figma/screen-matrix.md` mapping) and `npm run build` + `npm run lint` pass.
