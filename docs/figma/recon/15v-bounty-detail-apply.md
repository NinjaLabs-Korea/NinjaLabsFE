## Frame
1440px-wide design frame `19:1911` (“15 Bounty Detail - Apply Variant”); page preview is wrapped by a 1px `#e3e7f1` / 10px / frame-shadow inspection shell. The application-state page itself is 1200px max content with 24px gutters.

## Shell
IDENTICAL public chrome to shipped 15: 64px translucent/blurred header (mascot, Bounties/Hall of Fame/Members/Notices, Browse, Get Started), then inverse three-column footer. No admin tabs. Main has 64px top and 80px bottom padding.

## Surface
`#fbfbfe` page; white article/form/aside cards; lavender reward and workflow-callout surfaces. Application intake is signalled with warning-soft badges, while public viewing stays success-soft and actions are danger-soft login-gated.

## Layout
The masthead is flex-between: 768px-min title column (back link, two-line H1, three badges) and Public view/Actions require login badges. The 3-column, 24px-gap grid gives the article 2 columns (760px) and aside 1 (368px). Unlike 15, the article stacks Description, a 305.5px Apply form, and an apply-status flow; aside stacks a 255px reward-flow panel, After approval panel, and dashed agent panel. Cards use ~21px inner padding; main grid begins 8px below masthead.

## Typography
- Space Grotesk: regular 48/55.2, -0.48px H1; regular 24/27.6 section headings; bold 18/28 agent heading; bold 14/21 reward amount.
- Inter: bold 12/18, +0.96px uppercase eyebrow; semibold 14/21 controls and 12/18 badges; regular 16/24 description; regular 14/20 help, aside copy, and placeholders.
- The login-required pill is Space Grotesk bold 12/18, -0.24px.

## Colors
Token colors: `#fbfbfe`, `#fff`, `#111a2e`, `#4f5d77`, `#77839c`, `#9ca3af`, `#4d3dff`, `#3d2ed9`, `#eeefff`, `#dfddff`, `#c3beff`, `#e3e7f1`, `#f5f6fb`, `#e4f8f1`/`#0b7a5b`, `#fdecec`/`#b42323`, `#fef3e2`/`#a66a00`, and `#0b1322`.

**Non-token literals to preserve or replace with a semantic token:** header `rgba(255,255,255,.85)`; footer heading `rgba(255,255,255,.9)` and divider `rgba(255,255,255,.08)`; transparent control borders `rgba(0,0,0,0)`.

## Radii-Borders-Shadows
20px main cards; 14px inner callouts; 10px inputs/buttons/reward pill; 999px badges and 24px numbered circles. Standard cards: 1px `#e3e7f1` plus `0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05)`; reward: `#dfddff`; action outline: `#c3beff`; agent panel: dashed `#e3e7f1`. Preview frame uses `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Existing public Header/Footer, Badge, Button, Input/Textarea, card, RewardPill, and status-flow primitives.
- New/variant patterns: intake badge (`Application intake ON`); `ApplyPanel` with `LOGIN REQUIRED`, intake-rules link, two-column first row and full-width textarea; `ApplyStatusFlow`; `AfterApproval` ordered panel; reward-flow explanatory list.
- Form fields: Relevant work link (placeholder “Audit report or GitHub profile”), Availability (“Can deliver by July 20”), Application note (“Summarize your audit approach and relevant Injective or CosmWasm experience.”); primary Apply and outlined disabled-until-approved Submit.

## Interactions
**Entry-point evidence:** this is reached from an apply-type bounty’s Detail page when `bounty.application_required` is ON; design copy says “Viewing is public; applying and submitting require login.” Back returns to Bounties. View intake rules opens the explanatory apply workflow (screen 16). Apply requires login and submits the application; sponsor approval unlocks completed-work submission. Register an agent routes to agent registration (screen 17); verified agents require owner wallet-key proof. Global nav/footer remain links.

## Responsive inference
At 768px, collapse/hide desktop nav, stack masthead badges and change article/aside to one column; make the two short form fields a single column and make flow badges wrap. At 390px use 16–20px gutters, full-width controls, stacked agent/reward panels, and vertically ordered status steps; footer columns stack.

## Assets
Ninja Labs mascot, 28×28 (`public/figma/ninja-labs-mascot.svg`) in header/footer. Reward uses a literal `$` rather than the Injective token asset. No other image assets.

## Data shape
```ts
type BountyApplication = {
  bountyId: string;
  applicationRequired: true;
  status: 'open' | 'under_review' | 'approved' | 'submitted' | 'completed';
  relevantWorkUrl: string;
  availability: string;
  note: string;
  applicantId: string;
  reviewedAt?: string;
};
// Apply is allowed while open; completed-work submission is allowed only when status === 'approved'.
```

## Diff vs shipped 15 Bounty Detail
**Changes only:**
1. Masthead adds warning `Application intake ON`; title/content becomes “Smart contract audit for reward vault,” sponsor reward becomes 800 USDC, and description is application/audit-specific.
2. The direct `Submit` panel is replaced by `ApplyPanel`: work link, availability, application note, Apply CTA, intake-rules CTA, and an outlined submit-disabled state.
3. New article `Apply-type status` panel renders Open → Under review → Approved → Submitted → Completed.
4. Aside reward panel changes from simple reward metadata to the three-item application/release flow; completion panel becomes `After approval`; agent panel copy changes to “apply or submit” after wallet-key verification.
5. Footer/main note explicitly records `bounty.application_required ON`.
6. The shipped 15 Deliverable/Deadline/Review meta-cell row is REMOVED in the apply variant (ground truth 19:1911: 760×350.05 Description card with no meta row).

**Identical (everything not listed in Changes 1-6):** public Header/Footer; 1200px container, gutters, card/grid vocabulary; back/public/login conventions; base typography, token palette, radii, card shadows, standard badges, and public-read/login-gated model.
