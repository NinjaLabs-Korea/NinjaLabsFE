## Frame
1440px-wide design frame `19:2093` (“16 Bounty Apply”), shown in the same 1px preview wrapper (10px radius, frame shadow). Page content is 1200px max with 24px gutters.

## Shell
Public chrome only: standard 64px blurred/translucent header with mascot, primary nav, Browse, and Get Started; inverse public footer with Platform and Community columns. No admin tabs.

## Surface
`#fbfbfe` page with white comparison and status cards, lavender `#eeefff` button-behavior callouts, and a dark `#0b1322` footer. The global Login required badge is danger-soft; submit-type is success-soft; apply-type is warning-soft.

## Layout
64px top / 80px bottom main padding and 32px section gaps. Header content is a 992px-copy masthead plus login badge: eyebrow, 48px heading, then 18px two-line explanation. A 20px-gap two-column row contains equal 386.5px cards. A full-width status section follows, then a small data-note line. Card padding is 20–21px; comparison cards contain a label, H2, body, lavender behavior callout, and bottom CTA.

## Typography
- Space Grotesk regular 48/55.2, -0.48px H1; bold 24/32 comparison headings; regular 24/27.6 status H2.
- Inter bold uppercase 12/18, +0.96px eyebrow; semibold 16/24 callout heading, 14/21 CTA and 12/18 badge; regular 18/28 masthead text, 16/24 comparison body, and 14/20 callout/data note.

## Colors
Token colors: `#fbfbfe`, `#fff`, `#0b1322`, `#111a2e`, `#4f5d77`, `#77839c`, `#4d3dff`, `#3d2ed9`, `#eeefff`, `#c3beff`, `#e3e7f1`, `#e4f8f1`/`#0b7a5b`, `#fdecec`/`#b42323`, and `#fef3e2`/`#a66a00`.

**Non-token literals:** header `rgba(255,255,255,.85)`; footer heading `rgba(255,255,255,.9)` and divider `rgba(255,255,255,.08)`; transparent button borders `rgba(0,0,0,0)`.

## Radii-Borders-Shadows
20px cards; 14px lavender callouts; 10px CTAs; 999px badges. Cards use 1px `#e3e7f1` and standard card shadow. Status connectors are 1px `#c3beff`; preview wrapper uses the frame shadow.

## Components
- Existing public Header/Footer, card, Badge, Button, and status-chip primitives.
- `BountyTypeComparison`: Submit-type card has `Intake OFF`, explanation, “[Submit] button shown directly → same as Bounty Detail,” and outline `View detail example`.
- Apply-type card has `Intake ON`, explanation, `[Apply] → application form → sponsor review → after approval, [Submit] enabled`, and primary `Apply after login`.
- `StatusFlow`: Open → Under review → Approved → Submitted → Completed with connectors.

## Interactions
**Entry-point evidence:** the Apply panel’s `View intake rules` action on screen 15v links here; this is an explanatory/public workflow page, not the application form itself. `View detail example` targets the normal Bounty Detail (screen 15). `Apply after login` requires login and targets the apply-type bounty’s application experience (15v). Screen copy: direct submissions permit anyone to work and submit; apply-type submission opens only after sponsor approval. Nav/footer function normally.

## Responsive inference
At 768px, masthead badge moves below copy and the two comparison cards stack; status chips can wrap with connectors hidden/reflowed. At 390px, 16–20px gutters, full-width CTAs, each comparison section remains vertically ordered, and the five status stages become a vertical ordered list. Footer stacks.

## Assets
Ninja Labs mascot, 28×28 (`public/figma/ninja-labs-mascot.svg`) in header/footer. No unique artwork or token asset.

## Data shape
```ts
type BountyWorkflow = {
  bountyId: string;
  applicationRequired: boolean; // false = submit-type; true = apply-type
  applicationStatus?: 'open' | 'under_review' | 'approved' | 'submitted' | 'completed';
};
// applicationRequired true gates submit until applicationStatus is 'approved'.
```
