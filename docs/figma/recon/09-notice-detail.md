## Frame
1440 × 2127; x=1760, y=2925.773681640625 (node `19:977`).

## Shell
IDENTICAL standard chrome: 64px blurred header with logo/nav/actions and inverse dark footer with brand, two link columns, copyright. Detail-specific chrome adds “← Back to list” and Public badge.

## Surface
`#fbfbfe` page; white body/related cards; lavender external-link callout `#eeefff`; cover uses 135deg `#dfddff` → `#f5f6fb`; footer `#0b1322`; header is `rgba(255,255,255,.85)` with 6px blur.

## Layout
1200px max width, 24px gutters (1152px), main padding 64px top/80px bottom and 32px gaps. Back/public row is 1152×24. Masthead is max 896px: category/date row, 20px gaps, H1 and summary. Cover is full 1152×648 (16:9), 20px radius. Content grid has four equal columns with 32px gaps: article spans 3 (856px) and aside is 264px. Article card is 856×524 with 21px inset; aside related card is 264×138.

## Typography
- Space Grotesk Bold: 20/30, 700 `#111a2e` logo; 18/28, 700, -0.18px, `#111a2e` callout heading.
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` H1.
- Inter Bold: 12/18, 700, +.96px uppercase, `#4d3dff` Related label.
- Inter Semi Bold: 14/20, 600, `#4d3dff` back link; 16/24, 600, `#4d3dff` external CTA; 16/24, 600, `#111a2e` related links; 12/18, 600 badge text (`#3d2ed9` category, `#0b7a5b` public).
- Inter Medium: 14/20, 500, `#4f5d77` nav.
- Inter Regular: 18/28, 400, `#77839c` deck; 16/24, 400, `#4f5d77` markdown body; 14/20, 400, `#77839c` date/footer; 14/20, 400, `#b7b2ce` footer links; 12/16, 400, `#566180` copyright.

## Colors
`#fbfbfe` page; `#ffffff` cards; `#0b1322` footer; `#111a2e` headings; `#4f5d77` markdown body/nav; `#77839c` deck/muted; `#4d3dff` primary/labels; `#3d2ed9` category; `#eeefff` category/callout; `#e4f8f1` Public; `#0b7a5b` Public text; `#e3e7f1` card/callout border; `#b7b2ce` footer links; `#566180` copyright; `rgba(255,255,255,.85)` header; 135deg `#dfddff`→`#f5f6fb` cover gradient.

## Radii/Borders/Shadows
20px cover and cards; 14px external-link callout; 10px actions; 999px badges; 8px mascot. 1px solid `#e3e7f1` card/callout borders. Cards use `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`.

## Components
- Badge: Injective ecosystem lavender/purple and Public mint/green, each 24px high with 10px/3px padding.
- SectionHeader/detail masthead: back link, category/date meta row, 48px title, 18px deck.
- NewsCard derivative: markdown article card with optional external-link callout.
- Related list: compact titled sidebar with “Browse active bounty tracks” and “View a public portfolio” links.

## Interactions
Back link returns to notices; header/footer nav links work. Category badge and related links are links; optional “Read more →” points to `externalUrl`. Body is markdown; no hover state is specified.

## Responsive inference
At 768: collapse nav; cover remains 16:9; article grid becomes single column with Related beneath; preserve 24px gutters. At 390: 16–20px gutters, masthead title/deck wrap, category/date wrap, cover full width, article/callout and sidebar stack, footer columns stack.

## Assets
- `Ninja Labs mascot`, `19:984`/`19:1045`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- `Injective MultiVM ecosystem campaign`, `19:1016`, 1152×648, `public/figma/injective-multivm-ecosystem-campaign.png`.

## Data shape
```ts
type Notice = {
  id: string; slug: string; title: string; excerpt: string; bodyMarkdown: string;
  category: 'Ninja Labs' | 'Injective ecosystem' | 'Events'; publishedAt: string;
  thumbnail: string; coverImage?: string; externalUrl?: string;
  related?: { label: string; href: string }[];
};
// { id:'iasset-modules', title:'New iAsset modules explained for bounty builders',
//   category:'Injective ecosystem', publishedAt:'2026-06-15',
//   coverImage:'injective-multivm-ecosystem-campaign.png', externalUrl:undefined }
```
