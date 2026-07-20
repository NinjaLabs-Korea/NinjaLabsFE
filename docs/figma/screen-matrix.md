# Screen Matrix — Phase 0 artifact (G001)

Source: 13-node Figma reconnaissance (files in `docs/figma/recon/`), fileKey `DKvXU0AY4O9UalcHWXQCcI`.
Per-node detail lives in the recon files; this matrix is the frozen contract source for tokens, components, assets, and data registries.

## Matrix

| nodeId | Screen | Route | Native frame (sole pixel-diff ref) | Shell | Surface | Container | Repeated components | Interactions | Responsive inference (768 / 390) | Assets |
|---|---|---|---|---|---|---|---|---|---|---|
| 19:3 | 01 Landing | `/` | 1440×2156.70 | IDENTICAL | default + **inverse hero gradient** + inverse footer | 1200/24 | Badge, RewardPill, BountyCard×4, NewsCard×3, SectionHeader×2, primary/glass CTAs, stats, NFT mosaic | nav/CTA/card links | hero 2col→stack; cards 4→2→1; news 3→1 | mascot, injective-icon-white, injective-token, ninja-nft, 4 card imgs |
| 19:244 | 05 User Profile | `/members/[id]` (jaemin) | 1440×1921.50 | IDENTICAL | default + inverse portfolio panel | 1200/24 | ProfileHero, Badge, CompletionCard×3, AgentCard×2, NFT grid 4×2 | card links | portfolio stack; completions 3→2→1 | mascot, ninjalabs-mascot.jpg, ninja-nft |
| 19:422 | 05 Profile Empty | `/members/[id]` (sora) | 1440×2045.37 | IDENTICAL | same + explicit empty states | 1200/24 | ProfileHero variant, 3 empty panels w/ CTAs | CTA links | same | mascot, ninjalabs-mascot.jpg, ninja-nft |
| 19:553 | 06 Hall of Fame | `/hall-of-fame` | 1440×2445.77 | IDENTICAL | default + inverse stat panel | 1200/24 | stat tiles×3, NewsCard-like highlight×3 (Milestone/Featured/Partnership), timeline×3, SectionHeader | links | stats/articles 3→1; timeline stacks | mascot, 3 event photos, partner wall |
| 19:704 | 07 Members | `/members` | 1440×1447.54 | IDENTICAL | default | 1200/24 | MemberCard×4, role filter pills, rules tiles×4 | filter pills, links | grid 4→2→1; rules 4→2×2→1 | mascot, 3 member photos, image mark |
| 19:851 | 08 Notices List | `/notices` | 1440×1481.85 | IDENTICAL | default | 1200/24 | NoticeRow×4, filter Badge row, SectionHeader | filter chips, links | thumb narrows; 390 stacks 16:9 | mascot, 4 campaign thumbs |
| 19:977 | 09 Notice Detail | `/notices/[id]` | 1440×2127 | IDENTICAL | default + lavender callout | 1200/24 | Badge, masthead, markdown card, related aside | back/related/external links | article+aside→1col | mascot, cover 1152×648 |
| 19:1068 | 10 Sign Up Google | `/signup` | 1440×1270.40 | IDENTICAL | default | 1200/24; **step col 768** | StepIndicator(1 active), status Badge, Google CTA, info panels | CTA | single fluid col; steps wrap at 390 | mascot, ninjalabs-mascot.jpg 44×44 |
| 19:1159 | 11 Sign Up Wallet | `/signup/wallet` | 1440×1174.59 | IDENTICAL | default | 1200/24; **step col 1024** | StepIndicator(2), Badge, wallet card, aside defs | CTAs | 3+2 grid→1col | mascot |
| 19:1271 | 12 Sign Up Profile | `/signup/profile` | 1440×1358.90 | IDENTICAL | default | 1200/24; **step col 1024** | StepIndicator(3), Badge, form (input/chips/textarea), aside | validated form | grid→1col | mascot |
| 19:1385 | 13 Sign Up Done | `/signup/get-started` | 1440×1180.55 | IDENTICAL | default | 1200/24; **step col 896** | StepIndicator(4), Badge, option cards×3 | option/skip links | cards 3→2→1 | mascot, mascot-48 |
| 19:1480 | 14 Bounty List | `/bounties` | 1440×2203.65 | IDENTICAL | default | 1200/24 | BountyCard×9 (3col), filter Badge row (+Active/Closed), search input, SectionHeader | filters, search, links | grid 3→2→1; search full-row | mascot, injective-token, 9 card imgs |
| 19:1739 | 15 Bounty Detail | `/bounties/[id]` | 1440×1511.69 | IDENTICAL | default + lavender reward aside | 1200/24 | Badge variants, RewardPill, meta cells×3, CompletionFlow (page-local 3-step, NOT StepIndicator), submit panels | back link, gated submit | 2+1 grid→1col | mascot, injective-token |

## Decisions (frozen)

- **Chrome invariance: CONFIRMED 13/13.** Header (64px, `rgba(255,255,255,0.85)` + 6px blur, 1px bottom border) and footer (`#0B1322`, brand + Platform + Community columns + copyright rule) are byte-identical across nodes. Root layout owns `Header` + one flexing `<main>` + `Footer`. No route-group layout needed. (Clarification of the recon-template shorthand: the footer is brand column + 2 link columns; AGENTS.md itself mandates only one shared Header/Footer and is not contradicted.)
- **Fonts:** Space Grotesk (display: brand, H1/H2, card titles, stats, reward values) + Inter (body, nav, badges, forms). Both on Google Fonts → `next/font/google` with `variable`; **Geist is replaced**. Bridge: `@theme inline` → `--font-sans: var(--font-inter)`, `--font-display: var(--font-space-grotesk)`.
- **Pixel-diff reference:** native **1440** frame per node — the only pixel-comparison target. Canonical structural-assertion widths: **390** (mobile) and **768** (tablet). No per-breakpoint Figma frames exist.
- **Spacing:** default Tailwind scale suffices (4px multiples dominate). No custom `--spacing-*`. Odd one-offs (21px card padding = 20px + 1px border effect, 119px shell inset) use arbitrary values at the point of use.
- **Container:** content max-width 1200px with 24px gutters (`--container-content: 75rem`). Signup step columns 768/896/1024 are page-local widths, not tokens.
- **Dark surfaces are inverse *surfaces*, not a theme.** Hero/portfolio/stat gradients + footer use inverse tokens; the scaffold OS dark media query is removed.
- **Scaffold migration (Phase 1):** delete the scaffold `:root { --background/--foreground }` block, the `@media (prefers-color-scheme: dark)` query, the scaffold `@theme inline` bridge to Geist variables, AND the unlayered `body { font-family: Arial, ... }` rule — the Arial rule would override the Tailwind font bridge. Apply `bg-page text-ink font-sans antialiased` as utilities on `<body>` in `layout.tsx`; keep only `@import "tailwindcss"` plus the new `@theme` blocks in `globals.css`.

## Token draft (Phase 1 input → `src/app/globals.css`)

```css
@theme {
  /* palette */
  --color-page: #FBFBFE;            /* app background */
  --color-surface: #FFFFFF;         /* cards */
  --color-surface-subtle: #F5F6FB;  /* future steps, empty panels */
  --color-ink: #111A2E;             /* headings/primary text */
  --color-ink-secondary: #4F5D77;   /* nav, rich body */
  --color-ink-muted: #77839C;       /* metadata, excerpts */
  --color-ink-placeholder: #9CA3AF;
  --color-ink-notice: #263450;      /* NFT notice body text (11-signup-wallet) */
  --color-primary: #4D3DFF;         /* CTAs, eyebrows, active chips */
  --color-primary-strong: #3D2ED9;  /* outline actions, badge text */
  --color-primary-soft: #EEEFFF;    /* badge/pill/callout fill */
  --color-primary-soft-border: #DFDDFF;
  --color-primary-outline: #C3BEFF;
  --color-border: #E3E7F1;
  --color-border-dashed: #D1D7E6;
  --color-success-soft: #E4F8F1;  --color-success: #0B7A5B;
  --color-danger-soft: #FDECEC;   --color-danger: #B42323;
  --color-warning-soft: #FEF3E2;  --color-warning: #A66A00;
  /* inverse surface roles */
  --color-inverse-surface: #0B1322;        /* footer */
  --color-on-inverse: #FFFFFF;
  --color-on-inverse-secondary: #B7B2CE;   /* footer links */
  --color-on-inverse-muted: #566180;       /* copyright */
  /* hero/nft gradient stops */
  --color-hero-from: #0C1528; --color-hero-via: #1D2B60; --color-hero-to: #4D3DFF;
  --color-glow: #7B6CFF; --color-accent-soft: #9A90FF; --color-nft-deep: #2E22AB;
  /* type scale (paired leading) */
  --text-xs: 0.75rem;   --text-xs--line-height: 1.125rem;   /* 12/18 */
  --text-sm: 0.875rem;  --text-sm--line-height: 1.25rem;    /* 14/20 */
  --text-base: 1rem;    --text-base--line-height: 1.5rem;   /* 16/24 */
  --text-lg: 1.125rem;  --text-lg--line-height: 1.75rem;    /* 18/28 */
  --text-xl: 1.25rem;   --text-xl--line-height: 1.875rem;   /* 20/30 brand */
  --text-2xl: 1.5rem;   --text-2xl--line-height: 1.725rem;  /* 24/27.6 H2 */
  --text-4xl: 2.25rem;  --text-4xl--line-height: 2.5875rem; /* 36/41.4 */
  --text-5xl: 3rem;     --text-5xl--line-height: 3.45rem;   /* 48/55.2 H1 */
  --text-hero: 3.75rem; --text-hero--line-height: 3.9375rem;/* 60/63 */
  /* radius */
  --radius-card: 1.25rem;   /* 20 */
  --radius-panel: 1.75rem;  /* 28 */
  --radius-tile: 0.875rem;  /* 14 */
  --radius-control: 0.625rem; /* 10 */
  --radius-logo: 0.5rem;    /* 8 */
  /* shadows */
  --shadow-card: 0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05);
  --shadow-frame: 0 14px 36px rgba(33,24,125,.12);
  --shadow-nft: 0 10px 28px rgba(77,61,255,.28);
  --shadow-tile-text: 0 1px 4px rgba(0,0,0,.30); /* NFT tile-title legibility (01-landing) */
  /* container */
  --container-content: 75rem; /* 1200 */
}
@theme inline {
  --font-sans: var(--font-inter);
  --font-display: var(--font-space-grotesk);
}
```

## Asset manifest skeleton (`public/figma/` + `src/lib/assets.ts`)

| filename | source node | natural size | intent | crop |
|---|---|---|---|---|
| ninja-labs-mascot.svg | 19:10 | 28×28 | logo mark (header/footer) | none |
| ninja-labs-mascot-48.svg | 19:1444 | 48×48 | option card icon | none |
| ninjalabs-mascot.jpg | 19:292 | 44×44 | avatar/pill icon | none |
| injective-icon-white.svg | 19:32 | 13×13 | hero eyebrow icon | none |
| injective-token.svg | 19:117 | 14×14 | INJ reward icon | none |
| ninja-nft.png | 19:67 | 48×48 | parent NFT avatar | none |
| activity-injective-multivm-campaign.jpg | 19:1535 | 368.67×207.37 | bounty cover | fill 16:9 |
| activity-ninja-break-chill-building.png | 19:1558 | 368.67×207.37 | bounty cover | fill 16:9 |
| event-insight.png | 19:1575 | 368.67×207.37 | bounty cover | fill 16:9 |
| activity-ninja-api-forge.png | 19:1592 | 368.67×207.37 | bounty cover | fill 16:9 |
| activity-eth-shanghai-afterparty.png | 19:1615 | 368.67×207.37 | bounty cover | fill 16:9 |
| activity-ninja-break-content-festival.png | 19:1632 | 368.67×207.37 | bounty cover | fill 16:9 |
| event-ibuildathon.png | 19:1655 | 368.67×207.37 | bounty cover | fill 16:9 |
| activity-ninja-bounty-prove-to-earn.png | 19:1672 | 368.67×207.37 | bounty cover | fill 16:9 |
| event-apac-tour.png | 19:1695 | 368.67×207.37 | bounty cover | fill 16:9 |
| ninja-api-forge-developer-campaign.png | 19:895 | 224×133.5 | notice thumb | fill |
| injective-multivm-ecosystem-campaign.png | 19:909 / 19:1016 | 224×133.5 / 1152×648 | notice thumb + cover (dedupe: one asset, two renders) | fill |
| injective-evm-community-workshop.png | 19:923 | 224×133.5 | notice thumb | fill |
| ninja-bounty-prove-to-earn-campaign.png | 19:937 | 224×133.5 | notice thumb | fill |
| community-event-photo-{1,2,3} | 19:615/625/635 | 368.67×207.37 | HoF highlight | fill |
| ninja-labs-kr-community-partner-wall.jpg | 19:672 | 1152×504 | partner wall | fill |
| member-photo-{1,2,3} | 19:749/764/779 | 271×152.44 | member photo | fill |

Duplicate policy: content-hash dedupe; same-source multi-size renders share one file. Gradient-only art (hero, NFT tiles, image placeholders) is CSS, never exported. Alt intent: covers/thumbs descriptive; icons decorative (`alt=""`) unless sole link content.

## Content registry shapes (Phase 2/4 input → `src/lib/`)

```ts
// types.ts — discriminated unions
type Reward = { amount: number; currency: 'INJ' | 'USDC' };
type BountyCategory = 'Dev' | 'Design' | 'Content';
type Bounty = { slug: string; title: string; summary: string; category: BountyCategory;
  status: 'active' | 'closed'; reward: Reward; sponsor: string; deadline: string;
  coverImage: string; descriptionMarkdown?: string; deliverables?: string[];
  reviewProcess?: string; submissionMode?: 'direct' | 'agent'; completionSteps?: string[] };
type Notice = { slug: string; title: string; excerpt: string; bodyMarkdown: string;
  category: 'Ninja Labs' | 'Injective ecosystem' | 'Events'; publishedAt: string;
  thumbnail: string; coverImage?: string; externalUrl?: string;
  related?: { label: string; href: string }[] };
type Member = { slug: string; name: string; initials: string; role: 'Core'|'Dev'|'Design'|'Ops';
  title: string; bio: string; photo?: string; isMember: boolean;
  links: Partial<Record<'profile'|'posts'|'agents'|'bounties'|'notices', string>> };
// Directory visibility rule (07 recon): /members lists only records with isMember === true;
// unassignment (isMember → false) hides the card but the /members/[id] profile stays live.
type Completion = { title: string; category: BountyCategory; completedAt: string;
  reward: Reward; childNft?: { tokenId: string } };
type Agent = { name: string; wallet: string; verified: boolean; completedBounties: number };
type Profile = { slug: string; handle: string; initials: string; bio: string; skills: BountyCategory[];
  joinedAt: string; completions: Completion[]; childNfts: { title: string }[]; agents: Agent[] };
// profile state is derived: completions.length === 0 → empty variant (documented empty id: 'sora')
```

Registries: `bounties.ts`, `notices.ts`, `members.ts` (members + profiles keyed by shared slug; `/members/[id]` populated=`jaemin`, empty=`sora`), `hall-of-fame.ts`, `landing.ts`, `signup.ts`. List+detail derive from the same records. `generateStaticParams` enumerates registry slugs; unknown → `notFound()`.

## Component contracts (Phase 2 input)

- `ui/Badge` — variants: `primary-soft` (lavender/purple, default), `selected` (solid primary), `success`, `danger`, `warning`, `neutral`, `inverse` (hero glass). Size fixed 24px, pill.
- `ui/RewardPill` — `Reward` display model; INJ → token icon, USDC → `$` glyph; lavender fill + border.
- `ui/SectionHeader` — eyebrow + heading (level/size prop) + optional action link (`View all →` outline style).
- `ui/StepIndicator` — 4 steps, states: completed (`#DFDDFF`/strong), active (solid primary/white), future (subtle/muted); fluid track widths.
- `cards/BountyCard` — vertical (Landing 273w, List 370.67w — same skeleton, fluid) with cover, Badge, title, optional summary, RewardPill + deadline·sponsor row; closed → opacity-70.
- `cards/NewsCard` — vertical (Landing) and horizontal-with-thumb (Notices list) are **different skeletons** → `NewsCard` (vertical) + `NoticeRow` (horizontal), both consuming `Notice`.
- `cards/MemberCard` — confirmed by 07 recon (photo/initials fallback, name, role line, bio, links).
- Page-local until reuse proven: stat tiles, timeline, NFT mosaic, ProfileHero, CompletionCard, AgentCard, empty-state panels, form controls.

## Admin extension (run 2 — screens 18-21, recon files 18-21-admin-*.md)

| nodeId | Screen | Route | Native frame | Shell | Repeated components | Data shape |
|---|---|---|---|---|---|---|
| 19:2341 | 18 Admin - Users | `/admin/users` | 1440 (main 1200/24) | PUBLIC chrome + in-page AdminTabs + ADMIN ONLY badge | AdminTabs, AdminTable (7 cols, min-w 820, lavender header), search input, role-assignment panel (chip radio + order input + Confirm), Assign/Remove outline actions | `AdminUser` (nickname, email, joinedAt, wallet, is_member, member_role, member_display_order) |
| 19:2527 | 19 Admin - Bounties | `/admin/bounties` | 1440 | same | AdminTabs, AdminTable (7 cols, min-w 900), RewardPill, status Badge (Active success / Reviewing warning / Closed danger), + New Bounty primary, inline create form (2-col, token/intake selects, tag chips, 2 textareas) | `AdminBounty` (adds intakeEnabled, status incl 'reviewing', tags, submissionGuide) |
| 19:2754 | 20 Admin - HoF | `/admin/hall-of-fame` | 1440×1941.56 | same | AdminTabs, stat cards ×3 (lavender, read-only, auto-aggregated badge), AdminTable (5 cols, min-w 760), + Add item, curation form (Type select, upload, URL, order) | `platform_highlight` (type Milestone/Featured/Partnership, title, order, link?, image?) |
| 19:2937 | 21 Admin - Notices | `/admin/notices` | 1440×1857.60 | same | AdminTabs, AdminTable (5 cols, min-w 820, Published date or `–`), status Badge (Published success / Draft warning), + New Post, editor (Title/Category, Thumbnail/External link, markdown textarea 144px, Status select, Save) | `AdminPost` (category, status draft/published, publishedAt?, thumbnail?, externalUrl?, bodyMarkdown) |

### Admin decisions (frozen)
- **Chrome: PUBLIC shell retained on all 4** (64px header + dark footer). Admin nav is an in-page 66px white rounded tab strip (User Mgmt / Bounty Mgmt / Hall of Fame / Notices; active = Badge selected style) + `ADMIN ONLY` neutral badge. NO nested layout needed — pages compose the tab strip; root layout untouched.
- **Zero new tokens.** Every color/radius/shadow maps to existing @theme tokens (recon-verified; white-alpha/shadow rgba are existing utilities).
- **New shared admin components** (promote to `src/components/admin/`, used by all 4): `AdminTabs` (the 66px tab strip ONLY — the `ADMIN ONLY` badge is page-header content rendered by each page next to its title/actions, NOT part of AdminTabs), `AdminTable` (lavender `bg-primary-soft` 52px header, `text-ink-notice` headings, fixed col widths, 1px row dividers, wrapper `overflow-x-auto` with per-screen min-width), admin form field primitives stay page-local until reuse proven across the 4 pages (rule-of-three applies within run 2).
- **Tables never drop columns responsively** — horizontal scroll at min-width per recon (820/900/760/820).
- **Status Badge reuse:** Active/Published → `success`, Reviewing/Draft → `warning`, Closed → `danger`, ADMIN ONLY/auto-aggregated → `neutral`, tabs → `selected` (active) / `primary-soft` (inactive). **Badge fix required in G002:** recon evidence (screens 12, 14, 18–21 uniformly) shows selected chips as `#4D3DFF` fill with `#EEEFFF` text; `Badge.selected` currently renders `text-on-inverse` (#FFF). Change `selected` to `text-primary-soft` — leader-approved shared-API correction, aligns all existing selected-chip usages (signup tags, bounty All chip) with the design.
- **Mock scope + derivation (explicit adapters, no direct reuse):** forms/selects/toggles are static visual states (no mutations). Admin data lives in `src/lib/admin.ts` as keyed adapters/overlays over public registries — never direct casts: `AdminUser` = join of profile slugs with admin-only fields (email, wallet, precise joinedAt MM.DD, is_member from members registry, member_role/display_order); `AdminBounty` = bounty-slug overlay adding `intakeEnabled`, MM.DD deadline dates, and status widened with `reviewing` (public registry stays `active|closed`); admin highlights mirror hall-of-fame records plus `order`/`link` fields; `AdminPost` = published posts derived from notices (slug-keyed, publishedAt) **plus admin-only draft records that exist ONLY in the admin registry** (drafts are private; public notices registry is untouched).
- Out of run-2 scope (exist in Figma, not requested): 15 Apply Variant `19:1911`, 16 Bounty Apply `19:2093`, 17 Agent Register `19:2201`.

## Run-3 extension (screens 15v/16/17, recon files 15v-/16-/17-*.md)

| nodeId | Screen | Route | Shell | Key patterns | Data |
|---|---|---|---|---|---|
| 19:1911 | 15v Bounty Detail - Apply Variant | `/bounties/[id]` (state-driven) | PUBLIC | ApplyPanel (LOGIN REQUIRED pill, work-link/availability/note fields, Apply CTA, intake-rules link, disabled Submit), ApplyStatusFlow (Open→Under review→Approved→Submitted→Completed), AfterApproval aside, reward-flow list, warning Badge `Application intake ON` | additive `Bounty.applicationRequired?: boolean` (true → apply variant; drives contract-security-audit which matches the 800 USDC audit design) |
| 19:2093 | 16 Bounty Apply (explainer) | `/bounties/apply` | PUBLIC | BountyTypeComparison (Submit-type success/Intake OFF vs Apply-type warning/Intake ON cards w/ lavender behavior callouts), StatusFlow w/ connectors | `BountyWorkflow` (explanatory only) |
| 19:2201 | 17 Agent Register | `/agents/register` | PUBLIC | AgentRegistrationSteps ×4 (numbered cards), VerificationLogic checked list, AgentRegistrationForm (name + wallet key + Sign & Register), 2 policy notices, Login required badge | `AgentRegistration` (static mock form) |

### Run-3 decisions (frozen)
- **15v is a state variant of the shipped `/bounties/[id]`**, not a new route: `applicationRequired === true` swaps the direct-submit panel for ApplyPanel + status flow, switches the aside panels, AND removes the Deliverable/Deadline/Review meta row (recon diff list, 6 changes); everything else identical. Public registry gets ONE additive optional field.
- **Entry wiring:** 15v ApplyPanel "View intake rules" → `/bounties/apply`; 16 "View detail example" → `/bounties/iasset-price-widget` (submit-type example); 16 "Apply after login" → `/bounties/contract-security-audit` (apply-type example); 15v/15 agent panel "Register agent" retargets `/signup` → `/agents/register`; 17 lives at `/agents/register` as an explicit product override of the design-implied owned-agents subroute (no auth in mock scope); its success note is static copy referencing the demo profile agents area (`/members/jaemin`) without ownership semantics.
- **User-requested (no Figma evidence, documented addition):** `/bounties` masthead gains an outline action "How applying works →" linking to `/bounties/apply`.
- **`/admin` redirect** → `/admin/users` via `src/app/admin/page.tsx` `redirect()` (fixes observed 404).
- Zero new tokens (recon-verified; rgba literals are existing utilities). Patterns stay page-local (single-use); promote only if a later screen reuses them.
