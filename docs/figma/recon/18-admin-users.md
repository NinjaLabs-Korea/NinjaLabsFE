## Frame
1440px-wide admin prototype inside a bordered 1440px frame (node `19:2341`); page content is 1200px max and the frame includes the public footer. Main is 1152px usable after 24px container gutters.

## Shell
This screen retains BOTH pieces of chrome: the public shell is the 64px translucent `rgba(255,255,255,.85)` header (mascot/logo, Bounties/Hall of Fame/Members/Notices nav, Browse and Get Started) and the dark `#0b1322` footer. It additionally uses an admin-specific in-content shell: an `ADMIN ONLY` badge and a 66px white admin tab bar (User Mgmt active; Bounty Mgmt, Hall of Fame, Notices inactive). There is no admin sidebar or separate admin topbar; public header/footer remain visible.

## Surface
Page `#fbfbfe`; content panels/table/form are white. Header is `rgba(255,255,255,.85)` with 6px backdrop blur; footer is `#0b1322`. Admin tab/table-header/reward-selected surfaces use lavender `#eeefff`; admin badge is subtle `#f5f6fb`.

## Layout
Outer page frame is 1440px; header/footer outer inset is 119px and their container is 1200px with 24px inner gutters. Main is 1200px max / 1152px content, with 64px top and 80px bottom padding and 24px vertical gaps. Intro reserves 930.98px alongside the admin badge. Admin tabs are 1152×66px with 21px inset, 8px chip gaps. Search panel is 1152px wide, 21px padding; label/input column is 384px and input is 384×46px. The scrollable table has `min-width:820px`; columns are Nickname 157.21, Email 285.91, Joined 125.13, Wallet 138.06, Member 140.4, Role 104.64, Action 198.65px. Header cells are 20px horizontal/16px vertical; data rows are ~77px, 20px horizontal and ~28px vertical padding. The role-assignment example panel is 672px wide (320px display-order input); its role chips are 24px tall with 8px gaps.

## Typography
- Space Grotesk Regular: H1 48/55.2px, 400, -0.48px, `#111a2e`; modal H2 24/27.6px, 400, -0.24px, `#111a2e`.
- Space Grotesk Bold: logo 20/30px, 700, `#111a2e` (white in footer).
- Inter Bold: admin/modal eyebrow 12/18px, 700, +0.96px uppercase, `#4d3dff`.
- Inter Semi Bold: labels, table headers, nickname and buttons 14/20px (buttons/header heading `#111a2e`/`#263450`; secondary actions `#3d2ed9`); badges/chips 12/18px (`#4f5d77`, selected `#eeefff`, inactive `#3d2ed9`, linked/member `#0b7a5b`).
- Inter Medium: public nav 14/20px, 500, `#4f5d77`.
- Inter Regular: intro 18/28px `#77839c`; table email `#77839c`, date/value `#4f5d77`, support copy 14/20px; input placeholder 14px/normal `#9ca3af`; footer link 14/20px `#b7b2ce` and copyright 12/16px `#566180`.

## Colors
`#fbfbfe` page; `#ffffff` panels/inputs/buttons; `#f5f6fb` admin-only surface; `#111a2e` headings/nicknames; `#263450` table headings; `#4f5d77` secondary/nav; `#77839c` muted copy/email; `#9ca3af` placeholders; `#4d3dff` primary/active chip/eyebrow; `#3d2ed9` inactive chips/secondary actions; `#eeefff` selected-chip/table-header surface and selected-chip text; `#c3beff` secondary-action border; `#e3e7f1` panel/input/row/header border; `#e4f8f1` linked/yes badge surface; `#0b7a5b` linked/yes text; `#0b1322` footer; `#b7b2ce` footer links; `#566180` footer copyright; `rgba(255,255,255,.85)` header; `rgba(0,0,0,0)` transparent button border; `rgba(255,255,255,.9)` footer headings; `rgba(255,255,255,.08)` footer rule; `rgba(17,26,46,.06/.05)` card shadow; `rgba(33,24,125,.12)` prototype shadow. All are existing tokens except transparent/white-alpha and shadow RGBA utilities; these are implementation effects, not new palette colors.

## Radii/Borders/Shadows
Panels, tabs, table and assignment panel: 20px radius and 1px `#e3e7f1`; inputs/buttons/reward actions: 10px; mascot 8px; chips/badges 999px. Secondary Assign/Remove buttons use 1px `#c3beff`; primary buttons use transparent border. Panels/table use `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; outer prototype uses `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Existing Badge: 24px-high pill, 10px/3px padding; active admin nav `#4d3dff`/`#eeefff`, inactive `#eeefff`/`#3d2ed9`; Admin Only `#f5f6fb`/`#4f5d77`; linked wallet and member yes `#e4f8f1`/`#0b7a5b`.
- New admin table: lavender header; horizontal overflow and 820px minimum width; seven fixed-width columns and 1px row separators. Wallet/member use a state pill or em dash; names are semibold, supporting fields regular.
- New row actions: outlined lavender `Assign` when `is_member` is false; outlined `Remove` when it is true. No destructive red variant is depicted.
- New role-assignment modal/panel: 672px white bordered panel with eyebrow/H2, selectable Core/Dev/Design/Ops chip radio group, 320px numeric display-order input, and primary Confirm button. It is illustrated inline rather than over a scrim.
- New form control: labeled 46px text input, 17px horizontal padding and 1px `#e3e7f1` border; search placeholder is “Search by email / nickname”.
- Existing RewardPill/BountyCard/NoticeRow/MemberCard/SectionHeader/StepIndicator are not instantiated on this screen.

## Interactions
Public nav/footer/logo/CTAs navigate normally. Admin tabs switch management sections. Search filters by email or nickname. Assign opens the role-assignment flow for non-members; role chips select `member_role`, display order is editable, and Confirm sets `is_member`; Remove clears member assignment without deleting the public profile. Wallet/member pill states are display status, not shown as inline toggles. Hover, validation, confirmation, pagination, and error states are not specified.

> Mock-scope note: the state-changing behaviors above (assign/confirm/save/publish) are the design's product semantics. The G002 implementation renders them as static visual states only — no mutations — per the frozen matrix scope; wiring them is future backend scope.

## Responsive inference
At 768px preserve the public header as a collapsed menu and 24px gutters; intro/badge and New actions can wrap; admin tabs horizontally scroll or wrap; table remains horizontally scrollable at its 820px minimum. The inline assignment panel expands to available width. At 390px use menu plus primary CTA in the public header, stack intro and badge, make search and assignment fields full width, retain horizontal table scrolling rather than collapsing columns, and stack footer columns. Modal/panel remains a full-width sheet/card with role chips wrapping.

## Assets
- `Ninja Labs mascot`, nodes `19:2348`/`19:2504`, 28×28; existing public mascot asset (`public/figma/ninja-labs-mascot.svg`).
- No user avatars, bounty media, or other unique bitmap/SVG assets are instantiated.

## Data shape
```ts
type AdminUser = {
  id: string;
  nickname: string;
  email: string;
  joinedAt: string; // display: MM.DD
  walletAddress: string | null;
  walletStatus: 'linked' | null;
  is_member: boolean;
  member_role: 'Core' | 'Dev' | 'Design' | 'Ops' | null;
  member_display_order: number | null;
};
// { nickname:'jaemin', walletStatus:'linked', is_member:false,
//   member_role:null, member_display_order:null }
```
