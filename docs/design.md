# NinjaLabsFE Design System

Single source of truth for visual consistency. With ownership split across **Landing / Bounties / Admin**,
every area MUST build from the same tokens and recipes below - do not invent per-area colors, radii, or
button styles. Tokens live in the `@theme` block of `src/app/globals.css`; this doc explains what each one
means and gives copy-paste recipes for the recurring patterns.

Rules of engagement (binding, same as `AGENTS.md`):

1. **Tailwind utilities only** - no CSS files, no `style={}`, no CSS Modules.
2. **Tokens first** - a new color/size from Figma goes into `@theme` before it appears in a component. Never hardcode hex.
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

Status colors always pair `*-soft` fill with the saturated `*` text - same contract as `ui/Badge`.

## Typography

- `font-display` (Space Grotesk) - headings, brand, big numbers. `font-sans` (Inter) - everything else. No other fonts.
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
| `rounded-full` | - | Badges, pills, chips, avatars |

Never mix: a button is always `rounded-control`, a card always `rounded-card`.

## Shadows & container

- `shadow-card` - resting cards. `hover:shadow-frame` - card hover lift (see BountyCard). `shadow-frame` - floating frames/modals. `shadow-nft` - NFT tiles only. `shadow-tile-text` - text legibility on gradient tiles.
- Page shell (every route's top-level wrapper): `mx-auto max-w-content px-6 py-16 pb-20` (error/404 pages use `py-24 text-center`). Do not introduce other max-widths or paddings for page shells.

## Recipes (copy verbatim)

**Focus ring (every interactive element):**

```
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
```

**Primary (solid) CTA** - public pages:

```
rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 + focus ring
```

(`text-base` + larger padding only for hero/signup full-width CTAs.)

**Secondary (outline) action:**

```
rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 + focus ring
```

**Disabled:** add `opacity-50` (or `disabled:opacity-60` for async buttons) + `disabled` attr; keep the same recipe otherwise.

**Admin solid button** - existing admin managers use `text-primary-soft` on `bg-primary` (`h-11`/`h-[45px]`, `px-4`); keep that inside `/admin/*` for consistency with shipped screens. Do not port it to public pages - public solid CTAs stay `text-on-inverse`.

**Card shell:**

```
rounded-card border border-border bg-surface shadow-card [interactive: transition-shadow hover:shadow-frame + focus ring]
```

**Empty state / placeholder frame:**

```
rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center
```

with `font-display` title, `text-ink-muted` copy, and one CTA using the recipes above.

**Logo tile (partner wall):**

```
flex h-28 items-center justify-center rounded-card border border-border bg-surface p-5 shadow-card
```

with a `next/image` `object-contain` logo in an `h-12` box; linked tiles add `transition-shadow hover:shadow-frame` + focus ring. Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Hide the whole section when there are no logos - never render an empty wall.

**Header dropdown menu:** use `layout/useMenuButton` with `menuPanelClass` (`rounded-tile border border-border bg-surface p-1.5 shadow-frame`, right-aligned under the trigger) and `menuItemClass`; mark the selected item with `font-semibold text-ink` + a `text-primary` ✓. Triggers read as header text (`text-sm font-semibold text-ink-secondary`, no fill) unless they carry identity (the account chip). Do not use native `<select>` in the header: its OS-styled popup cannot match.

**Status chip:** use `ui/Badge` - variants `primary-soft` (default) / `selected` / `success` / `danger` / `warning` / `neutral` / `inverse`. Never hand-roll a chip; if a new status appears, add a Badge variant.

**Reward display:** always `ui/RewardPill` (`{ amount, currency: 'INJ' | 'USDC' }`) - never re-create the token-icon + amount pair.

**Section heading:** always `ui/SectionHeader` (eyebrow + heading + optional action link) - the action link already carries the outline-button recipe.

**Feedback:** modals via `ui/Modal` (native `<dialog>`), destructive confirms via `ui/ConfirmDialog` (`destructive` = solid `bg-danger`), toasts via `ui/Toast` (danger = `role="alert"`, persistent; others auto-dismiss). Admin pages push through `admin/AdminToastHost` (`pushAdminToast`), which also owns a persistent `sr-only` `aria-live="polite"` region for the non-danger toasts.

**Live announcements:** a `role="status"` that mounts together with its message is not reliably announced. Where a panel swaps whole sections after an action (bounty apply/submit, toast host), keep one `sr-only` `aria-live="polite"` element mounted from the first render and write the success copy into it; reserve `role="alert"` for danger/errors, and move focus to the new section's `tabIndex={-1}` heading (focus ring recipe) when the control that was used disappears.

**Form fields:** every text control has a visible label - `<label className="block">` wrapping a `mb-1.5 block text-sm font-semibold text-ink` span and the control (`h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder` + focus ring; textareas `px-3 py-3`). Placeholders may stay as hints but never replace the label; disabled preview forms (signed-out bounty panel) may use `aria-label` instead. On a failed request set `aria-invalid` + `aria-describedby` on the form's inputs pointing at the inline `text-sm text-danger` `role="alert"` paragraph (`aria-[invalid]:border-danger`). Per-field hints and live character counters are `mt-1 text-xs text-ink-muted` (counter right-aligned, `{count}/{max}`) with an `id` that the control lists in `aria-describedby` before the error id; an availability line (sign-up nickname) is a `role="status" aria-live="polite"` paragraph that switches to `text-success` / `text-danger`.

**Reduced motion:** honour `prefers-reduced-motion`. Every `animate-*` utility and every `transition-*` that moves or resizes content pairs with `motion-reduce:animate-none` / `motion-reduce:transition-none`; the detail-route skeletons use `animate-pulse motion-reduce:animate-none`. Shadow/color-only transitions (`transition-shadow` on cards) do not move content and stay as they are.

**Soft danger action (account pages):** `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60` + focus ring - the non-admin counterpart of the warning-soft "Switch network" button; it only opens a destructive `ui/ConfirmDialog` (AgentsView "Revoke agent"), never performs the action itself.

**One-time secret reveal:** always `agents/ApiKeyReveal` - `rounded-tile border border-success-soft bg-success-soft p-4`, a `text-sm font-semibold text-success` title, `text-xs text-ink-secondary` copy telling the user it will not be shown again, the secret in a read-only `<input>` (`rounded-control border border-border bg-surface p-3 font-mono text-xs text-ink`, selects on focus, `sr-only` label) beside a secondary-outline "Copy" button (`px-4 py-2`), then a `text-xs` `role="status"` line that only announces "API key ready — copy it now" / "copied" / the `text-warning` clipboard-unavailable fallback, and the expiry in `text-xs text-ink-muted`. The secret is never inside a live region. Used by `agents/AgentRegisterForm` (first issuance) and `account/AgentsView` (rotation, one tile per agent); the raw value lives only in component state.

**Inline action feedback (account pages, no toast host):** warnings as `text-sm text-warning` with `role="status"` (key expiring/expired), failures as `text-sm text-danger` with `role="alert"`, secondary context as `text-sm text-ink-secondary` (e.g. the "Handled by your agent" status panel body on bounty detail). Session/list loading on account pages is a single `text-sm text-ink-muted` line with `role="status"` (`account.common.loading`), never a blank panel.

**Focus after a destructive confirm:** when the confirmed action removes or disables the button that opened the `ui/ConfirmDialog`, pass `returnFocusTo` so focus lands on the affected card's heading (`tabIndex={-1}` + focus ring) instead of `<body>`; cancelling still returns focus to the opener.

**Admin persistence disclosure:** API-mode Create/Save forms state that changes are saved immediately. Destructive actions require confirmation and failures surface a danger toast.

## Third-party widgets

**Cloudflare Turnstile** (`components/auth/TurnstileWidget.tsx`, sign-in only, when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set): the iframe is Cloudflare's own UI (`theme: "auto"`, `language` from the locale) and cannot use our tokens. Its container is centered under the Google button with `mt-4` and reserves `min-h-[65px]` - Cloudflare's fixed "normal" widget height - so the card does not jump when the iframe mounts. Status copy uses the existing helper-text recipe (`text-sm text-ink-muted`, `role="status"`); the error uses `text-danger` in a `role="alert"` with a text-link retry (same recipe as the mock "Preview failed sign-in" link). No Figma frame (docs/figma/design-gaps.md).

## Navigation loading

Primary public navigation (including Home and Browse) uses `prefetch={true}` so dynamic page content can load before a click. Keep full prefetching limited to these few high-traffic links; card lists retain the default behavior. Public API requests remain `no-store`; prefetched route payloads are held in Next.js's client router cache.

Only the three dynamic detail routes have `loading.tsx` skeletons. Do not add a shared `[locale]/loading.tsx` or any loading boundary above `[id]`: streaming would start before `[id]/layout.tsx` checks that the record exists, so unknown ids would return 200 instead of 404. Skeletons reuse the page shell, `bg-surface-subtle`, and existing control/tile/card radii; announce loading with `role="status"` and screen-reader text, hide decorative skeletons from assistive technology, and use `animate-pulse motion-reduce:animate-none`.

## Per-area checklist before PR

- [ ] Every color/size traces to a `@theme` token or a documented Figma px value.
- [ ] Buttons/chips/cards use the recipes above (no new one-off variants).
- [ ] Headings use `font-display`; body uses the type scale (no `text-[NNpx]`).
- [ ] All interactive elements have the shared focus ring.
- [ ] Empty/loading/error states reuse the shipped patterns (dashed frame, skeletons, branded error pages).
- [ ] Screen verified against its Figma node (`docs/figma/screen-matrix.md` mapping) and `npm run build` + `npm run lint` pass.
