## Frame
`01 Landing` (node `19:3`) is 1440 × 2156.70 at x=120, y=160. The rendered page frame inside the labeled Figma wrapper is 1440 × 2096.70; header 65px, main 1756.70px, footer 273px.

## Shell
Header is IDENTICAL to standard chrome: 64px white/translucent header with mascot + Ninja Labs logo, centered nav (Bounties, Hall of Fame, Members, Notices), and Browse/Get Started actions. It has a 1px bottom border. Footer differs from the stated standard 3-column footer: this page has branding plus **two** link columns only—Platform (Bounties, Hall of Fame, Notices) and Community (X / Twitter, Discord)—then a copyright/behavior notice: `© 2026 Ninja Labs · All content viewable without login · Returning users skip Intro and land on main.`

## Surface
Default page surface is `#FBFBFE`, with white cards (`#FFFFFF`) and a translucent header `rgba(255,255,255,0.85)` plus 6px backdrop blur. The hero is the inverse/dark surface: a 870px linear gradient at 160deg from `#0C1528` (0%) through `#1D2B60` (55%) to `#4D3DFF` (100%), overlaid by violet radial glows (`rgba(123,108,255,0.30)` to transparent). The hero NFT panel is glass: `rgba(255,255,255,0.06)`, 4px blur, white-alpha border. Footer is solid `#0B1322`.

## Layout
Desktop uses a 1200px max-width container, centered inside 1440px with 119px outer margins and 24px inner gutters (1152px usable content). Header is 64px. Hero is 870px with 112px vertical padding; its two equal 552px columns have a 48px gap. Hero visual is 552×478 with 21px inset padding; bounty-NFT mosaic is 3 columns × 2 rows of 162px squares, 12px gaps. Active-bounties section has 64px top/64px bottom padding, 28px heading-to-grid gap, and four 273px cards with 20px gaps. News has 28px heading-to-grid gap, 80px bottom padding, and three 370.67px cards with 20px gaps. Footer has 48px top/bottom padding; copyright divider begins 184px into footer.

## Typography
- **Figma screen label:** Space Grotesk Bold, 16px/24px, 700, normal tracking, `#EEEFFF` (the 48px-high `01 Landing` wrapper above the page).
- **Brand:** Space Grotesk Bold, 20px/30px, 700, normal tracking; header `#111A2E`, footer `#FFFFFF`.
- **Hero H1:** Space Grotesk Regular, 60px/63px, 400, -0.6px tracking; `#FFFFFF` for “Complete bounties. Collect proof.” and linear text gradient `#7B6CFF` (0%) → `#9A90FF` (55%) → `#C3BEFF` (100%) for “Own your track record.”
- **Hero body:** Inter Regular, 18px/28px, 400, normal tracking, `rgba(255,255,255,0.75)`.
- **Hero eyebrow / badge:** Inter Semi Bold, 12px/18px, 600, normal tracking, `#C3BEFF` on translucent white overlay.
- **Hero CTA:** Inter Semi Bold, 16px/24px, 600, normal tracking; primary `#FFFFFF`, secondary `#EEEFFF`.
- **Hero statistic value:** Space Grotesk Bold, 24px/32px, 700, normal tracking, `#FFFFFF`; label Inter Regular, 14px/20px, 400, `rgba(255,255,255,0.50)`.
- **Hero NFT identity:** Inter Semi Bold, 16px/24px, 600, `#FFFFFF`; member caption and `+ next`: Inter Regular, 14px/20px, 400, `rgba(255,255,255,0.50)`. NFT tile title: Inter Semi Bold, 12px/18px, 600, `#FFFFFF`, with `0 1px 4px rgba(0,0,0,0.30)` shadow. Portfolio caption: Inter Regular, 14px/20px, 400, `rgba(255,255,255,0.75)`.
- **Section eyebrow:** Inter Bold, 12px/18px, 700, +0.96px tracking, uppercase, `#4D3DFF`.
- **Section H2:** Space Grotesk Regular, 24px/27.6px, 400, -0.24px tracking, `#111A2E`.
- **Header nav / Browse / outline action:** Inter Medium (nav) or Semi Bold (actions), 14px/20px nav and 14px/21px action, 500/600, normal tracking, `#4F5D77`; filled header action is `#FFFFFF`.
- **Outline “View all →”:** Inter Semi Bold, 14px/21px, 600, normal tracking, `#3D2ED9`.
- **Bounty category badge:** Inter Semi Bold, 12px/18px, 600, normal tracking, `#3D2ED9`.
- **Bounty title:** Space Grotesk Bold, 15.9px/24px, 700, -0.16px tracking, `#111A2E`.
- **Reward amount:** Space Grotesk Bold, 14px/21px, 700, normal tracking, `#111A2E`; USDC `$` is Space Grotesk Bold, 12px/18px, 700, `#4D3DFF`. Deadline/sponsor: Inter Regular, 12px/16px, 400, `#77839C`.
- **News title:** Space Grotesk Bold, 17.9px or 18px/28px, 700, -0.18px tracking, `#111A2E`; excerpt: Inter Regular, 14px/20px, 400, `#77839C`; source badge: Inter Semi Bold, 12px/18px, 600, `#3D2ED9`; date: Inter Regular, 12px/16px, 400, `#77839C`.
- **Footer:** heading Inter Semi Bold, 14px/20px, 600, `rgba(255,255,255,0.90)`; links Inter Regular, 14px/20px, 400, `#B7B2CE`; brand statement Inter Regular, 14px/20px, 400, `#77839C`; copyright Inter Regular, 12px/16px, 400, `#566180`.

## Colors
- `#FBFBFE`: page/background frame; `#FFFFFF`: cards, header/button surfaces and primary CTA text.
- `#0B1322`: footer and Figma label background; `#0C1528`, `#1D2B60`, `#4D3DFF`: hero 160deg background stops (0/55/100%).
- `#4D3DFF`: primary buttons, section eyebrows, USDC symbol, secondary NFT-gradient start; `#3D2ED9`: outline action/category text; `#7B6CFF`, `#9A90FF`, `#C3BEFF`: hero H1 text gradient (0/55/100%) and `#C3BEFF` is outline-button border/hero badge text.
- `#111A2E`: default headings, brand and reward amount; `#4F5D77`: header navigation/Browse; `#77839C`: metadata, excerpts and footer description; `#B7B2CE`: footer links; `#566180`: footer copyright; `#EEEFFF`: badge/reward-pill fill and secondary CTA text.
- `#E3E7F1`: card/header borders; `#DFDDFF`: reward-pill border; `#F5F6FB` and `#DFDDFF`: bounty-image placeholder gradient (135deg, 0/100%).
- Hero overlays: `rgba(255,255,255,0.12)` Built-on badge; `rgba(255,255,255,0.08)` secondary CTA fill; `rgba(255,255,255,0.20)` secondary CTA border; `rgba(255,255,255,0.06)` NFT-panel fill; `rgba(255,255,255,0.12)` NFT-panel border; `rgba(255,255,255,0.25)` dashed next-card border; `rgba(255,255,255,0.75/.50)` inverse secondary/muted text.
- Hero radial glow: `rgba(123,108,255,0.30)` → transparent; NFT-tile highlight: `rgba(255,255,255,0.35)` → transparent. First-row tile gradient is 135deg `#2E22AB` → `#4D3DFF` (55%) → `#9A90FF`; second-row tile gradient is `#4D3DFF` → `#7B6CFF`.

## Radii/Borders/Shadows
Radii: 8px mascot; 10px header/hero CTA and outline action; 14px NFT tiles; 20px standard cards and glass NFT panel; 999px badges. Borders: 1px `#E3E7F1` cards/header, 1px `#C3BEFF` outline actions, 1px `#DFDDFF` reward pills, hero alpha borders as listed in Colors, 1px dashed `rgba(255,255,255,0.25)` next tile, and footer copyright top border `rgba(255,255,255,0.08)`. Page frame has 1px `#E3E7F1`, 10px radius, `0 14px 18px rgba(33,24,125,0.12)` shadow. White cards: `0 1px 2px rgba(17,26,46,0.06), 0 1px 3px rgba(17,26,46,0.05)`. Hero NFT tiles: `0 10px 28px rgba(77,61,255,0.28)`; glass panel also carries the white-card shadow.

## Components
- **Badge:** hero “Built on Injective” inverse pill (13px white Injective icon, violet text); bounty categories Dev, Design, Content; news sources Ninja Labs, Injective ecosystem, Events. Default light variant is `#EEEFFF` fill / `#3D2ED9` text, 10×3px padding.
- **RewardPill:** 10px radius, `#EEEFFF`/`#DFDDFF`, 13×6px padding, 6px icon gap; INJ icon + `500 INJ` and `250 INJ`, or violet `$` + `300 USDC`/`800 USDC`.
- **BountyCard:** four linked cards, 273×328.94, image 271×152.44, category/title/reward/deadline-sponsor. Values: Build an iAsset price widget/500 INJ/D-7 Injective; Design a wallet onboarding flow/300 USDC/D-5 Helix; Smart contract security audit/800 USDC/D-12 Ninja Labs; Write an Injective dev tutorial/250 INJ/D-9 Injective.
- **NewsCard:** three linked 370.67×182 cards with source badge/date/title/excerpt.
- **SectionHeader:** eyebrow + H2 + outline `View all →`; used for Marketplace/Active bounties and From the community/Recent news.
- **Other repeats:** primary purple CTA (header 45px; hero 54px) and glass secondary hero CTA; 3-up statistics; NFT portfolio grid (five completed tiles plus dashed “+ next”). No MemberCard or StepIndicator is present.

## Interactions
Header nav routes to Bounties, Hall of Fame, Members, and Notices; logo is a link. Browse and Get Started are actions. Hero Get Started and Browse Bounties are CTA links. Both `View all →` buttons link to their respective listing. Each BountyCard and NewsCard is a linked/cursor-pointer card. Figma exposes no hover-state variants, inputs, tabs, or filters; implement standard focus-visible and hover affordances rather than inventing a visual state.

## Responsive inference
At 768px, retain 24px gutters, collapse hero from two equal columns to a stacked text-then-visual layout (the 552px columns cannot coexist), and change bounty cards 4→2 columns and news 3→1 or 2 columns depending on available card minimum; header nav should collapse behind a menu while retaining logo and one primary action. At 390px, use 16px gutters; hide/collapse desktop nav and Browse, stack hero CTAs full-width or vertically, stats may wrap (2+1 or vertical), NFT grid remains 3 columns with fluid square tiles, and both BountyCard/NewsCard lists are single column. Footer branding and link columns stack; copyright wraps.

## Assets
- `Ninja Labs mascot`, nodes `19:10` and `19:221`, 28×28 display/natural frame; suggested `public/figma/ninja-labs-mascot.svg` (asset payload not emitted).
- `injective-icon-white.svg`, node `19:32`, 13×13; suggested `public/figma/injective-icon-white.svg`.
- `Ninja NFT`, node `19:67`, 48×48 display/natural frame; suggested `public/figma/ninja-nft.png` (asset payload not emitted).
- `injective-token.svg`, nodes `19:117` and `19:168`, 14×14; suggested `public/figma/injective-token.svg`.
- `activity-injective-multivm-campaign.jpg`, node `19:108`, 271×152.44 rendered source frame; suggested `public/figma/activity-injective-multivm-campaign.jpg`.
- `activity-ninja-break-chill-building.png`, node `19:129`, 271×152.44 rendered source frame; suggested `public/figma/activity-ninja-break-chill-building.png`.
- `event-insight.png`, node `19:144`, 271×152.44 rendered source frame; suggested `public/figma/event-insight.png`.
- `activity-ninja-api-forge.png`, node `19:159`, 271×152.44 rendered source frame; suggested `public/figma/activity-ninja-api-forge.png`.
- Inline SVG radial gradients: hero node `19:28`; NFT tile overlays nodes `19:77`, `19:81`, `19:85`, `19:89`, `19:93`; preserve in CSS/SVG rather than exporting files.

## Data shape
```ts
type LandingData = {
  hero: {
    eyebrow: 'Built on Injective';
    title: string; // 'Complete bounties. Collect proof. Own your track record.'
    description: string;
    primaryCta: { label: 'Get Started'; href: string };
    secondaryCta: { label: 'Browse Bounties'; href: '/bounties' };
    stats: Array<{ value: '128' | '412' | '10+'; label: string }>;
    portfolio: { handle: 'ninja.inj'; memberSince: 2026; completed: string[]; totalCompleted: 5 };
  };
  bounties: Array<{
    category: 'Dev' | 'Design' | 'Content'; title: string; image: string;
    reward: { amount: 500 | 300 | 800 | 250; currency: 'INJ' | 'USDC' };
    daysRemaining: 7 | 5 | 12 | 9; sponsor: 'Injective' | 'Helix' | 'Ninja Labs'; href: string;
  }>;
  news: Array<{
    source: 'Ninja Labs' | 'Injective ecosystem' | 'Events'; date: '2026.06.20' | '2026.06.15' | '2026.06.12';
    title: string; excerpt: string; href: string;
  }>;
};
```
