## Frame
1440 × 1857.60 prototype (node `19:2937`); the rendered admin page is 1438 × 1796.60 inside a 1px prototype border. Main content is 1457.60px tall before a 273px footer.

## Shell
This uses the **public chrome**, not a distinct admin shell: the 64px `rgba(255,255,255,0.85)` translucent header contains mascot/logo, public nav (Bounties, Hall of Fame, Members, Notices), Browse, and Get Started; it retains the dark `#0b1322` public footer. Admin navigation is an in-page 66px white rounded tab strip (User Mgmt, Bounty Mgmt, Hall of Fame, Notices selected), `ADMIN ONLY` badge, and `+ New Post`; no sidebar or admin-specific topbar is present.

## Surface
Page `#fbfbfe`; white table and editor cards; lavender `#eeefff` table header; translucent blurred header and inverse footer. This is a posts-management screen: the table is the existing-post surface and the lower card is the new-post editor.

## Layout
1200px max container with 24px gutters (1152px usable); header/footer outer inset 119px. Main padding is 64px top/80px bottom with 24px stack gaps; intro is 168.04px. Admin tabs are 1152×66 with 21px inset. Posts table is 1152×284, 820px minimum width and horizontal overflow: 52px header, three ~76.5–78px rows, columns 407.98 / 247.91 / 169.87 / 168.20 / 156.04px. Editor card is 1152×671.55 with 21px inset; its 1110px form uses two 545px columns and 20px gaps, 46px inputs, a 144px markdown textarea, and a 45px Save button.

## Typography
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` H1; 24/27.6, 400, -0.24px, `#111a2e` editor H2.
- Space Grotesk Bold: 20/30, 700, `#111a2e` header logo, white footer logo; 16/24, 700, `#eeefff` prototype label.
- Inter Bold: 12/18, 700, +0.96px uppercase, `#4d3dff` Admin and New post form eyebrow.
- Inter Semi Bold: 14/21, 600, `#4f5d77` Browse; 14/21, 600, white primary buttons; 14/20, 600, `#111a2e` form labels/table titles; 14/20, 600, `#263450` table headings; 14/20, 600, `#3d2ed9` Edit; 12/18, 600, `#4f5d77` neutral badge, `#3d2ed9` inactive tab, `#eeefff` selected tab, `#0b7a5b` published, `#a66a00` draft.
- Inter Medium: 14/20, 500, `#4f5d77` public nav.
- Inter Regular: 18/28, 400, `#77839c` intro; 14/20, 400, `#4f5d77` table values/select values; 14/normal, 400, `#9ca3af` text/upload/URL placeholders; footer 14/20 (`#77839c`, `#b7b2ce`) and 12/16 `#566180`.

## Colors
`#fbfbfe` page; `#ffffff` cards, inputs, outlined buttons; `#f5f6fb` neutral admin-badge surface; `#0b1322` footer; `#111a2e` headings; `#4f5d77` secondary copy/selects and neutral badge; `#77839c` intro/muted copy; `#9ca3af` placeholders; `#263450` table headings; `#4d3dff` primary buttons, eyebrows, selected tab; `#3d2ed9` inactive-tab/Edit text; `#eeefff` selected-tab text and table header; `#c3beff` Edit border; `#e3e7f1` card/input/table dividers; `#e4f8f1`/`#0b7a5b` Published status; `#fef3e2`/`#a66a00` Draft status; `#b7b2ce` footer links; `#566180` footer copyright. `rgba(255,255,255,0.85)` header; implementation effects already covered by existing tokens/utilities (--shadow-card/--shadow-frame, white-alpha modifiers), not new palette colors: `rgba(33,24,125,0.12)` prototype shadow, `rgba(17,26,46,0.06)` and `rgba(17,26,46,0.05)` card shadow, `rgba(0,0,0,0)` transparent button border, `rgba(255,255,255,0.9)` footer heading, and `rgba(255,255,255,0.08)` footer rule.

## Radii/Borders/Shadows
20px tab/table/editor cards; 10px primary and outlined buttons, inputs, select controls, and textarea; 999px tab/status badges; 8px mascot. 1px `#e3e7f1` card/input/table borders and row dividers; 1px `#c3beff` outlined Edit button. Cards use `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; prototype frame uses `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Badge: 24px high, 10px/3px padding, 999px. `ADMIN ONLY` is `#f5f6fb`/`#4f5d77`; tabs are `#eeefff`/`#3d2ed9` inactive and `#4d3dff`/`#eeefff` selected; Published is `#e4f8f1`/`#0b7a5b`, Draft is `#fef3e2`/`#a66a00`.
- SectionHeader: Admin eyebrow, management H1, description, admin badge, and `+ New Post` primary action.
- New admin table: lavender 52px header with Title, Category, Status, Published, Action; 20px cell inset and ~77px rows. Each row has an outlined 69×44 Edit action; records show published date or `–` for drafts.
- New post editor: two-column Title/Category and Thumbnail/External link rows, full-width `Body (markdown)` 144px textarea, Status select (`Draft / Publish`), then Save. Controls are labeled and 46px tall; select affordances are a trailing `▾`.
- Management rows are AdminTable rows (NOT the public NoticeRow component); they expose category, publication state/date, and Edit rather than public feed-card presentation. No rendered instances of RewardPill, BountyCard, MemberCard, or StepIndicator.

## Interactions
Public nav/footer/CTAs are links. Admin tabs switch administration areas. `+ New Post` opens/focuses the creation editor; Edit loads a row into it. Category and Status are dropdowns; thumbnail invokes upload; external link is optional; markdown textarea accepts body content. Save persists Draft or Publish. Latest published records surface on Intro (01) and Notices list (08); drafts have no published date and should remain private.

> Mock-scope note: the state-changing behaviors above (assign/confirm/save/publish) are the design's product semantics. The G002 implementation renders them as static visual states only — no mutations — per the frozen matrix scope; wiring them is future backend scope.

## Responsive inference
At 768px: public nav collapses to a menu, title wraps, header badge/action can move beneath title, and admin tabs wrap; retain 24px gutters. The posts table keeps its 820px min-width with horizontal scrolling; editor columns can remain two-up only when practical, otherwise stack. At 390px: header reduces to menu plus primary CTA; tabs wrap; table remains horizontally scrollable; all editor controls become one column, textarea stays full width, and footer columns stack.

## Assets
- `Ninja Labs mascot`, nodes `19:2944`/`19:3081`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- No post thumbnail is populated in this frame; Thumbnail is an admin upload field.

## Data shape
```ts
type NoticeCategory = 'ninja_labs' | 'injective_ecosystem' | 'events';
type NoticeStatus = 'draft' | 'published';

// Admin-only model (src/lib/admin.ts): published rows are slug-keyed derivations of public notices;
// draft rows exist ONLY in the admin registry — private, never added to the public notices registry.
type AdminPost = {
  id: string;
  slug: string;
  title: string;
  category: NoticeCategory;
  bodyMarkdown: string;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  status: NoticeStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorAdminId: string;
};
```
