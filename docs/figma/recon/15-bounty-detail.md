## Frame
1440 × 1511.69; x=3400, y=5372.7734375 (node `19:1739`).

## Shell
IDENTICAL standard chrome: 64px translucent header with logo/nav/actions and inverse dark three-column footer plus copyright. Detail-specific page chrome adds “← Back to bounties”, Public view and Actions require login badges.

## Surface
`#fbfbfe` page with white article, submit, and sidebar cards; reward sidebar is lavender `#eeefff`; footer `#0b1322`; header is blurred `rgba(255,255,255,.85)`. No hero gradient.

## Layout
1200px max width/24px gutters (1152px); main 64px top, 80px bottom, 32px vertical gaps. Header block is flex-between: 631px title side and right badges. Detail grid is 3 equal columns, 24px gaps: 760px article spans 2 columns, 368px aside. Article description card 760×524; body inset 21px. Submit card is 760×184, 24px below. Aside stacks 235px reward, 194px completion, 187px agent cards with 20px gaps. Requirement meta cells: 3×231.33px with 12px gaps.

## Typography
- Space Grotesk Regular: 48/55.2, 400, -0.48px, `#111a2e` H1; 24/27.6, 400, -0.24px, section headings.
- Space Grotesk Bold: 20/30, 700 `#111a2e` logo; 18/28, 700, -0.18px `#111a2e` agent title; 16/24, 700 `#111a2e` meta labels; 14/21, 700 `#111a2e` reward value.
- Inter Bold: 12/18, 700, +.96px uppercase, `#4d3dff` labels; 14/20, 700, `#4d3dff` reward-flow numerals.
- Inter Semi Bold: 14/20, 600, `#4d3dff` back link; 14/21, 600 button labels; 12/18, 600 badges; `#3d2ed9`, `#0b7a5b`, `#b42323`, or white by variant.
- Inter Regular: 16/24, 400, `#4f5d77` rich body; 14/20, 400, `#77839c` help/meta; 14/20, 400, `#4f5d77` side lists; 14/normal, 400, `#9ca3af` input placeholder.

## Colors
`#fbfbfe` page; `#ffffff` standard cards/input; `#0b1322` footer; `#111a2e` headings; `#4f5d77` rich text; `#77839c` muted; `#9ca3af` placeholder; `#4d3dff` primary/eyebrow; `#3d2ed9` secondary action/category; `#eeefff` category/reward surface; `#dfddff` reward border; `#e3e7f1` standard border; `#c3beff` outline CTA border; `#e4f8f1` active/completion; `#0b7a5b` active; `#fdecec` login warning; `#b42323` warning; header `rgba(255,255,255,.85)`.

## Radii/Borders/Shadows
20px main cards; 14px requirement cells; 10px controls/reward pill; 999px badges/step bubbles; active dot 6px with 3px radius. 1px `#e3e7f1` standard borders; `#dfddff` reward; `#c3beff` outlined CTAs; agent card has 1px dashed `#e3e7f1`. Standard card shadow `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`.

## Components
- Badge: Dev lavender/purple; Active mint with 6px dot; Direct submission gray; Public view mint; login variants red.
- RewardPill: 14px INJ icon + “Sponsor pays: 500 INJ”, lavender surface/border.
- SectionHeader/detail masthead: back link, H1, category/status/submission badges.
- Meta row: Deliverable (GitHub repo, preview URL, README), Deadline (July 14, 2026 at 23:59 UTC), Review (Ninja Labs triage plus sponsor approval).
- StepIndicator: mint 24px numbered circles, three completion steps.
- Submit panels: login-required direct work-link input + Submit; agent registration variant.

## Interactions
Back link returns to bounties. Nav/footer links remain active. Detail is publicly readable, but “Sign in first”, completed-work URL input and Submit require login; agent CTA registers a verified agent. Hover states are not specified.

## Responsive inference
At 768: collapse nav; title/badges stack; article/aside become one column; 3 meta cells wrap or become a single column; submission input/button stack. At 390: 16–20px gutters, full-width controls, all badge groups wrap, requirement cells and sidebar panels stack; footer columns stack.

## Assets
- `Ninja Labs mascot`, `19:1746`/`19:1888`, 28×28, `public/figma/ninja-labs-mascot.svg`.
- `injective-token.svg`, `19:1832`, 14×14, `public/figma/injective-token.svg` (also the RewardPill icon).

## Data shape
```ts
type Bounty = {
  id: string; slug: string; title: string; summary: string; descriptionMarkdown: string;
  category: 'Dev' | 'Design' | 'Content'; status: 'active' | 'closed';
  reward: { amount: number; currency: 'INJ' | 'USDC' }; sponsor: string;
  deadline: string; submissionMode: 'direct' | 'agent'; deliverables: string[];
  reviewProcess: string; coverImage?: string; completionSteps: string[];
};
// { id:'iasset-price-widget', status:'active', category:'Dev', sponsor:'Injective',
//   reward:{amount:500,currency:'INJ'}, deadline:'2026-07-14T23:59:00Z', submissionMode:'direct' }
```
