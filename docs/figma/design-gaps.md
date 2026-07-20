# Design gaps — items not in Figma that the product needs

FigJam board (shared with the designer): https://www.figma.com/board/MsNLs9QEXjiN2KpJDPV9XL
Created 2026-07-19 via Figma MCP (`generate_diagram`, team "Alex kim's team" — the only Full seat available).

## Status legend
- **FE shipped (provisional)** — implemented with tokens, needs design blessing/refinement.
- **Blocked on design** — cannot ship meaningfully without designed states.
- **Blocked on assets** — waiting on real files.

## Auth — blocked on design (and backend)

| Item | Notes | Evidence |
|---|---|---|
| Logged-in header states | All mapped/reconciled screens inspected to date show only the logged-out header. Needs avatar/menu/sign-out. | `docs/figma/recon/01-landing.md` §Shell, `docs/figma/recon/05-user-profile.md` §Shell, `docs/figma/recon/14-bounty-list.md` §Shell; `src/components/layout/Header.tsx` |
| Admin access gating | `/admin/*` is publicly reachable; "ADMIN ONLY" badge is decorative. Needs login-wall/forbidden state design + auth backend. | `docs/figma/recon/18-admin-users.md` §Shell (badge only, no gate UI); `src/app/admin/users/page.tsx` (no guard) |

## Forms — blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Validation error visuals | Behavior contracts exist (duplicate nickname blocks Next with an inline error; OAuth failure permits retry; mint failure does not block signup) but the **visual variants** (error styling, banners, retry UI) are not drawn — only happy-path hints are. | `docs/figma/recon/12-signup-profile.md` §Interactions, `docs/figma/recon/10-signup-google.md` §Interactions, `docs/figma/recon/11-signup-wallet.md` §Interactions |
| Submit feedback | The apply lifecycle status flow IS drawn (`ApplyStatusFlow`, Open→…→Completed); what is missing everywhere is the **immediate** post-action feedback — acknowledgement/pending/error UI after pressing Apply, admin Save, or agent Sign & Register. | `docs/figma/recon/15v-bounty-detail-apply.md` §Components (ApplyStatusFlow drawn) + §Interactions (no acknowledgement UI), `docs/figma/recon/21-admin-notices.md` §Interactions (Save persists Draft/Publish — no feedback state drawn), `docs/figma/recon/17-agent-register.md` §Interactions (verification failure requires retry — no failure UI drawn) |
| Confirmation dialogs | Admin **Remove** clears member assignment with no confirm design; hover/validation/confirmation states are explicitly unspecified on that screen. | `docs/figma/recon/18-admin-users.md` §Interactions ("Hover, validation, confirmation, pagination, and error states are not specified") |

## Data UX — blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Pagination / load-more | Admin users/bounties recons explicitly say pagination is unspecified; the public bounty list and notices list draw fixed 9-card / 4-row sets with no paging affordance visible. | `docs/figma/recon/18-admin-users.md` §Interactions, `docs/figma/recon/19-admin-bounties.md` §Interactions (explicit); `docs/figma/recon/14-bounty-list.md` §Layout and `docs/figma/recon/08-notices-list.md` §Layout (fixed-size lists, no paging drawn) |
| Table sorting | Admin tables have no sort affordance drawn. | `docs/figma/recon/18-admin-users.md` §Components, `docs/figma/recon/19-admin-bounties.md` §Components; `src/components/admin/AdminTable.tsx` |
| Loading skeletons | Audit result: a full-text search across every file in `docs/figma/recon/` finds no loading/skeleton state; FE shipped provisional token-based skeletons. | audit: `docs/figma/recon/*` (no loading sections); implementations `src/app/bounties/[id]/loading.tsx`, `src/app/notices/[id]/loading.tsx`, `src/app/members/[id]/loading.tsx` |

## FE self-designed — shipped, needs design blessing

2026-07-20: captured into the design file as pages/frames `22 Not Found (FE)` (48-2), `23 Error (FE)` (49-2), `24 List Empty State (FE)` (50-2), `25 Loading Skeleton (FE)` (51-2) via Figma MCP html-to-design capture, so the designer can refine them in place.

| Item | Evidence (implementation) |
|---|---|
| Branded 404 / error pages | `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| Filter empty states + Reset | `src/components/bounties/BountyFilters.tsx`, `src/components/notices/NoticeFilters.tsx`, `src/components/members/MemberFilters.tsx` |
| Active nav highlight | `src/components/layout/NavLinks.tsx` |
| Mobile nav menu (no-JS disclosure) | `src/components/layout/Header.tsx` |
| "How applying works →" list button | `src/app/bounties/page.tsx` → `/bounties/apply` (user-requested; noted in `AGENTS.md`) |
| Skip-to-content link | `src/app/layout.tsx` |

## Assets — blocked on assets

Export-failure claims are scoped to recorded attempts: `figma-render-empty` rows in `src/lib/assets.ts`, or an explicitly cited provenance record (e.g. the in-file comment in `public/figma/ninja-labs-mascot.svg` for node `19:10`). Items without either are marked "not export-attempted".

| Item | Notes | Evidence |
|---|---|---|
| Brand mark / mascot (28px, node `19:10`) | Export attempt rendered empty; FE uses a documented gradient placeholder. The 44px signup raster `ninjalabs-mascot.jpg` (node `19:1107`) exists in the design and has **not** been export-attempted. | provenance comment in `public/figma/ninja-labs-mascot.svg`; `docs/figma/recon/10-signup-google.md` §Assets; `src/app/icon.svg` |
| Ninja NFT / profile avatar (48px, node `19:67`) | Export attempt rendered empty; FE renders the NFT gradient tile. | `src/lib/assets.ts` (`ninja-nft` row); `docs/figma/recon/01-landing.md` §Assets, `docs/figma/recon/05-user-profile.md` §Assets; gradient tile implementation in `src/app/page.tsx` (hero identity row) and `src/app/members/[id]/page.tsx` |
| 9 bounty covers + 4 notice thumbnails | 4 cover exports attempted and rendered empty (recorded); remaining covers/thumbnails share the same design-side placeholder fills. FE renders the design-native gradient. | `src/lib/assets.ts` (4 cover rows); `docs/figma/recon/14-bounty-list.md` §Surface (135deg gradient fills) + §Assets, `docs/figma/recon/08-notices-list.md` §Surface + §Assets; gradient fallbacks in `src/components/cards/BountyCard.tsx`, `src/components/cards/NoticeRow.tsx` |
| Member / HoF photos, partner wall | Not export-attempted (no rows in `src/lib/assets.ts`); design labels them as photo placeholders. FE renders gradient/initials fallbacks. | `docs/figma/recon/07-members.md` §Assets, `docs/figma/recon/06-hall-of-fame.md` §Assets; `src/components/cards/MemberCard.tsx`, `src/app/hall-of-fame/page.tsx` |
| OG / social share image | Root metadata ships openGraph text only; no such asset exists in the design file. | `src/app/layout.tsx` (openGraph comment); `docs/figma/screen-matrix.md` asset manifest (no share-image row) |
