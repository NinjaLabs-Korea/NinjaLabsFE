## Frame
Node `19:553`, native 1440 × 2445.77 px at x=5040, y=160.

## Shell
IDENTICAL standard chrome: 64px translucent (`rgba(255,255,255,0.85)`, 6px blur) header with mascot/logo, Bounties/Hall of Fame/Members/Notices nav, Browse and Get Started. Standard `#0b1322` 273px footer: brand/tagline plus Platform (Bounties, Hall of Fame, Notices) and Community (X / Twitter, Discord) columns; copyright row.

## Surface
`#fbfbfe` page. White cards on light surface; one inverse hero-stat panel uses `linear-gradient(160deg, #0c1528 0%, #1d2b60 55%, #4d3dff 100%)` with radial `rgba(123,108,255,0.3)` accents. Partner wall/image placeholder has `linear-gradient(133.98deg,#dfddff,#f5f6fb)`.

## Layout
1200px shell/container with 24px inner gutters (content 1152px); desktop top/bottom main padding 64/80px. Hero header is 768px copy + status pill. Stats: 3 columns, 20px gap, 40px panel padding. Featured articles: 3 columns, 20px gap (370.67px cards), 207.37px media. Timeline: 3 columns, 24px gap over a horizontal rule. Partner wall 1152×522.2px. Sections separate at 56–60px.

## Typography
- Space Grotesk Bold: 20/30, 36/36 stat, 18/28 article, 19.8/28 timeline, `#111a2e` (white inverse); Space Grotesk Regular: 48/55.2 tracking -0.48px H1, 24/27.6 tracking -0.24px H2.
- Inter Bold: 12/18, tracking 0.96px uppercase, `#4d3dff`.
- Inter Regular: 18/28 `#77839c`; 14/20 `#77839c`; 14/21 `rgba(255,255,255,0.62)` in stats; 12/16 footer copyright `#566180`.
- Inter Medium: 14/20 nav `#4f5d77`; Inter Semibold: 14/21 buttons, 12/18 pills, 14/20 footer headings/links.

## Colors
`#fbfbfe` page, `#fff` cards, `#111a2e` heading, `#77839c` body, `#4f5d77` nav, `#4d3dff` primary, `#3d2ed9` outlined action/purple pill text, `#0b1322` footer, `#b7b2ce` footer links, `#566180` copyright, `#eeefff` lavender pill, `#dfddff` timeline ring, `#c3beff` rules/outline, `#e3e7f1` borders, `#e4f8f1`/`#0b7a5b` success, `#fef3e2`/`#a66a00` partnership. Inverse overlays `rgba(255,255,255,0.06)` with `rgba(255,255,255,0.14)` border.

## Radii/Borders/Shadows
10px buttons; 20px cards/stat tiles; 28px gradient/partner panels; 999px pills/timeline dots. 1px `#e3e7f1` cards; timeline dot 4px `#dfddff`; footer rule `rgba(255,255,255,0.08)`. Card shadow `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; frame shadow `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Stat tiles: 128 Bounties run, 412 Builders onboarded, `$—` Rewards paid; this is platform aggregate, explicitly not a ranking.
- NewsCard/Article ×3: gradient media placeholder; category pill variants Milestone green, Featured bounty lavender, Partnership amber; title/body.
- Timeline milestone: 40px violet circle with pale 4px ring, title/date-description.
- SectionHeader: uppercase kicker + 24px title; outlined Read notices action.

## Interactions
Header/footer navigation and Browse/Get Started; Read notices; featured articles are likely links. No hover or input state is specified. Admin-driven highlights are stated as `platform_highlight`; stats aggregate bounty/user/reward records.

## Responsive inference
At 768px retain 24px gutters; hero status moves beneath copy, stats and articles become a single column (or 2 then 1), timeline stacks vertically and replaces/hides horizontal rule. At 390px collapse nav/actions into a menu, all panels/cards one column, reduce 48px H1 and 40px panel padding; footer stacks brand then link columns.

## Assets
- `Ninja Labs mascot` (19:560 header; 19:681 footer), 28×28; suggested `public/figma/ninja-labs-mascot.svg`.
- `Community event photo` (19:615, 19:625, 19:635), 368.67×207.37 each; placeholder/unidentified image, suggested `public/figma/community-event-photo.jpg`.
- `Ninja Labs KR community partner wall` (19:672), 1152×504; suggested `public/figma/ninja-labs-kr-community-partner-wall.jpg`.

## Data shape
```ts
type HallOfFame = { stats: { bountiesRun: number; buildersOnboarded: number; rewardsPaid: string }; highlights: { category: 'Milestone'|'Featured bounty'|'Partnership'; title: string; body: string; image?: string }[]; milestones: { title: string; date: string; description: string }[]; partnerWall?: string }
```
Examples: `128`, `412`, `$—`; `100th builder onboarded`; `May 3, 2026`; admin-curated highlights from `platform_highlight`.
