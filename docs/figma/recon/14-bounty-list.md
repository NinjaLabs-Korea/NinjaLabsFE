## Frame
1440 × 2203.65; x=1760, y=5372.7734375 (node `19:1480`).

## Shell
IDENTICAL standard chrome: translucent 64px header with mascot/logo, nav (Bounties, Hall of Fame, Members, Notices), Browse, and Get Started; dark `#0b1322` footer with brand column, Platform and Community link columns, copyright. Bounties is the current nav destination.

## Surface
Page `#fbfbfe`; white cards; header `rgba(255,255,255,0.85)` with 6px backdrop blur. Footer is inverse `#0b1322`. Card/media gradient: 135deg `#dfddff` 0% → `#f5f6fb` 100%.

## Layout
1200px max container, 24px inner gutters (1152px content); header outer horizontal inset 119px. Main padding 64px top/80px bottom and 32px section gaps. Filter panel is 1152×96 with 21px horizontal and 29px top padding. Filter chips are 24px tall with 8px gaps; search is 320×46. Bounty grid: 3 equal 370.67px columns, 20px gaps, 3 rows; cards 415.87px tall with 368.67×207.37 media, then 20px body inset. Footer: 48px vertical padding, 32px internal gap.

## Typography
- Space Grotesk Bold: 20/30, 700, `#111a2e` logo; 18/28, 700, -0.18px, `#111a2e` card titles; 14/21, 700, `#111a2e` reward value.
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` H1.
- Inter Bold: 12/18, 700, +0.96px uppercase, `#4d3dff` eyebrow.
- Inter Semi Bold: 14/21, 600, `#4f5d77` Browse; 14/21, 600, white Get Started; 12/18, 600 chip text (`#eeefff` selected, `#3d2ed9` category, `#0b7a5b` active, `#b42323` closed).
- Inter Medium: 14/20, 500, `#4f5d77` nav.
- Inter Regular: 18/28, 400, `#77839c` intro; 14/20, 400, `#77839c` card body/footer; 12/16, 400, `#77839c` deadline/sponsor; 14/normal, 400, `#9ca3af` search placeholder.

## Colors
`#fbfbfe` page; `#ffffff` card/input; `#0b1322` footer; `#111a2e` headings; `#4f5d77` secondary body/nav; `#77839c` muted; `#9ca3af` placeholder; `#4d3dff` primary/selected; `#3d2ed9` purple chip; `#eeefff` lavender chip/reward surface; `#dfddff` reward border; `#e3e7f1` card/input border; `#e4f8f1` active/public surface; `#0b7a5b` active text; `#fdecec` closed surface; `#b42323` closed text; `rgba(255,255,255,0.85)` header; gradient 135deg `#dfddff` → `#f5f6fb` media.

## Radii/Borders/Shadows
10px buttons/inputs/reward pills; 20px cards/filter panel; 999px badges; 8px mascot. 1px solid `#e3e7f1` cards/inputs, `#dfddff` reward pill, transparent button border. Cards: `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; prototype frame: `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Badge: 24px high, 10px/3px padding; selected All `#4d3dff`/`#eeefff`; categories Dev/Design/Content `#eeefff`/`#3d2ed9`; Active `#e4f8f1`/`#0b7a5b`; Closed `#fdecec`/`#b42323`.
- RewardPill: `#eeefff`, 1px `#dfddff`, 10px radius, 13px×6px padding; 14px INJ icon for INJ or `$` glyph (`#4d3dff`) for USDC.
- BountyCard: linked white bordered/shadow card, gradient image, badge, title, summary, reward and `D-N · sponsor`; closed cards use opacity .70.
- SectionHeader: Marketplace eyebrow, H1, description, Public badge.

## Interactions
Nav/footer/card links; category and status chips filter the grid; search input placeholder “Search bounties”; hover state is not specified. Card click opens detail. Footer note says sponsors may pay INJ or USDC as-is, with no platform-side swap.

## Responsive inference
At 768: hide/collapse nav into menu; preserve 24px gutters; filters wrap and search becomes full row; grid becomes 2 columns. At 390: header actions reduce to menu/primary CTA; title wraps; filter chips wrap; search full width; grid one column, media remains 16:9; footer columns stack.

## Assets
- `Ninja Labs mascot`, nodes `19:1487`/`19:1716`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- `activity-injective-multivm-campaign.jpg` `19:1535`, 368.67×207.37, `public/figma/activity-injective-multivm-campaign.jpg`.
- `activity-ninja-break-chill-building.png` `19:1558`, 368.67×207.37, `public/figma/activity-ninja-break-chill-building.png`.
- `event-insight.png` `19:1575`, 368.67×207.37, `public/figma/event-insight.png`.
- `activity-ninja-api-forge.png` `19:1592`, 368.67×207.37, `public/figma/activity-ninja-api-forge.png`.
- `activity-eth-shanghai-afterparty.png` `19:1615`, 368.67×207.37, `public/figma/activity-eth-shanghai-afterparty.png`.
- `activity-ninja-break-content-festival.png` `19:1632`, 368.67×207.37, `public/figma/activity-ninja-break-content-festival.png`.
- `event-ibuildathon.png` `19:1655`, 368.67×207.37, `public/figma/event-ibuildathon.png`.
- `activity-ninja-bounty-prove-to-earn.png` `19:1672`, 368.67×207.37, `public/figma/activity-ninja-bounty-prove-to-earn.png`.
- `event-apac-tour.png` `19:1695`, 368.67×207.37, `public/figma/event-apac-tour.png`.
- `injective-token.svg` `19:1546` (reused `19:1603`, `19:1643`, `19:1683`), 14×14, `public/figma/injective-token.svg`.

## Data shape
```ts
type Bounty = {
  id: string; slug: string; title: string; summary: string;
  category: 'Dev' | 'Design' | 'Content'; status: 'active' | 'closed';
  reward: { amount: number; currency: 'INJ' | 'USDC' };
  sponsor: string; deadline: string; coverImage: string;
};
// { id:'iasset-price-widget', title:'Build an iAsset price widget', category:'Dev',
//   status:'active', reward:{amount:500,currency:'INJ'}, sponsor:'Injective', deadline:'D-7' }
```
