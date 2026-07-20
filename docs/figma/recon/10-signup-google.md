## Frame — native width/height, x/y
1440 × 1270.4; x=3400, y=2925.7737. Screen canvas begins after a 48px dark Figma label and 12px gap; rendered page is 1438px wide inside a 1px border.

## Shell — header/footer variance vs the standard chrome (logo+nav(Bounties,Hall of Fame,Members,Notices)+Browse/Get Started; footer 3-col + copyright). State IDENTICAL or list diffs.
IDENTICAL. Header: translucent white (`rgba(255,255,255,.85)`, blur 6px), 64px high, 1200px container/24px inner gutters. Footer: #0b1322, 48px vertical padding, logo/description plus Platform and Community link columns; copyright divider at 184px. No third link column is present in this design.

## Surface — default vs inverse/dark sections; gradient usage
Default page #fbfbfe; white form card; pale #eeefff information panel; dark #0b1322 footer. No gradients.

## Layout — container max-width, gutters, section paddings, grid columns+gaps
Shell max-width 1200px, 24px gutters. Main padding 64px top/80px bottom, 32px vertical groups. Signup column 768px; StepIndicator 45px high with four 186px tracks and 8px gaps. Center card 576px (534px inner), 20px internal gaps, 21px padding.

## Typography — every distinct text style seen: family, size/line-height, weight, tracking, color (hex as given by Figma)
Space Grotesk Bold: brand 20/30 #111a2e or white; card title regular 36/41.4, tracking -0.36px #111a2e; section title Bold 18/28, tracking -0.18px #111a2e; Google glyph Bold 16/24 white. Inter: nav Medium 14/20 #4f5d77; button Semibold 14/21 or 16/24 white; body Regular 16/24 #77839c; body/list Regular 14/20 #77839c; labels Semibold 12/18 #b42323 or #111a2e, uppercase tracking .96px #4d3dff; footer copyright Regular 12/16 #566180. Footer headers Semibold 14/20 rgba(255,255,255,.9), links Regular 14/20 #b7b2ce.

## Colors — every distinct color/gradient with hex/rgba values and where used
#fbfbfe page; #fff cards; #0b1322 footer; #4d3dff primary/active/validation; #eeefff info; #f5f6fb future steps; #dfddff not used here; #e3e7f1 borders; #111a2e headings; #4f5d77 nav; #77839c secondary; #fdecec status chip; #b42323 chip text; #b7b2ce footer links; #566180 copyright; rgba(255,255,255,.85) header; rgba(255,255,255,.9) footer heading; rgba(255,255,255,.08) divider; rgba(17,26,46,.06/.05) card shadow; rgba(33,24,125,.12) frame shadow.

## Radii/Borders/Shadows — distinct values
Outer preview 10px, border 1px #e3e7f1, shadow 0 14px 36px rgba(33,24,125,.12). Cards 20px/1px #e3e7f1/shadow 0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05); info panels 14px/1px; buttons/steps 10px; status 999px; mascot 8px.

## Components — instances of Badge / RewardPill / BountyCard / NewsCard / SectionHeader / StepIndicator / MemberCard / other repeats, with variant details (e.g. badge colors per category, pill with INJ icon vs $)
StepIndicator: Login active #4d3dff/white; Wallet+NFT, Profile, Get Started inactive #f5f6fb/#77839c. Status Badge: “SIGN-UP FLOW (login in progress)” #fdecec/#b42323. Primary full-width CTA: Google glyph + “Continue with Google.” Info panel: Cloudflare Turnstile. Edge-cases card lists login and OAuth failure paths. Shared Header/Footer.

## Interactions — links, hover states, inputs, tabs/filters
Header nav/Browse/Get Started links; Google CTA starts Turnstile then OAuth; failure clears error and permits retry. Turnstile is a pre-OAuth bot check. No hover states, form inputs, tabs, or filters shown.

## Responsive inference — how the layout should collapse at 768/390 (grid cols, nav, stacking)
At 768 keep a single fluid signup column (max 576px card) with StepIndicator at full available width; header nav should collapse to menu and footer columns stack. At 390, steps should wrap/stack in numeric order (labels otherwise overflow), card is full-width with 16px gutter, and footer/link groups stack.

## Assets — every image/svg: figma layer name, node id if identifiable, natural size, suggested public/figma/<filename>
`ninjalabs-mascot.jpg` (19:1107), 44×44, `public/figma/ninjalabs-mascot.jpg`; header `Ninja Labs mascot` (19:1075), 28×28, `public/figma/ninja-labs-mascot.svg`; footer mascot (19:1136), 28×28, same asset. Google is text “G”, not an exported asset.

## Data shape — the typed record this screen implies (fields + example values from the design copy)
`SignupLogin { step: 1; provider: 'google'; turnstilePassed: boolean; oauthStatus: 'idle'|'failed'|'complete'; error?: string; }` — provider `google`; copy states: “Bot check passes before Google OAuth starts” and “Google login declined or failed”.
