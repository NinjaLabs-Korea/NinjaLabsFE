## Frame — native width/height, x/y
1440 × 1358.9; x=6680, y=2925.7737.

## Shell — header/footer variance vs the standard chrome (logo+nav(Bounties,Hall of Fame,Members,Notices)+Browse/Get Started; footer 3-col + copyright). State IDENTICAL or list diffs.
IDENTICAL: standard translucent 64px header and #0b1322 footer. Footer visibly has logo/description plus Platform and Community columns (not a third link column), then the copyright rule.

## Surface — default vs inverse/dark sections; gradient usage
#fbfbfe default page, white form and aside panels, #fdecec warning badge, #0b1322 inverse footer. No gradients.

## Layout — container max-width, gutters, section paddings, grid columns+gaps
Shell max 1200px/24px gutters; main 64px top, 80px bottom. Signup container is 1024px, 24px vertical gap. Four 250px, 45px-high step cells with 8px gaps. Five-column content grid: 606.4px 3-column form card + 397.6px 2-column aside, 20px gap. Form card 21px padding, 32px card major gap; form has 20px vertical gaps.

## Typography — every distinct text style seen: family, size/line-height, weight, tracking, color (hex as given by Figma)
Space Grotesk Bold brand 20/30 #111a2e/white; regular hero 36/41.4 tracking -.36px #111a2e; aside heading regular 24/27.6 tracking -.24px #111a2e. Inter: uppercase kicker Bold 12/18 tracking .96px #4d3dff; labels Semibold 14/20 #111a2e; input/textarea Regular 14/20 #4f5d77; help/aside Regular 14/20 #77839c; helper Regular 12/16 #4d3dff or #77839c; chips/status Semibold 12/18 (#eeefff selected, #3d2ed9 unselected, #b42323 status); CTA Semibold 16/24 white. Header nav Medium 14/20 #4f5d77; footer as standard (links #b7b2ce, copyright #566180).

## Colors — every distinct color/gradient with hex/rgba values and where used
#fbfbfe page; #fff panels/controls; #0b1322 footer; #4d3dff primary/current step/selected chips/validation; #dfddff completed steps; #3d2ed9 completed step and unselected chip text; #f5f6fb future step; #eeefff unselected chips; #e3e7f1 control/cards border; #111a2e headings/labels; #4f5d77 values; #77839c help; #fdecec/#b42323 badge; #b7b2ce/#566180 footer; rgba(255,255,255,.85/.9/.08), rgba(17,26,46,.06/.05), rgba(33,24,125,.12). No gradients.

## Radii/Borders/Shadows — distinct values
Form and aside: 20px, 1px #e3e7f1, shadow 0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05). Inputs/textarea/CTA/steps: 10px (input 1px #e3e7f1); chips/status: 999px; preview: 10px/#e3e7f1/0 14px 36px rgba(33,24,125,.12).

## Components — instances of Badge / RewardPill / BountyCard / NewsCard / SectionHeader / StepIndicator / MemberCard / other repeats, with variant details (e.g. badge colors per category, pill with INJ icon vs $)
StepIndicator: Login and Wallet+NFT completed #dfddff/#3d2ed9; Profile active #4d3dff/white; Get Started future #f5f6fb/#77839c. Badge “All fields required / no skip.” Profile form: Nickname input, inline availability hint; Field tag chips (selected Dev, Design #4d3dff/#eeefff; unselected Content, Other #eeefff/#3d2ed9); Bio textarea; primary Next. Aside “Why all required” lists spam/quality, funnel, and no-draft guidance. Shared Header/Footer.

## Interactions — links, hover states, inputs, tabs/filters
Nickname is real-time duplicate checked (`jaemin.inj is available`); duplicate produces inline error and blocks Next. Field tags are selectable chips. Nickname, one or more tags, and short Bio are required; no skipping or draft saving. Header/footer links. No hover treatment or tabs shown.

## Responsive inference — how the layout should collapse at 768/390 (grid cols, nav, stacking)
At 768, collapse card/aside grid to form then aside and keep controls fluid. At 390, stack or horizontally scroll/wrap StepIndicator in order, preserve 16px page gutter, use full-width form controls, collapse nav to menu and footer to vertical groups.

## Assets — every image/svg: figma layer name, node id if identifiable, natural size, suggested public/figma/<filename>
Header `Ninja Labs mascot` (19:1278), 28×28, `public/figma/ninja-labs-mascot.svg`; footer mascot (19:1362), 28×28, same asset. No other assets identified.

## Data shape — the typed record this screen implies (fields + example values from the design copy)
`ProfileOnboarding { step: 3; nickname: string; publicHandle: string; nicknameAvailable: boolean; fieldTags: Array<'Dev'|'Design'|'Content'|'Other'>; bio: string; }` — `{ nickname:'jaemin', publicHandle:'jaemin.inj', nicknameAvailable:true, fieldTags:['Dev','Design'], bio:'Frontend builder focused on Injective market data, wallet onboarding, and bounty-ready UI components.' }`.
