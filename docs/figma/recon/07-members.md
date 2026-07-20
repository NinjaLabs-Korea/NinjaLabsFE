## Frame
Node `19:704`, native 1440 × 1447.54 px at x=6680, y=160.

## Shell
IDENTICAL standard chrome: 64px blurred/translucent header with logo, Bounties/Hall of Fame/Members/Notices nav, Browse/Get Started; standard dark 273px footer with brand, Platform and Community link columns, copyright.

## Surface
`#fbfbfe` page with white card surfaces; member photos use `linear-gradient(135deg,#dfddff,#f5f6fb)`. No inverse content section or large gradient beyond photo placeholders.

## Layout
1200px max container, 24px gutters (1152px usable), main 64px top/80px bottom. Intro copy max 768px. Role filter row 32px tall. Member grid: 4 columns × 273px, 20px gap, cards 354.44px content height with 271×152.44 media. Rules section: full 1152px card with four equal 265.5px columns, 16px gap, 12px internal padding.

## Typography
- Space Grotesk Regular: 48/55.2 tracking -0.48px H1, 24/27.6 tracking -0.24px section heading; Bold 19.8/28 tracking -0.2px member name, `#111a2e`.
- Inter Bold: 12/18, tracking .96px uppercase, `#4d3dff`.
- Inter Regular: 18/28 intro and 14/20 bio/rules/footer, `#77839c`.
- Inter Medium: 14/20 nav, `#4f5d77`; Semibold: 14/20 role/links `#4d3dff`, 12/18 pills, 14/21 buttons/footer headings.

## Colors
`#fbfbfe`, `#fff`, `#111a2e`, `#77839c`, `#4f5d77`, `#4d3dff`, `#3d2ed9`, `#0b1322`, `#b7b2ce`, `#566180`, `#e3e7f1`, `#f5f6fb`, `#dfddff`. Public/status green `#e4f8f1` + `#0b7a5b`; active Core pill `#4d3dff` + `#eeefff`; inactive role pills `#eeefff` + `#3d2ed9`.

## Radii/Borders/Shadows
10px filter/rules tiles/buttons; 20px member and rules cards; 999px pills; 1px `#e3e7f1` card border. Card shadow `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; outer frame `0 14px 36px rgba(33,24,125,.12)`.

## Components
- **MemberCard-like Article ×4:** 271×152.44 photo/placeholder, 20px padding, name, role/category line, shared public-profile `bio`, Profile link plus contextual link. Jinyoung Park (Core/Product lead, Posts), Juho Kim (Dev/Protocol engineer, Agents), Mina Seo (Design/Experience, Bounties), Ara Choi (Ops/Community, Notices). Ara has initials fallback `AR` in a 96px `#dfddff` circle and a 32px low-opacity image mark.
- Role filter pills: active Core; inactive Dev/Design/Ops. Public status pill.
- Assignment rule tiles: registration is shared; admin enables `is_member`; member edits bio; unassign hides card but preserves profile.
- No leaderboard/rank styling appears on this screen.

## Interactions
Role pills imply filtering by Core/Dev/Design/Ops; member Profile and contextual Posts/Agents/Bounties/Notices links; header/footer actions. Hover states and filter-selected behavior beyond Core are not specified.

## Responsive inference
At 768px member grid 2 columns and rules grid 2×2; heading status wraps below. At 390px nav/actions collapse to menu, role chips wrap, member cards and rules stack to one column, footer stacks. Preserve image aspect ratio and 20–24px gutters.

## Assets
- `Ninja Labs mascot` (19:711 header; 19:828 footer), 28×28; `public/figma/ninja-labs-mascot.svg`.
- `Member photo placeholder` (19:749/764/779), 271×152.44; `public/figma/member-photo-placeholder.jpg` (three source photos required when supplied).
- `Image` (19:796), 32×32 unidentified low-opacity mark; `public/figma/member-image-mark.svg`.

## Data shape
```ts
type Member = { id: string; name: string; initials: string; role: 'Core'|'Dev'|'Design'|'Ops'; title: string; bio: string; photoUrl?: string; isMember: boolean; links: Partial<Record<'profile'|'posts'|'agents'|'bounties'|'notices', string>> }
```
Examples: `{name:'Juho Kim', role:'Dev', title:'Protocol engineer', isMember:true, links:{profile:'/u/juho',agents:'/agents'}}`. Visibility trigger: `is_member === true`; profile/bio remain live when false.
