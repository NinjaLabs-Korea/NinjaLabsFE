## Frame
1440 × 1481.85; x=120, y=2925.773681640625 (node `19:851`).

## Shell
IDENTICAL standard chrome: blurred 64px header with logo/nav/actions; inverse `#0b1322` footer with brand, Platform and Community link columns, and copyright. Notices is the current destination.

## Surface
Page `#fbfbfe`, white news cards, `rgba(255,255,255,.85)`/6px-blur header, inverse footer. Each thumbnail uses 135deg `#dfddff` → `#f5f6fb` gradient.

## Layout
1200px max wrapper with 24px gutters (1152px), main padding 64px top/80px bottom, and 32px section gaps. Header copy area is 895px wide; status badge is 236.7px wide. Chip row is 24px high with 8px gaps. News list is four 1152×135.5 rows, 16px gaps; each has a 224×133.5 thumbnail and a 926px content region with 20px padding; date right-aligns. Footer padding 48px vertical.

## Typography
- Space Grotesk Bold: 20/30, 700, `#111a2e` logo; 20/28, 700, -0.2px, `#111a2e` NewsCard title.
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` H1.
- Inter Bold: 12/18, 700, +.96px uppercase, `#4d3dff` eyebrow.
- Inter Semi Bold: 14/21, 600 action labels; 12/18, 600 badge labels (`#eeefff` selected, `#3d2ed9` unselected, `#0b7a5b` community status).
- Inter Medium: 14/20, 500, `#4f5d77` nav.
- Inter Regular: 18/28, 400, `#77839c` introduction; 14/20, 400, `#77839c` summary/date/footer; 14/20, 400, `#b7b2ce` footer links; 12/16, 400, `#566180` copyright.

## Colors
`#fbfbfe` page; `#ffffff` cards; `#0b1322` footer; `#111a2e` headings; `#4f5d77` nav; `#77839c` muted; `#4d3dff` selected chip/eyebrow; `#3d2ed9` unselected chip; `#eeefff` lavender chip; `#e4f8f1` community badge; `#0b7a5b` its text; `#e3e7f1` card border; `#b7b2ce` footer links; `#566180` copyright; `rgba(255,255,255,.85)` header; 135deg `#dfddff`→`#f5f6fb` image gradient.

## Radii/Borders/Shadows
20px cards; 999px badges; 10px header action controls; 8px mascot. Cards use 1px solid `#e3e7f1` and `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`.

## Components
- Badge filter: All selected purple; Ninja Labs, Injective ecosystem, Events lavender/purple; all 24px high, 10px horizontal/3px vertical padding.
- NewsCard: linked 1152px horizontal card with 224px campaign thumbnail, category badge, title, summary, date; 16px list gap.
- SectionHeader: Notices / News eyebrow, two-line H1, intro, mint “Community feed, not just ops notices” badge.

## Interactions
Nav/footer and each NewsCard link; category chips filter All/Ninja Labs/Injective ecosystem/Events. Latest 2–3 posts are reused on Intro; posts are admin-managed. No hover treatment is specified.

## Responsive inference
At 768: nav collapses; intro/status stack; NewsCards retain thumbnail but use narrower media and wrap date below/right; chips wrap. At 390: one-column card layout, thumbnail becomes full-width 16:9, metadata/date stacks under copy; footer columns stack.

## Assets
- `Ninja Labs mascot`, `19:858`/`19:954`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- `Ninja API Forge developer campaign`, `19:895`, 224×133.5, `public/figma/ninja-api-forge-developer-campaign.png`.
- `Injective MultiVM ecosystem campaign`, `19:909`, 224×133.5, `public/figma/injective-multivm-ecosystem-campaign.png`.
- `Injective EVM community workshop`, `19:923`, 224×133.5, `public/figma/injective-evm-community-workshop.png`.
- `Ninja Bounty: Prove to Earn campaign`, `19:937`, 224×133.5, `public/figma/ninja-bounty-prove-to-earn-campaign.png`.

## Data shape
```ts
type Notice = {
  id: string; slug: string; title: string; excerpt: string; bodyMarkdown: string;
  category: 'Ninja Labs' | 'Injective ecosystem' | 'Events'; publishedAt: string;
  thumbnail: string; coverImage?: string; externalUrl?: string; related?: { label: string; href: string }[];
};
// { id:'iasset-modules', title:'New iAsset modules explained for bounty builders',
//   category:'Injective ecosystem', publishedAt:'2026-06-15', thumbnail:'injective-multivm-ecosystem-campaign.png' }
```
