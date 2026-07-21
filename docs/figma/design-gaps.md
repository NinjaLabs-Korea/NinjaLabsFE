# Design gaps — items not in Figma that the product needs

FigJam board (shared with the designer): https://www.figma.com/board/MsNLs9QEXjiN2KpJDPV9XL
Created 2026-07-19 via Figma MCP (`generate_diagram`, team "Alex kim's team" — the only Full seat available).

## Status legend
- **Approved implementation divergence** — approved through execution of the pending plan and review of live screenshots; it is not asserted to originate in Figma.
- **Blocked on design** — cannot ship meaningfully without designed states.
- **Blocked on assets** — waiting on real files.

## Auth — real auth blocked on backend

| Item | Notes | Evidence |
|---|---|---|
| Logged-in header states | **Approved implementation divergence** — `FoundationProvider` supplies an in-memory mock-session preview; the signed-in desktop menu and mobile account disclosure reflect that preview only. API mode remains unavailable, and real authentication remains backend scope. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); `src/components/auth/FoundationProvider.tsx`, `src/components/layout/AuthArea.tsx`, `src/components/layout/UserMenu.tsx` |
| Admin access gating | **Blocked on backend** — `/admin/*` is publicly reachable; "ADMIN ONLY" badge is decorative. Needs login-wall/forbidden state design + auth backend. | `docs/figma/recon/18-admin-users.md` §Shell (badge only, no gate UI); `src/app/admin/users/page.tsx` (no guard) |
| Frontend/mock foundation boundary | **Approved implementation divergence** — local/test mock mode uses deterministic fixtures and memory-only session state. Google signs into that preview only; its deterministic failure preview supports the approved retry state. RainbowKit is wallet connection only; owner/admin changes are session-local. API mode is deliberately unavailable and makes no backend request. Agent keys are masked fixture values and cannot be unmasked in the UI. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); `docs/auth-api-contract.md`; `src/components/auth/FoundationProvider.tsx`, `src/components/auth/GoogleLoginButton.tsx`, `src/components/wallet/WalletConnectButton.tsx`, `src/lib/foundation/api-client.ts`, `src/lib/foundation/auth-adapter.ts` |

## Forms — blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Validation error visuals | **Blocked on design/backend** — no form validation is implemented: the profile Next control is plain navigation and the drawn "real-time duplicate check" hint is static Figma copy only. The one shipped validation-adjacent state is the mock Google failure/retry preview (approved implementation divergence). Duplicate-nickname blocking and any mint/failure handling remain unimplemented design intent. | `docs/figma/recon/12-signup-profile.md` §Interactions (design intent), `src/app/signup/profile/page.tsx` (static hint, `Next` is a `Link`); shipped failure preview: `src/components/auth/GoogleLoginButton.tsx` (approved 2026-07-20 via pending-plan execution + live screenshots) |
| Submit feedback | **Partially FE shipped** — `ui/Toast` (4 variants, captured as `28 Toasts (FE)`); admin toasts live for Remove/Assign/Undo AND Create/Save on the bounty/highlight/post managers (session-local). Public Apply and agent Sign & Register feedback remain backend scope. The drawn `ApplyStatusFlow` lifecycle is unchanged. | `docs/figma/recon/15v-bounty-detail-apply.md` §Components (ApplyStatusFlow drawn) + §Interactions (no acknowledgement UI), `docs/figma/recon/21-admin-notices.md` §Interactions (Save persists Draft/Publish — no feedback state drawn), `docs/figma/recon/17-agent-register.md` §Interactions (verification failure requires retry — no failure UI drawn) |
| Confirmation dialogs | **Approved implementation divergence** — `ui/ConfirmDialog` + admin Remove wiring live (session-preview copy); captured as `26 Modal - Confirm (FE)`. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); `src/components/ui/ConfirmDialog.tsx`, `src/components/admin/UserActions.tsx` |

## Data UX — blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Pagination / load-more | Admin users/bounties recons explicitly say pagination is unspecified; the public bounty list and notices list draw fixed 9-card / 4-row sets with no paging affordance visible. | `docs/figma/recon/18-admin-users.md` §Interactions, `docs/figma/recon/19-admin-bounties.md` §Interactions (explicit); `docs/figma/recon/14-bounty-list.md` §Layout and `docs/figma/recon/08-notices-list.md` §Layout (fixed-size lists, no paging drawn) |
| Table sorting | Still design-blocked for general column sorting; the HoF table re-sorts by the display-order field (FE shipped, session-local — `sortHighlights` in `src/components/admin/HighlightManager.tsx`). | `docs/figma/recon/18-admin-users.md` §Components, `docs/figma/recon/19-admin-bounties.md` §Components; `src/components/admin/AdminTable.tsx` |
| Loading skeletons | **Approved implementation divergence** — audit result: a full-text search across every file in `docs/figma/recon/` finds no loading/skeleton state; token-based skeletons were approved through pending-plan execution and live-screenshot review. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); audit: `docs/figma/recon/*` (no loading sections); implementations `src/app/bounties/[id]/loading.tsx`, `src/app/notices/[id]/loading.tsx`, `src/app/members/[id]/loading.tsx` |

## FE implementation divergences — approved

2026-07-20 (run 6): all admin controls are now interactive with session-local demo state — `AdminSelect` combobox everywhere; users page ships live search + Assign/Remove modal flows (`UserDirectory`/`UserActions`); bounties, hall-of-fame, and notices ship Edit-prefill Create/Save forms with toasts (`BountyManager`/`HighlightManager`/`PostManager`). Real persistence remains backend scope.
2026-07-20 (revised 2026-07-21): Admin bounty form includes Deliverables and Review process fields — an approved implementation divergence because Figma 19 (`19:2527`) draws no such inputs while Figma 15 (`19:1739`) draws the Deliverable/Deadline/Review meta row that consumes these values; session-local only. A separate Deadline detail input was added and then removed as redundant: the single form `deadline` suffices because the public detail already falls back `deadlineDetail ?? deadline`, and a real backend would derive both labels from one canonical timestamp.

2026-07-20: captured into the design file as pages/frames `22 Not Found (FE)` (48-2), `23 Error (FE)` (49-2), `24 List Empty State (FE)` (50-2), `25 Loading Skeleton (FE)` (51-2), `26 Modal - Confirm (FE)` (57-2), `27 Modal - Assign Role (FE)` (55-2), `28 Toasts (FE)` (56-2), `29 Header - Signed In (FE)` (60-2) via Figma MCP html-to-design capture, so the designer can refine them in place.

2026-07-20 (run 8): owner-private account views shipped — `/applications` (apply lifecycle strip driven by the 15v statuses) and `/agents` (masked fixture API-key display), both supplied by the `FoundationProvider` session preview in mock mode; API mode is unavailable. Captured as frames `30 My Applications (FE)` (63-2) and `31 My Agents (FE)` (64-2). Note: the FE-capture frames all live on file page `0:1`; that page was renamed to `FE Captures (22-31)` during this run (previous page name was not recorded — designer may rename freely).
2026-07-20: Approval record — the user approved execution of the pending plan and reviewed live screenshots for these FE states. This records implementation approval only; it does not claim Figma origin. Tailwind utilities remain required for component styling. RainbowKit's single vendor import in `src/app/globals.css` is the approved exception.

| Item | Evidence (implementation) |
|---|---|
| Branded 404 / error pages | `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| Filter empty states + Reset | `src/components/bounties/BountyFilters.tsx`, `src/components/notices/NoticeFilters.tsx`, `src/components/members/MemberFilters.tsx` |
| Active nav highlight | `src/components/layout/NavLinks.tsx` |
| Mobile nav menu (no-JS disclosure) | `src/components/layout/Header.tsx` |
| "How applying works →" list button | `src/app/bounties/page.tsx` → `/bounties/apply` (user-requested; noted in `AGENTS.md`) |
| Skip-to-content link | `src/app/layout.tsx` |
| Markdown body rendering (bounty description, notice body) + bounty "Submission guide" section | `src/components/ui/Markdown.tsx` (token-mapped, raw HTML off); `src/app/bounties/[id]/page.tsx`, `src/app/notices/[id]/page.tsx`; contract fields in `src/lib/types.ts` — design draws plain paragraphs; the markdown subset (bold/list/link/h2-h3) is an approved implementation divergence, not a claimed Figma-origin state. |

## Assets — blocked on assets

Export-failure claims are scoped to recorded attempts: `figma-render-empty` rows in `src/lib/assets.ts`, or an explicitly cited historical provenance record. Items without either are marked "not export-attempted".

| Item | Notes | Evidence |
|---|---|---|
| Brand mark / mascot (28px, node `19:10`) | The node `19:10` Figma-export failure record remains historical. FE now uses a real 112×112 user-supplied mascot PNG, not a Figma export; it is also the `src/app/icon.png` favicon. The 44px signup raster `ninjalabs-mascot.jpg` (node `19:1107`) exists in the design and has **not** been export-attempted. | historical node `19:10` export-failure record; `docs/figma/recon/10-signup-google.md` §Assets; `public/figma/ninja-labs-mascot.png`; `src/app/icon.png` |
| Ninja NFT / profile avatar (48px, node `19:67`) | Export attempt rendered empty. The landing hero identity avatar (`ninja.inj` showcase) now uses the user-supplied mascot PNG (2026-07-21); the member profile avatar still renders the NFT gradient tile. | `src/lib/assets.ts` (`ninja-nft` row); `docs/figma/recon/01-landing.md` §Assets, `docs/figma/recon/05-user-profile.md` §Assets; `src/app/page.tsx` (hero identity avatar → `public/figma/ninja-labs-mascot.png`); gradient tile remains in `src/app/members/[id]/page.tsx` |
| 9 bounty covers + 4 notice thumbnails | 4 cover exports attempted and rendered empty (recorded); remaining covers/thumbnails share the same design-side placeholder fills. FE renders the design-native gradient. | `src/lib/assets.ts` (4 cover rows); `docs/figma/recon/14-bounty-list.md` §Surface (135deg gradient fills) + §Assets, `docs/figma/recon/08-notices-list.md` §Surface + §Assets; gradient fallbacks in `src/components/cards/BountyCard.tsx`, `src/components/cards/NoticeRow.tsx` |
| Member / HoF photos, partner wall | Not export-attempted (no rows in `src/lib/assets.ts`); design labels them as photo placeholders. FE renders gradient/initials fallbacks. | `docs/figma/recon/07-members.md` §Assets, `docs/figma/recon/06-hall-of-fame.md` §Assets; `src/components/cards/MemberCard.tsx`, `src/app/hall-of-fame/page.tsx` |
| OG / social share image | **FE shipped (code-generated)** — `src/app/opengraph-image.tsx` renders a 1200×630 brand card (hero gradient tokens + user-supplied mascot) via `ImageResponse`; root metadata adds `metadataBase`/openGraph/twitter and detail pages override og title/url. No designed share asset exists in the Figma file; the generated card is an approved implementation divergence. | `src/app/opengraph-image.tsx`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`; `docs/figma/screen-matrix.md` asset manifest (no share-image row) |
