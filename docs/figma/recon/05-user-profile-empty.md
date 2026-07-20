## Frame
Node `19:422`, native 1440 × 2045.37 px at x=3400, y=160.

## Shell
IDENTICAL standard chrome: 64px translucent/6px-blurred header with logo, Bounties/Hall of Fame/Members/Notices, Browse/Get Started; standard dark 273px footer with brand, Platform and Community columns, copyright.

## Surface
Same `#fbfbfe` page, white profile/card surfaces and inverse portfolio gradient as populated profile: `linear-gradient(160deg,#0c1528 0%,#1d2b60 55%,#4d3dff 100%)`, radial `rgba(123,108,255,.3)` accents and glass `rgba(255,255,255,.1)`. Empty collection uses `rgba(255,255,255,.06)` with dashed `rgba(255,255,255,.22)` border; light empty completion panel is `#f5f6fb` with dashed `#d1d7e6`.

## Layout
Same 1200px max, 24px gutters (1152px usable), 64px top and 80px final bottom as populated profile. Summary card is 936px wide, 21px padding, 96px initials avatar. Portfolio is 1152×547.59 (29.39px taller than populated): 5-column grid, copy spans 2; glass panel spans 3 (630.4×468), 40px padding. Empty NFT state within glass panel is 588.4×318. Completion empty panel is full 1152×294. Agent empty row is full 1152×106.

## Typography
- Space Grotesk Regular: 48/55.2 tracking -.48px H1, 36/41.4 tracking -.36px inverse copy, 24/27.6 tracking -.24px headings; Bold 20/28 agent empty title, 30/45 initials.
- Inter Regular: 16/24 bio/empty copy, 14/20 metadata, `#77839c`; inverse `rgba(255,255,255,.7/.75/.6)`.
- Inter Bold: 12/18 uppercase tracking .96px `#4d3dff`; Semibold: 14/21 buttons, 12/18 badges; Medium 14/20 nav.

## Colors
`#fbfbfe`, `#fff`, `#f5f6fb`, `#111a2e`, `#77839c`, `#4f5d77`, `#4d3dff`, `#3d2ed9`, `#eeefff`, `#dfddff`, `#e4f8f1`/`#0b7a5b`, `#e3e7f1`, `#d1d7e6`, `#c3beff`, `#0b1322`, `#b7b2ce`, `#566180`; inverse overlays described in Surface.

## Radii/Borders/Shadows
96px avatar; 56px empty-state icon tile; 999px badges; 10px buttons; 14px icon tile; 20px summary/empty panels; 28px portfolio. 1px solid `#e3e7f1`; empty light border 1px dashed `#d1d7e6`; inverse empty border 1px dashed `rgba(255,255,255,.22)`. Summary uses `0 1px 2px rgba(17,26,46,.06),0 1px 3px rgba(17,26,46,.05)`.

## Components
- ProfileHero variant: `SK` avatar, Dev/Content badges plus neutral `New builder` (`#f5f6fb`/`#4f5d77`), handle `sora.inj`, bio, shareable status.
- Empty Portfolio state (instead of populated 4×2 child NFT grid): parent Ninja NFT remains, then mascot icon, “No bounty NFTs yet”, explanation, primary Browse active bounties CTA, `0 bounties completed · ready for the first proof`.
- Empty completion state (instead of three CompletionCards): mascot icon, “No completed bounties yet”, explanatory text, Find a first bounty CTA; View filled profile outline action in section header.
- Empty AgentCard (instead of two agent cards): “No registered agents yet”, signature-verification description, Register agent outlined action.

## Interactions
Header/footer and Browse/Get Started links; Browse active bounties and Find a first bounty primary CTAs; View filled profile and Register agent outlined CTAs. No hover states are specified.

## Responsive inference
At 768px summary status drops below card; portfolio columns stack, empty panels remain full width; at 390px navigation becomes a menu, hero/avatar stacks, 40px panels reduce to 20–24px, CTAs stay reachable below copy, footer stacks.

## Assets
- `Ninja Labs mascot` (19:429 header; 19:530 footer), 28×28; `public/figma/ninja-labs-mascot.svg`.
- `ninjalabs-mascot.jpg` (19:470 13×13 portfolio pill; 19:486 and 19:504 30×30 empty icons); `public/figma/ninjalabs-mascot.jpg`.
- `Ninja NFT` (19:478), 48×48, unspecified; `public/figma/ninja-nft.png`.

## Data shape
```ts
type Profile = { handle:string; initials:string; bio:string; skills:string[]; joinedAt:string; completedBounties: Completion[]; ninjaNft:{imageUrl?:string}; childNfts:{title:string; tokenId?:string}[]; agents: Agent[] }
```
Example empty profile: `{handle:'sora.inj', initials:'SK', skills:['Dev','Content'], joinedAt:'July 2026', completedBounties:[], childNfts:[], agents:[]}`. **Empty-state trigger:** `completedBounties.length === 0` (and therefore `childNfts.length === 0`) replaces the NFT grid and completion cards; `agents.length === 0` replaces agent cards. The parent Ninja NFT/profile remains present. Relative to populated `jaemin.inj`, completion count/badge changes from `7 bounties completed` to `New builder`, portfolio title/body and all three lower content regions become their explicit empty states.
