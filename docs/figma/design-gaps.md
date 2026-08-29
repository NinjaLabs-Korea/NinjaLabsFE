# Design gaps — items not in Figma that the product needs

FigJam board (shared with the designer): https://www.figma.com/board/MsNLs9QEXjiN2KpJDPV9XL
Created 2026-07-19 via Figma MCP (`generate_diagram`, team "Alex kim's team" — the only Full seat available).

## Status legend
- **Approved implementation divergence** — approved through execution of the pending plan and review of live screenshots; it is not asserted to originate in Figma.
- **Blocked on design** — cannot ship meaningfully without designed states.
- **Blocked on assets** — waiting on real files.

## Auth and onboarding

| Item | Notes | Evidence |
|---|---|---|
| Logged-in header states | **Implemented** — `FoundationProvider` supplies the mock preview locally and restores the NinjaLabsBE JWT session in API mode. | `src/components/auth/FoundationProvider.tsx`, `src/lib/api/auth-adapter.ts`, `src/components/layout/AuthArea.tsx`, `src/components/layout/UserMenu.tsx` |
| Admin access gating | **Backend enforced** — every `/admin/*` data request and mutation is protected by NinjaLabsBE `AdminGuard`. A frontend login-wall/forbidden state remains a design/UX follow-up; route visibility is not the authorization boundary. | `docs/auth-api-contract.md`; `src/lib/api/admin.ts` |
| Frontend/mock foundation boundary | **Implemented with explicit modes** — local/test mock mode remains deterministic; API mode uses NinjaLabsBE for OAuth, onboarding, wallets, owner/public marketplace data, and AdminGuard-protected mutations. | `docs/auth-api-contract.md`; `src/lib/api/*`, `src/components/auth/FoundationProvider.tsx` |

## Forms — blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Validation error visuals | **Partially implemented** — the profile form enforces required fields/tags, reports save or nickname-conflict failure, and the wallet step reports connection/signature failure. Real-time nickname availability remains open. | `src/components/signup/ProfileForm.tsx`, `src/components/wallet/WalletConnectButton.tsx`; real-time check design intent in `docs/figma/recon/12-signup-profile.md` |
| Submit feedback | **Implemented** — public bounty Apply/Submit and admin mutations display success or failure feedback; agent registration reports signing/API failures. | `src/components/bounties/BountyActionPanel.tsx`, `src/components/admin/*Manager.tsx`, `src/components/agents/AgentRegistrationForm.tsx` |
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
| 9 bounty covers + 4 notice thumbnails | Historical Figma exports were empty. Production now renders admin-uploaded backend assets when present and retains the design-native gradient only as the empty-record fallback. | `src/components/admin/BountyManager.tsx`, `src/components/admin/PostManager.tsx`; `src/components/cards/BountyCard.tsx`, `src/components/cards/NoticeRow.tsx` |
| Member / HoF photos, partner wall | Not export-attempted (no rows in `src/lib/assets.ts`); design labels them as photo placeholders. FE renders gradient/initials fallbacks. | `docs/figma/recon/07-members.md` §Assets, `docs/figma/recon/06-hall-of-fame.md` §Assets; `src/components/cards/MemberCard.tsx`, `src/app/hall-of-fame/page.tsx` |
| OG / social share image | **FE shipped (code-generated)** — `src/app/opengraph-image.tsx` renders a 1200×630 brand card (hero gradient tokens + user-supplied mascot) via `ImageResponse`; root metadata adds `metadataBase`/openGraph/twitter and detail pages override og title/url. No designed share asset exists in the Figma file; the generated card is an approved implementation divergence. | `src/app/opengraph-image.tsx`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`; `docs/figma/screen-matrix.md` asset manifest (no share-image row) |
