## Frame
1440px-wide admin prototype inside a bordered 1440px frame (node `19:2527`), with 1200px maximum content width and 1152px usable main width after 24px gutters. The public footer is included.

## Shell
This uses BOTH chrome systems. Public chrome remains intact: a 64px translucent `rgba(255,255,255,.85)` header with mascot/logo, public navigation, Browse and Get Started, plus the dark `#0b1322` footer. Admin-specific chrome is in the main content: an `ADMIN ONLY` badge, `+ New Bounty` primary action, and a 66px white admin tab bar (Bounty Mgmt active; User Mgmt, Hall of Fame and Notices inactive). No admin sidebar or dedicated admin topbar is present.

## Surface
Page `#fbfbfe`; table and create form are white. Header uses `rgba(255,255,255,.85)` plus 6px backdrop blur; footer is `#0b1322`. Table header and inactive admin tabs/reward pills use `#eeefff`; active tab/primary actions use `#4d3dff`. Status pills provide success, warning, and danger surfaces.

## Layout
Frame is 1440px; public header/footer have 119px outer inset, 1200px max container, and 24px internal padding. Main has 64px top, 80px bottom, and 24px section gaps. Intro is 811.42px wide; its right action area contains the 24px Admin Only badge and 45px New Bounty button with 8px gap. Admin tabs are 1152×66px with 21px inset. Management table is 1152px wide with horizontal overflow and `min-width:900px`; columns are Title 244.23, Sponsor 149.05, Reward 198.85, Intake 111.22, Status 163.51, Deadline 135.86, Action 147.28px. Header cells use 20px horizontal/16px vertical padding; body rows are ~77px with 20px horizontal and roughly 28px vertical padding. The New Bounty form panel fills 1152px, has 21px horizontal inset, and is a two-column grid with 20px row/column gaps: two 78px rows, a 102px intake/tag row, 150.5px Description and Submission Guide textarea rows, then 45px button row; form height is 722.2px. Reward token/amount split the right column with a 12px gap.

## Typography
- Space Grotesk Regular: H1 48/55.2px, 400, -0.48px, `#111a2e`; form H2 24/27.6px, 400, -0.24px, `#111a2e`.
- Space Grotesk Bold: logo 20/30px, 700, `#111a2e` (white in footer); reward amounts 14/20px, 700, `#111a2e`; USDC `$` 12/20px, 700, `#4d3dff`.
- Inter Bold: admin/form eyebrow 12/18px, 700, +0.96px uppercase, `#4d3dff`.
- Inter Semi Bold: form labels/table headers/title/buttons 14/20px (`#111a2e`/`#263450`/`#3d2ed9`); chips/statuses 12/18px (`#eeefff`, `#3d2ed9`, `#0b7a5b`, `#a66a00`, `#b42323`).
- Inter Medium: public nav 14/20px, 500, `#4f5d77`.
- Inter Regular: intro 18/28px `#77839c`; table Sponsor/Intake/Deadline and select values 14/20px `#4f5d77`; helper copy 12/16px `#77839c`; input/textarea placeholders 14px (normal or 20px leading) `#9ca3af`; footer links 14/20px `#b7b2ce`, copyright 12/16px `#566180`.

## Colors
`#fbfbfe` page; `#ffffff` panels/inputs/buttons; `#f5f6fb` Admin Only surface; `#111a2e` headings/title/reward amount; `#263450` table headers; `#4f5d77` secondary/nav/select/table values; `#77839c` muted/help; `#9ca3af` placeholders; `#4d3dff` primary/active tab/eyebrow; `#3d2ed9` inactive tabs/tags/secondary Edit; `#eeefff` table header/inactive tabs/reward surface; `#dfddff` reward border; `#c3beff` Edit border; `#e3e7f1` panels/inputs/row border; `#e4f8f1` Active surface; `#0b7a5b` Active text; `#fef3e2` Reviewing surface; `#a66a00` Reviewing text; `#fdecec` Closed surface; `#b42323` Closed text; `#0b1322` footer; `#b7b2ce` footer links; `#566180` footer copyright; `rgba(255,255,255,.85)` header; `rgba(0,0,0,0)` transparent button border; `rgba(255,255,255,.9)` footer heading; `rgba(255,255,255,.08)` footer divider; `rgba(17,26,46,.06/.05)` panel shadow; `rgba(33,24,125,.12)` prototype shadow. All colors are existing tokens except transparent/white-alpha and shadow RGBA utilities; these are implementation effects, not new palette colors.

## Radii/Borders/Shadows
Panels, admin nav, table and form have 20px radius with 1px `#e3e7f1`; inputs/buttons/reward pills are 10px; mascot is 8px; chips/statuses are 999px. Reward pill has 1px `#dfddff`; Edit has 1px `#c3beff`; primary buttons have transparent borders. Standard panels/table use `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; outer prototype uses `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Existing Badge: 24px pill with 10px/3px padding. Admin tabs are active `#4d3dff`/`#eeefff` or inactive `#eeefff`/`#3d2ed9`; Admin Only is `#f5f6fb`/`#4f5d77`; statuses are Active `#e4f8f1`/`#0b7a5b`, Reviewing `#fef3e2`/`#a66a00`, Closed `#fdecec`/`#b42323`.
- Existing RewardPill: `#eeefff`, 1px `#dfddff`, 10px radius, 13px/6px padding, 6px icon/text gap; 14px INJ token icon or `$` glyph followed by bold values such as `500 INJ`, `800 USDC`, and `300 INJ`.
- New admin table: 900px minimum-width, lavender header, fixed seven columns, 1px row separators. It shows title, sponsor, reward, intake ON/OFF, status, deadline and an Edit action.
- New actions: `+ New Bounty` primary 45px button opens creation; every row has outlined lavender Edit. Status is shown as a pill, not as an inline select in the table.
- New bounty form: a full-width inline panel (no overlay/scrim) with eyebrow/H2; two-column labeled text/date fields; `INJ ▾` reward-token select plus amount input; `OFF ▾` application-intake select with helper copy; multi-select-style Dev/Design/Content/Other tags; 112px-min textareas for Description and Submission guide/evaluation criteria; and Create primary action.
- Existing BountyCard/NoticeRow/MemberCard/SectionHeader/StepIndicator are not instantiated. The public Bounty listing is not shown; this is management-table UI.

## Interactions
Public links/CTAs and footer navigate normally. Admin tabs switch administration sections. `+ New Bounty` reveals/focuses the illustrated New Bounty form; Edit opens an existing bounty in equivalent edit controls. Reward token dropdown and intake dropdown change their values; intake links to the public list toggle and apply flow. Field tags can be selected; Create submits the sponsor-backed bounty. Rewards lock their token at creation; reward lifecycle is lock → release → transfer with no swap. Status transitions, validation, save/cancel behavior, confirmation dialogs, and table filtering/pagination are not specified.

## Responsive inference
At 768px, collapse public nav to a menu while preserving 24px gutters; wrap intro/badge/New Bounty action and allow the admin tabs to scroll or wrap. Keep the management table horizontally scrollable at 900px rather than dropping columns. Form remains two columns where space allows, then stacks paired reward controls. At 390px, use menu plus primary CTA; stack headline/actions, horizontally scroll tabs/table, make form single-column/full-width, stack reward token and amount, wrap tags, and retain full-width textareas. Footer columns stack.

## Assets
- `Ninja Labs mascot`, nodes `19:2534`/`19:2731`, 28×28; existing public mascot asset (`public/figma/ninja-labs-mascot.svg`).
- `injective-token.svg`, nodes `19:2598`/`19:2644`, 14×14, used in INJ RewardPill; existing `public/figma/injective-token.svg`.
- No bounty cover images or other unique assets are instantiated.

## Data shape
```ts
type AdminBounty = {
  id: string;
  title: string;
  sponsor: string;
  reward: { amount: number; token: 'INJ' | 'USDC' }; // token locks on create
  intakeEnabled: boolean;
  status: 'active' | 'reviewing' | 'closed';
  deadline: string; // display: MM.DD
  tags: Array<'Dev' | 'Design' | 'Content' | 'Other'>;
  description: string; // markdown
  submissionGuide: string;
};
// { title:'Frontend widget dev', sponsor:'Injective', reward:{amount:500,token:'INJ'},
//   intakeEnabled:false, status:'active', deadline:'2026-07-10', tags:['Dev'] }
```
