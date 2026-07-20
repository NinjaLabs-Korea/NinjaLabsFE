## Frame
1440 × 1941.56 prototype (node `19:2754`); the rendered admin page is 1438 × 1880.56 inside a 1px prototype border. Its main content ends at y=1461.56, then a 273px footer.

## Shell
This uses the **public chrome**, not a separate admin sidebar/topbar: the 64px translucent `rgba(255,255,255,0.85)` header has mascot/logo, public nav (Bounties, Hall of Fame, Members, Notices), Browse, and Get Started; the dark `#0b1322` footer is unchanged. Admin-specific navigation is an in-page, 66px white rounded tab strip (User Mgmt, Bounty Mgmt, Hall of Fame selected, Notices), plus an `ADMIN ONLY` badge—there is no sidebar or admin topbar.

## Surface
Page `#fbfbfe`; white tab, table, and form cards; lavender `#eeefff` table header and cumulative-stat cards. Footer is `#0b1322`; header has 6px backdrop blur over translucent white. Cumulative stats are explicitly read-only/auto-aggregated; highlight curation is the editable surface.

## Layout
1200px max page container with 24px internal gutters (1152px content); header/footer outer horizontal inset 119px. Main padding: 64px top, 80px bottom; 32px primary section gaps. Intro is 160.05px high; tabs are 1152×66 with 21px inset. Stats: three 370.67×123 cards with 20px gaps. Curation table is 1152×284, horizontally scrollable with 760px minimum width; header 52px, three ~76.5–78px body rows; columns 253.73 / 365.38 / 134.13 / 212.75 / 184.01px. Add form card is 1152×425 with 21px inset; two 545px columns, 20px gap; five 46px controls in a 78/78/78/45px row grid with 20px row gaps.

## Typography
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` page H1; 24/27.6, 400, -0.24px, `#111a2e` section H2.
- Space Grotesk Bold: 36/36, 700, `#4d3dff` stat values; 20/30, 700, `#111a2e` header logo and white footer logo; 16/24, 700, `#eeefff` prototype label.
- Inter Bold: 12/18, 700, +0.96px uppercase, `#4d3dff` Admin, Read-only, Manual, and form eyebrow.
- Inter Semi Bold: 14/21, 600, `#4f5d77` Browse; 14/21, 600, white primary buttons; 14/20, 600, `#111a2e` labels/table titles; 14/20, 600, `#263450` table headings; 14/20, 600, `#3d2ed9` outlined Edit; 12/18, 600, `#4f5d77` neutral badge, `#3d2ed9` inactive tab, `#eeefff` selected tab.
- Inter Medium: 14/20, 500, `#4f5d77` public navigation.
- Inter Regular: 18/28, 400, `#77839c` intro; 14/21, 400, `#77839c` stat labels; 14/20, 400, `#4f5d77` table/form values; 14/normal, 400, `#9ca3af` input placeholders; footer 14/20 (`#77839c`, `#b7b2ce`) and 12/16 `#566180`.

## Colors
`#fbfbfe` page; `#ffffff` cards, inputs, outlined buttons; `#f5f6fb` neutral admin-badge surface; `#0b1322` footer; `#111a2e` headings; `#4f5d77` secondary copy and inactive admin badge; `#77839c` intro/muted copy; `#9ca3af` placeholders; `#263450` table headings; `#4d3dff` primary buttons, eyebrows, stat values, selected tab; `#3d2ed9` inactive-tab and Edit text; `#eeefff` selected-tab text, table header and stat-card surface; `#dfddff` stat-card border; `#c3beff` Edit border; `#e3e7f1` card/input/table dividers; `#b7b2ce` footer links; `#566180` footer copyright. `rgba(255,255,255,0.85)` header; implementation effects already covered by existing tokens/utilities (--shadow-card/--shadow-frame, white-alpha modifiers), not new palette colors: `rgba(33,24,125,0.12)` prototype shadow, `rgba(17,26,46,0.06)` and `rgba(17,26,46,0.05)` card shadow, `rgba(0,0,0,0)` transparent button border, `rgba(255,255,255,0.9)` footer heading, and `rgba(255,255,255,0.08)` footer rule.

## Radii/Borders/Shadows
20px cards, table, stat cards, and tab panel; 10px primary/outlined buttons and inputs; 999px tab and status badges; 8px mascot. Cards/tables/forms use 1px `#e3e7f1`; stat cards 1px `#dfddff`; Edit uses 1px `#c3beff`; table body rows have 1px top `#e3e7f1`. Card shadow: `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; prototype: `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Badge: 24px high, 10px horizontal/3px vertical padding, 999px radius. `ADMIN ONLY` and `auto-aggregated` use `#f5f6fb`/`#4f5d77`; admin tabs use `#eeefff`/`#3d2ed9` inactive and `#4d3dff`/`#eeefff` selected.
- SectionHeader: Admin eyebrow, H1, two-line description, right-aligned admin-only badge; Cumulative stats and Highlight curation use 12px eyebrow plus 24px H2.
- New admin table: lavender 52px header, five fixed columns, 20px cell inset, 76–78px rows, horizontal overflow; rows show Type, title, integer order, optional link, and outlined Edit action.
- New admin stat card: equal lavender bordered cards for Bounties run, Builders onboarded, and Rewards paid; values are read-only.
- New admin form controls: labeled 46px select/text/upload/URL/number inputs (17px x-padding), two columns; Type select defaults to `Milestone`; Save is 45px primary. `+ Add item` opens/populates this curation form.
- No rendered instances of RewardPill, BountyCard, NoticeRow, MemberCard, or StepIndicator.

## Interactions
Public nav/footer and CTAs are links. Admin tabs switch management destinations. `+ Add item` begins a new `platform_highlight`; Edit loads the selected record. Type dropdown, image upload, optional link, and display-order input feed Save. Cumulative stats are non-editable; the note explicitly says the form directly manages `platform_highlight`.

> Mock-scope note: the state-changing behaviors above (assign/confirm/save/publish) are the design's product semantics. The G002 implementation renders them as static visual states only — no mutations — per the frozen matrix scope; wiring them is future backend scope.

## Responsive inference
At 768px: preserve 24px gutters; public nav collapses to a menu; admin tabs wrap; header actions and badge may move below title; stats become 1–2 columns; form stays two columns only where each control remains usable, otherwise stacks. The table retains its 760px minimum and horizontal scroll. At 390px: menu plus primary CTA replaces header nav; title/description wrap; tabs wrap into multiple rows; stats and all form fields are one column; table remains horizontally scrollable; footer columns stack.

## Assets
- `Ninja Labs mascot`, nodes `19:2761`/`19:2914`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- No highlight image asset is populated in this frame; the Image upload field requires an admin-supplied asset.

## Data shape
```ts
type PlatformHighlight = {
  id: string;
  type: 'milestone' | 'featured_bounty' | 'partnership';
  title: string;
  imageUrl: string | null;
  link: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: string;
};

type CumulativeHallStats = {
  bountiesRun: number;
  buildersOnboarded: number;
  rewardsPaid: 'auto'; // auto-aggregated, admin read-only
  computedAt: string;
};
```
