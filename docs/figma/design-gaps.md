# Design gaps - items not in Figma that the product needs

FigJam board (shared with the designer): https://www.figma.com/board/MsNLs9QEXjiN2KpJDPV9XL
Created 2026-07-19 via Figma MCP (`generate_diagram`, team "Alex kim's team" - the only Full seat available).

## Status legend
- **Approved implementation divergence** - approved through execution of the pending plan and review of live screenshots; it is not asserted to originate in Figma.
- **Blocked on design** - cannot ship meaningfully without designed states.
- **Blocked on assets** - waiting on real files.

## Auth and onboarding

| Item | Notes | Evidence |
|---|---|---|
| Logged-in header states | **Implemented** - `FoundationProvider` supplies the mock preview locally and restores the NinjaLabsBE JWT session in API mode. | `src/components/auth/FoundationProvider.tsx`, `src/lib/api/auth-adapter.ts`, `src/components/layout/AuthArea.tsx`, `src/components/layout/UserMenu.tsx` |
| Sign-in bot check (Cloudflare Turnstile) | **Approved implementation divergence, not in Figma** - when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set the `/signup` card shows Cloudflare's widget under "Continue with Google" (button disabled until verified) with localized verifying / expired / error + retry text. The widget itself is Cloudflare-rendered. Designer to confirm placement and copy. | `src/components/auth/TurnstileWidget.tsx`, `src/components/auth/GoogleLoginButton.tsx`, `docs/design.md` "Third-party widgets" |
| Admin access gating | **Backend enforced** - every `/admin/*` data request and mutation is protected by NinjaLabsBE `AdminGuard`. A frontend login-wall/forbidden state remains a design/UX follow-up; route visibility is not the authorization boundary. | `docs/auth-api-contract.md`; `src/lib/api/admin.ts` |
| Frontend/mock foundation boundary | **Implemented with explicit modes** - local/test mock mode remains deterministic; API mode uses NinjaLabsBE for OAuth, onboarding, wallets, owner/public marketplace data, and AdminGuard-protected mutations. | `docs/auth-api-contract.md`; `src/lib/api/*`, `src/components/auth/FoundationProvider.tsx` |

## Forms - blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Validation error visuals | **Partially implemented** - the profile form enforces required fields/tags, reports save or nickname-conflict failure, and the wallet step reports connection/signature failure. Real-time nickname availability remains open. | `src/components/signup/ProfileForm.tsx`, `src/components/wallet/WalletConnectButton.tsx`; real-time check design intent in `docs/figma/recon/12-signup-profile.md` |
| Submit feedback | **Implemented** - public bounty Apply/Submit and admin mutations display success or failure feedback; admin save buttons show a pending "Saving…" state and ignore a second submit; agent registration reports signing/API failures. | `src/components/bounties/BountyActionPanel.tsx`, `src/components/admin/*Manager.tsx`, `src/components/agents/AgentRegisterForm.tsx` |
| Agent-only participation state | **FE-designed (no Figma node)** - when only the owner's agent applied/submitted on a bounty, the detail panel shows an informational "Handled by your agent" card (link to My agents) instead of the direct apply/submit form; the owner's own row always takes precedence. | `src/components/bounties/BountyActionPanel.tsx` (`bounties.action.agentRow*`) |
| Manual network switch guidance | **FE-designed (no Figma node)** - without a configured RPC URL (mock mode) the wrong-network state disables the switch button and asks the user to switch the wallet manually instead of requesting a switch wagmi cannot complete. | `src/components/wallet/WalletConnectButton.tsx`, `src/components/agents/AgentRegisterForm.tsx` (`common.wallet.switchUnavailable`) |
| Account settings + delete account | **FE-designed (no Figma node)** - `/account` (UserMenu "Account settings") with a profile summary and a danger-zone "Delete account" behind a destructive `ConfirmDialog` that requires typing the nickname; success signs out and shows a shell flash toast on the home page. Built from existing recipes (account page masthead, soft danger action, ConfirmDialog, Toast); needs a designer pass and capture. | `src/app/[locale]/account/page.tsx`, `src/components/account/AccountSettingsView.tsx`, `src/components/layout/FlashToast.tsx`; `docs/design.md` "Danger zone" / "Flash toast" |
| Confirmation dialogs | **Approved implementation divergence** - `ui/ConfirmDialog` + admin Remove wiring live (session-preview copy); captured as `26 Modal - Confirm (FE)`. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); `src/components/ui/ConfirmDialog.tsx`, `src/components/admin/UserActions.tsx` |

## Data UX - blocked on design

| Item | Notes | Evidence |
|---|---|---|
| Pagination / load-more | Admin users/bounties recons explicitly say pagination is unspecified; the public bounty list and notices list draw fixed 9-card / 4-row sets with no paging affordance visible. | `docs/figma/recon/18-admin-users.md` §Interactions, `docs/figma/recon/19-admin-bounties.md` §Interactions (explicit); `docs/figma/recon/14-bounty-list.md` §Layout and `docs/figma/recon/08-notices-list.md` §Layout (fixed-size lists, no paging drawn) |
| Table sorting | Still design-blocked for general column sorting; the HoF table re-sorts by the display-order field (FE shipped, session-local - `sortHighlights` in `src/components/admin/HighlightManager.tsx`). | `docs/figma/recon/18-admin-users.md` §Components, `docs/figma/recon/19-admin-bounties.md` §Components; `src/components/admin/AdminTable.tsx` |
| Loading skeletons | **Approved implementation divergence** - audit result: a full-text search across every file in `docs/figma/recon/` finds no loading/skeleton state; token-based skeletons were approved through pending-plan execution and live-screenshot review. | User-approved execution of the pending plan and reviewed live screenshots (2026-07-20); audit: `docs/figma/recon/*` (no loading sections); implementations `src/app/[locale]/bounties/[id]/loading.tsx`, `src/app/[locale]/notices/[id]/loading.tsx`, `src/app/[locale]/members/[id]/loading.tsx` |

## FE implementation divergences - approved

2026-07-20 (run 6): all admin controls are now interactive with session-local demo state - `AdminSelect` combobox everywhere; users page ships live search + Assign/Remove modal flows (`UserDirectory`/`UserActions`); bounties, hall-of-fame, and notices ship Edit-prefill Create/Save forms with toasts (`BountyManager`/`HighlightManager`/`PostManager`). Real persistence remains backend scope.
2026-07-20 (revised 2026-07-21): Admin bounty form includes Deliverables and Review process fields - an approved implementation divergence because Figma 19 (`19:2527`) draws no such inputs while Figma 15 (`19:1739`) draws the Deliverable/Deadline/Review meta row that consumes these values; session-local only. A separate Deadline detail input was added and then removed as redundant: the single form `deadline` suffices because the public detail already falls back `deadlineDetail ?? deadline`, and a real backend would derive both labels from one canonical timestamp.

2026-07-20: captured into the design file as pages/frames `22 Not Found (FE)` (48-2), `23 Error (FE)` (49-2), `24 List Empty State (FE)` (50-2), `25 Loading Skeleton (FE)` (51-2), `26 Modal - Confirm (FE)` (57-2), `27 Modal - Assign Role (FE)` (55-2), `28 Toasts (FE)` (56-2), `29 Header - Signed In (FE)` (60-2) via Figma MCP html-to-design capture, so the designer can refine them in place.

2026-07-20 (run 8): owner-private account views shipped - `/applications` (apply lifecycle strip driven by the 15v statuses) and `/agents` (masked fixture API-key display), both supplied by the `FoundationProvider` session preview in mock mode; API mode is unavailable. Captured as frames `30 My Applications (FE)` (63-2) and `31 My Agents (FE)` (64-2). Note: the FE-capture frames all live on file page `0:1`; that page was renamed to `FE Captures (22-31)` during this run (previous page name was not recorded - designer may rename freely).
2026-07-20: Approval record - the user approved execution of the pending plan and reviewed live screenshots for these FE states. This records implementation approval only; it does not claim Figma origin. Tailwind utilities remain required for component styling. (The former RainbowKit vendor-stylesheet exception lapsed when RainbowKit was removed with the wagmi 3 upgrade, 2026-10-24.)

| Item | Evidence (implementation) |
|---|---|
| Admin operations console + NFT job console (2026-10-24) | No Figma node exists for bounty operations (deposits, application/submission review, payouts, lifecycle) or NFT job retry. FE-designed from the existing admin recipes (`docs/design.md` "Admin operations console"): `src/components/admin/{OperationsConsole,BountyOperations,Ops*Panel,OpsFormModal,OpsActorCell,NftJobsManager}.tsx`, routes `/admin/operations`, `/admin/nft-jobs`. Needs a design pass (capture as FE frames like 22-31). |
| Branded 404 / error pages | `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| Filter empty states + Reset | `src/components/bounties/BountyFilters.tsx`, `src/components/notices/NoticeFilters.tsx`, `src/components/members/MemberFilters.tsx` |
| Active nav highlight | `src/components/layout/NavLinks.tsx` |
| Mobile nav menu (no-JS disclosure) | `src/components/layout/Header.tsx` |
| "How applying works →" list button | `src/app/bounties/page.tsx` → `/bounties/apply` (user-requested; noted in `AGENTS.md`) |
| Skip-to-content link | `src/app/layout.tsx` |
| Annotation copy replaced with product copy | Figma 15v/16/12 annotation strings (`bounty.application_required ON`, `Intake ON/OFF`, `[Submit] button shown directly …`, `All fields required / no skip`) rendered verbatim to users; replaced with plain product copy in `src/app/[locale]/bounties/[id]/page.tsx`, `src/app/[locale]/bounties/apply/page.tsx`, `messages/*/signup.json`, `messages/*/bounties.json`. Layout and badge variants unchanged. |
| Sign-up status badges removed | Figma 10-13 draw a top-right danger badge per frame ("SIGN-UP FLOW (login in progress)", "NFT minted at sign-up", "All fields required / no skip", "SIGN-UP FLOW") that labels the frame for designers; it was ported verbatim as UI. Removed from all four `/signup*` routes and `messages/*/signup.json`, `messages/*/bounties.json` - `StepIndicator` already shows progress, and mock-mode preview copy stays in each card. |
| Get Started "Playground" card points to Injective docs | Figma 13 (`19:1385`) titles the second action "Try Injective in the Playground" and links `https://playground.injective.network`, which no longer resolves (DNS lookup fails, checked 2026-10-06). The card now reads "Explore the Injective docs" and links `https://docs.injective.network/developers-evm`; layout and icon are unchanged. Swap back if Injective restores a playground. |
| Hall of Fame partner wall is data-driven | Figma 06 (`19:553`) draws a static image frame labeled "Ninja Labs KR community partner wall"; it shipped as a gradient placeholder. Now a logo grid built from published Partnership highlights with an image (admin → Hall of Fame), hidden entirely when none exist. Final logo-tile styling awaits design review. |
| Markdown body rendering (bounty description, notice body) + bounty "Submission guide" section | `src/components/ui/Markdown.tsx` (token-mapped, raw HTML off); `src/app/bounties/[id]/page.tsx`, `src/app/notices/[id]/page.tsx`; contract fields in `src/lib/types.ts` - design draws plain paragraphs; the markdown subset (bold/list/link/h2-h3) is an approved implementation divergence, not a claimed Figma-origin state. |

## Assets - blocked on assets

Export-failure claims are scoped to recorded attempts: `figma-render-empty` rows in `src/lib/assets.ts`, or an explicitly cited historical provenance record. Items without either are marked "not export-attempted".

| Item | Notes | Evidence |
|---|---|---|
| Brand mark / mascot (28px, node `19:10`) | The node `19:10` Figma-export failure record remains historical. FE now uses a real 112×112 user-supplied mascot PNG, not a Figma export; it is also the `src/app/icon.png` favicon. The 44px signup raster `ninjalabs-mascot.jpg` (node `19:1107`) exists in the design and has **not** been export-attempted. | historical node `19:10` export-failure record; `docs/figma/recon/10-signup-google.md` §Assets; `public/figma/ninja-labs-mascot.png`; `src/app/icon.png` |
| Ninja NFT / profile avatar (48px, node `19:67`) | Export attempt rendered empty. The landing hero identity avatar (`ninja.inj` showcase) now uses the user-supplied mascot PNG (2026-07-21); the member profile avatar still renders the NFT gradient tile. | `src/lib/assets.ts` (`ninja-nft` row); `docs/figma/recon/01-landing.md` §Assets, `docs/figma/recon/05-user-profile.md` §Assets; `src/app/page.tsx` (hero identity avatar → `public/figma/ninja-labs-mascot.png`); gradient tile remains in `src/app/members/[id]/page.tsx` |
| 9 bounty covers + 4 notice thumbnails | Historical Figma exports were empty. Production now renders admin-uploaded backend assets when present and retains the design-native gradient only as the empty-record fallback. | `src/components/admin/BountyManager.tsx`, `src/components/admin/PostManager.tsx`; `src/components/cards/BountyCard.tsx`, `src/components/cards/NoticeRow.tsx` |
| Member / HoF photos, partner wall | Not export-attempted (no rows in `src/lib/assets.ts`); design labels them as photo placeholders. FE renders gradient/initials fallbacks. | `docs/figma/recon/07-members.md` §Assets, `docs/figma/recon/06-hall-of-fame.md` §Assets; `src/components/cards/MemberCard.tsx`, `src/app/hall-of-fame/page.tsx` |
| OG / social share image | **FE shipped (code-generated)** - `src/app/opengraph-image.tsx` renders a 1200×630 brand card (hero gradient tokens + user-supplied mascot) via `ImageResponse`; root metadata adds `metadataBase`/openGraph/twitter and detail pages override og title/url. No designed share asset exists in the Figma file; the generated card is an approved implementation divergence. | `src/app/opengraph-image.tsx`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`; `docs/figma/screen-matrix.md` asset manifest (no share-image row) |

2026-09-07: `/[locale]/auth/callback` adds a minimal sign-in progress / retry state using existing typography, spacing, and primary-button tokens. It has no dedicated Figma frame. Successful code exchange redirects to onboarding or home; failed/copy-pasted callbacks show a clean URL and a sign-in retry link.

## 2026-10-22 pixel audit against `assDqL6bnfovzvql7XlcH1` (node 31-3)

Branch `fix/figma-pixel-audit`. Every screen in the new design file was compared to the FE at 1440/1600px and the FE was brought back in line; the only intentional divergences are the ones already listed above plus:

| Item | Decision |
|---|---|
| Header language switcher (`layout/LocaleSwitcher`) | Not drawn in Figma; **kept** - a user requirement that post-dates the design. |
| Members role chips | Figma 07 draws Core/Dev/Design/Ops with Core highlighted while showing all four roles' cards; FE keeps an "All" chip so the filter is functional. |
| Bounty list chips | Figma 14 draws one row (All/Dev/Design/Content/Active/Closed) - FE now renders that single row, offering only categories present in the data, with "All" clearing both groups. |
| Bounty detail signed-out panel | Figma 15/15v draw the Submit/Apply form with a LOGIN REQUIRED badge and "Sign in first"/"View intake rules"; FE renders that as a disabled preview that links to `/signup`. Signed-in states keep the functional form. |
| Profile NFT tiles | Figma 05 shows title only; FE shows title and surfaces token/tx as a `title` tooltip, and only prints a status label when the NFT is not yet ATTACHED. |
| Admin "+ New Post" | Now lives in the masthead row next to ADMIN ONLY (21) via a slot in `admin/PostManager`, replacing the absolute-position hack. |
| Hall of Fame stats | Figma 06 has no "Platform aggregate" footnote; removed. Timeline renders dot-on-line + title + "date · description" (`hallOfFame.timeline.entry`). |
| Sign-up frame badges | Still omitted (see "Sign-up status badges removed" above); the step headers now carry the Figma eyebrow/title/subtitle and the Figma footnotes are rendered under the cards. |

### Contract-driven additions (2026-10-22, `fix/wiki-audit-findings`)

| Item | Decision |
|---|---|
| Agent key management on `/agents` (FE capture 31, frame `64:2`) | Capture 31 shows name/wallet/masked key/registered/completed only. The BE now issues expiring keys and allows rotation/revocation, so `account/AgentsView` adds a key-status Badge + expiry, a warning line when < 14 days remain or the key is EXPIRED, "Rotate key" (new key revealed once in the same success tile as the register form) and "Revoke agent" behind a destructive `ConfirmDialog`; revoked agents keep a danger badge and lose their actions. No Figma frame; styling reuses existing tokens (`docs/design.md` "Soft danger action", "One-time secret reveal"). |
| Bounty `reviewing` status (Figma 14 `19:1480` / 15 `19:1739`) | Figma draws only Active/Closed. BE `SUBMISSION_CLOSED`/`IN_REVIEW` were folded into "Closed", which hid the resubmit path for `revision_requested` work. FE adds a third public status `reviewing` with a warning Badge (card + detail, label mirrors the admin manager's "Reviewing"), keeps the card at full opacity, closes new applications/submissions in the action panel while still offering resubmission, and lets the list's "Closed" chip cover it (no third chip is drawn). |
| "via <agent>" on My applications (FE capture 30, frame `63:2`) and bounty detail | Capture 30 has owner-made rows only. Agent-made applications now appear with a neutral "via <agent name>" Badge, and when only the agent acted on a bounty the detail panel shows the informational "Handled by your agent" card (no direct form; the owner's own row always takes precedence). |
| Wallet chain-add / switch rejection | No Figma state. When the wallet does not know Injective EVM, the switch call now carries `addEthereumChainParameter` so the wallet prompts to add the chain; declining shows a distinct `text-danger` alert line ("You declined the network switch…") under the existing warning-soft Switch button (`WalletConnectButton`, `AgentRegisterForm`). |
| Hall of Fame "Rewards paid" stat (Figma 06 `19:553`) | Figma draws a single "$" figure. Rewards are paid in several tokens with no price source, so the BE `paidTotals` (per token, base units) renders as one string per locale, e.g. "12,500 USDC · 300 INJ" (`lib/hall-of-fame.ts formatPaidTotals`, at most 2 fraction digits). It appends after the three counters on `/hall-of-fame` (grid goes `sm:2 / lg:4` columns, value steps down to `text-2xl` and may wrap) and in the landing hero `<dl>`; the admin Hall of Fame stats preview uses the same grid/size switch; the stat is hidden when nothing has been paid, never a `$-` placeholder. |

### Responsive pass (2026-10-22)

Figma only draws 1440px frames. Every route was checked at 390px and 768px (no horizontal scroll on any page; admin tables scroll inside their own `overflow-x-auto` wrapper). Fixes applied: header hides the wordmark below `sm` so locale + Get Started + Menu fit at 390px and CJK labels never wrap; `ui/SectionHeader` and the bounty/profile mastheads wrap their action under the heading; the profile card stacks avatar over text below `sm`; the signed-out Submit/Apply panel keeps a readable text width. No mobile frames exist to match pixel-for-pixel, so these are implementation decisions.

### Accessibility and bundle follow-ups (2026-10-23, `fix/wiki-audit-findings`)

| Item | Decision |
|---|---|
| Bounty detail apply/submit forms (Figma 15 `19:1739` / 15v `19:1911`) | Figma draws placeholder-only inputs. The signed-in forms now carry visible labels above each control (design `Form fields` recipe), `aria-invalid`/`aria-describedby` wiring to the inline `role="alert"` error, focus moves to the status heading after success, and a persistent polite live region announces the success copy. The signed-out disabled preview keeps the Figma look (placeholder + `aria-label`). |
| `/applications`, `/agents` mastheads (FE captures 30/31) | The captures only show the signed-in state. The eyebrow/`h1`/intro (and "Register new agent") are now rendered by the page for every auth state; the signed-out "Sign in" panel sits under the heading instead of replacing it. |
| Bounty card countdown (Figma 14 `19:1480`) | Figma draws `D-7`. en/zh now read as a full phrase ("7 days left" / "剩余 7 天") from `bounties.card.daysLeft`; ko keeps the compact `D-7` and exposes the full phrase (`daysLeftLabel`) to assistive technology only. Card cover images are decorative (`alt=""`) because the title is already the link text. |
| Header mobile menu | No Figma interaction spec. The `<details>` menu now closes on link click, Escape (focus returns to "Menu") and outside click (`layout/MobileMenu`); markup and styling are unchanged. |
| Open Graph image | Text and `alt` were English-only; now localized through `common.site.og.*` (ko/zh share the brand line "Ninja Labs"). No Figma artefact. |


### Integration-test state fixes (2026-10-24, `fix/wiki-audit-findings`)

| Item | Decision |
|---|---|
| Profile portfolio intro (Figma 05-Empty) | Figma 05-Empty always says the Ninja NFT "is already minted". The FE now prints that copy only when the profile's NFT list holds a parent that is MINTED (or ATTACHING/ATTACHED); a PENDING/MINTING parent reads "is being minted", and no parent (or FAILED) reads "is not minted yet" (`members.profile.portfolio.bodyEmptyPending` / `bodyEmptyNotMinted`). Same typography and slot; the mock `sora` profile carries a MINTED parent so the demo still matches the frame. |
| Bounty detail masthead badges (Figma 15 `19:1739` / 15v `19:1911`) | Figma draws only the signed-out pair "Public view" / "Actions require login". Those badges were shown to signed-in users too. `bounties/BountyAccessBadges` now reads the auth snapshot: signed-in visitors see "Signed in" (success) / "Actions available" (primary-soft); server render, hydration and the loading state keep the Figma signed-out pair, so the HTML matches on hydration. No Figma frame for the signed-in variant; existing Badge variants only. |


### Forfeited awards and reviewer comments (2026-10-25, `r5/fe-forfeit-ux`)

| Item | Decision |
|---|---|
| Rejected / revision-requested state in the bounty action panel (Figma 15 `19:1739`) | Figma draws no rejected or forfeited state. The panel shows the latest reviewer comment (BE `review_comment`) as a muted `text-ink-muted` line under the body ("Reviewer comment: …"), also on a requested revision. A comment starting with `forfeited:` (admin `scripts/forfeit-award.js`) swaps the copy to a distinct "Award forfeited" heading + "Your work was approved, but the award was forfeited: <reason>. Contact the admins if this is a mistake." (danger tone, prefix stripped). Existing `StatusPanel`; no new tokens. |
| My applications: approved application whose submission was rejected (FE capture 30, frame `63:2`) | Capture 30 draws only the four-step stepper and the "Not selected" rejected note. An approved application whose submission is finally REJECTED is now a final `notAccepted` state (no longer "Submitted"): `danger` Badge "Submission not accepted", the stepper is replaced by a note (same slot/typography as the rejected note) plus the reviewer comment. A `forfeited:` comment shows the badge "Award forfeited" and a `text-danger` note with the reason. Existing Badge variants only. |

### Applicant states: revision requested and payout (2026-10-25, `r6/fe-applicant-states`)

| Item | Decision |
|---|---|
| My applications: approved application whose submission has a requested revision (FE capture 30, frame `63:2`) | Capture 30 draws only the four-step stepper. A requested revision keeps the stepper on "Submitted" and adds a `warning` Badge "Action needed" next to that step, swaps the status badge to `warning` "Revision requested", and shows a `text-warning` note, the reviewer comment (same `text-ink-muted` line as the rejected state) and a primary "Resubmit" link to the bounty page (same slot and button recipe as "Submit work"). Existing Badge variants and tokens only. |
| Reviewer comment layout (all states) | Comments are free text: every line that prints one (`StatusPanel` body/note, revision comment, forfeited body, My applications notes) uses `REVIEW_TEXT_CLASS` (`whitespace-pre-line break-words [overflow-wrap:anywhere]`, `lib/review-comment.ts`) so line breaks survive and a long URL wraps inside the card; the bounty detail grid column has `min-w-0` so the panel can shrink. No visual change for short comments. |
