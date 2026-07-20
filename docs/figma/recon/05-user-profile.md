## Frame
Node `19:244`, native 1440 × 1921.5 px at x=1760, y=160.

## Shell
IDENTICAL standard chrome: 64px translucent/6px-blurred header with logo, Bounties/Hall of Fame/Members/Notices, Browse/Get Started; dark `#0b1322` 273px footer with brand, Platform/Community link columns and copyright.

## Surface
`#fbfbfe` page and white profile/cards. Inverse portfolio panel: `linear-gradient(160deg,#0c1528 0%,#1d2b60 55%,#4d3dff 100%)`, radial `rgba(123,108,255,.3)` accents, glass inner panel `rgba(255,255,255,.1)` with blur(4px). NFT tiles use `linear-gradient(135deg,#2e22ab 0%,#4d3dff 55%,#9a90ff 100%)` and radial white `.35` highlight.

## Layout
Profile summary is 1152px at 64px top: 936px card plus share badge, 21px padding, 96px avatar and 24px gap. Content is 1200px max/24px gutters (1152px). Portfolio 1152×518.2, 40px padding, 5-column grid: copy spans 2 columns; glass panel spans 3 (630.4×438.2). NFT grid 4×2, 138.1px squares, 12px gaps. Completion cards 3 columns (370.67px), 20px gap; agents 2 columns (566px), 20px gap. Sections use 56px vertical padding and 80px final bottom.

## Typography
- Space Grotesk Regular: 48/55.2 tracking -.48px profile H1; 36/41.4 tracking -.36px inverse hero; 24/27.6 tracking -.24px section; Bold 20/28 agent title, 17.9/28 completion title, 30/45 initials.
- Inter Regular: 16/24 bio/inverse body, 14/20 metadata/card body, `#77839c`; inverse `rgba(255,255,255,.7/.75/.6)`.
- Inter Bold: 12/18 uppercase tracking .96px `#4d3dff`; Semibold: 16/24 inverse identity, 14/21 button, 14/20 count, 12/18 pills; Medium 14/20 nav.

## Colors
`#fbfbfe`, `#fff`, `#111a2e`, `#77839c`, `#4f5d77`, `#4d3dff`, `#3d2ed9`, `#eeefff`, `#dfddff`, `#e4f8f1`/`#0b7a5b` completed/verified, `#e3e7f1` borders, `#c3beff` outlines, `#0b1322` footer, `#b7b2ce` footer links, `#566180` copyright.

## Radii/Borders/Shadows
96px avatar circle; 48px NFT circle; 999px pills; 10px buttons; 14px NFT tiles/empty-next tile; 20px cards/glass/agent cards; 28px portfolio. Solid 1px `#e3e7f1`; agent card dashed 1px `#e3e7f1`; next NFT dashed `rgba(255,255,255,.3)`. Card shadow `0 1px 2px rgba(17,26,46,.06),0 1px 3px rgba(17,26,46,.05)`; NFT `0 10px 28px rgba(77,61,255,.28)`.

## Components
- ProfileHero: initials avatar `JM`, skill Badge Dev/Design, green completion Badge, `jaemin.inj`, bio, public/shareable badge.
- Portfolio/NFT collection: parent Ninja NFT plus seven child NFT tiles (`iAsset widget`, `Wallet flow`, `Audit report`, `Docs revamp`, `Hydro guide`, `Helix card`, `Quest copy`) and a dashed `+ next` slot.
- CompletionCard ×3: category Badge, title, completion date, reward; examples 500 INJ / 300 USDC / 180 INJ.
- AgentCard ×2: dashed container, name, Verified pill, wallet key, completed count.

## Interactions
Header/footer links; Browse/Get Started; Browse more; each completion card is a link. Public profile explicitly needs no login. NFT tiles and agent cards have no stated click/hover behavior.

## Responsive inference
At 768px summary badge moves below card; portfolio copy and glass panel stack, NFT grid 3–4 columns; completions 2 then 1 columns and agents 1 column. At 390px menu replaces header nav/actions, avatar/hero stacks, NFT grid 2 columns, all cards one column, 40px panel padding reduces to 20–24px, footer stacks.

## Assets
- `Ninja Labs mascot` (19:251 header; 19:399 footer), 28×28; `public/figma/ninja-labs-mascot.svg`.
- `ninjalabs-mascot.jpg` (19:292 13×13 portfolio pill); `public/figma/ninjalabs-mascot.jpg`.
- `Ninja NFT` (19:300), 48×48; asset unspecified, `public/figma/ninja-nft.png`.
- NFT art is gradient-only layers 19:309/313/317/321/325/329/333, each 138.1×138.1; no external image shown.

## Data shape
```ts
type Profile = { handle:string; initials:string; bio:string; skills:string[]; joinedAt:string; completedBounties: Completion[]; ninjaNft:{imageUrl?:string}; childNfts:{title:string; tokenId?:string}[]; agents: Agent[] }
type Completion = { title:string; category:string; completedAt:string; reward:{amount:number; currency:'INJ'|'USDC'}; childNft?:{tokenId:string} }
type Agent = { name:string; wallet:string; verified:boolean; completedBounties:number }
```
Example `jaemin.inj`, skills `['Dev','Design']`, `completedBounties.length===7`, `joinedAt:'May 2026'`, agent `market-scout-agent` / `inj1...9k4d` / 3. **Difference from empty:** a non-empty `completedBounties` array renders seven child NFT tiles, three recent completion cards, green `7 bounties completed` badge, and populated portfolio copy; a non-empty `agents` array renders two agent cards. `sora.inj` instead has `completedBounties: []`, `childNfts: []`, `agents: []`, neutral `New builder` badge, all three explicit empty panels, different skills/join date/bio, and 29.39px taller portfolio panel.
