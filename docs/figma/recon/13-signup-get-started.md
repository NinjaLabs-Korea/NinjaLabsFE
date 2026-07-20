## Frame — native width/height, x/y
1440 × 1180.55; x=120, y=5372.7734.

## Shell — header/footer variance vs the standard chrome (logo+nav(Bounties,Hall of Fame,Members,Notices)+Browse/Get Started; footer 3-col + copyright). State IDENTICAL or list diffs.
IDENTICAL. Standard 64px translucent, 6px-blurred header with logo/four nav items/Browse/Get Started; #0b1322 footer with logo/description, Platform and Community link columns, and copyright divider. No third link column appears.

## Surface — default vs inverse/dark sections; gradient usage
#fbfbfe default background; white completion panel and option cards; #dfddff icon circles/completed steps; #fdecec status; dark #0b1322 footer. No gradients.

## Layout — container max-width, gutters, section paddings, grid columns+gaps
Shell max 1200px/24px gutter. Main padding 64px top/80px bottom. Signup container is 896px (explicit variance from the 1024px wallet/profile and 768px Google steps), with 24px gaps. StepIndicator: 45px, four 218px cells, 8px gaps. Completion panel 896px wide, 21px horizontal padding, 25.25px top/22.5px bottom. Three option cards form 3 columns, 271.33px each, 20px gaps; cards 21px padding and 230px minimum design height.

## Typography — every distinct text style seen: family, size/line-height, weight, tracking, color (hex as given by Figma)
Space Grotesk Bold: brand 20/30 #111a2e/white; hero regular 36/41.4 tracking -.36px #111a2e; option headings Bold 19.8/28 tracking -.2px #111a2e. Inter: onboarding kicker Bold 12/18 uppercase tracking .96px #4d3dff; step Semibold 14/21 (completed #3d2ed9, active white); subtitle/body Regular 16/24 or 14/20 #77839c; skip Semibold 14/20 #4d3dff; status Semibold 12/18 #b42323. SF Pro Semibold 16/24 tracking -.32px #4d3dff is used for arrow icons. Header/footer styles match standard: nav Medium 14/20 #4f5d77, footer links #b7b2ce, copyright 12/16 #566180.

## Colors — every distinct color/gradient with hex/rgba values and where used
#fbfbfe page; #fff panel/cards; #0b1322 footer; #4d3dff active step/kicker/skip/icon; #dfddff completed steps and icon circles; #3d2ed9 completed step text; #e3e7f1 card borders; #111a2e headings; #77839c supporting text; #fdecec/#b42323 status; #4f5d77 nav; #b7b2ce footer link; #566180 copyright; rgba(255,255,255,.85/.9/.08), rgba(17,26,46,.06/.05), rgba(33,24,125,.12). No gradients.

## Radii/Borders/Shadows — distinct values
Completion and option cards 20px/1px #e3e7f1/shadow 0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05); icon circles and status badge 999px; steps/buttons 10px. Preview outer: 10px/1px #e3e7f1/shadow 0 14px 36px rgba(33,24,125,.12).

## Components — instances of Badge / RewardPill / BountyCard / NewsCard / SectionHeader / StepIndicator / MemberCard / other repeats, with variant details (e.g. badge colors per category, pill with INJ icon vs $)
StepIndicator: Login, Wallet+NFT, Profile complete #dfddff/#3d2ed9; Get Started active #4d3dff/white. Badge “SIGN-UP FLOW.” Completion panel has “ONBOARDING COMPLETE”, prompt, three repeated action cards: Browse active bounties (→ icon), Try Injective in the Playground (↗), Learn more about Ninja Labs (mascot icon), plus Skip and go to main text link. Shared Header/Footer.

## Interactions — links, hover states, inputs, tabs/filters
Each of three action cards is a link; Skip and go to main is a link. Completion sets `onboarding_completed_at`, causing returning users to skip Intro; options are explicitly skippable and revisitable from main navigation. Header/footer links. Hover states, inputs, tabs, filters absent.

## Responsive inference — how the layout should collapse at 768/390 (grid cols, nav, stacking)
At 768, action cards should use 1–2 columns based on available width; StepIndicator remains fluid. At 390, stack all options one per row, make completion panel full-width at 16px gutters, stack/wrap step labels in order, collapse header navigation to menu and footer groups vertically.

## Assets — every image/svg: figma layer name, node id if identifiable, natural size, suggested public/figma/<filename>
Header `Ninja Labs mascot` (19:1392), 28×28, `public/figma/ninja-labs-mascot.svg`; option-card `Ninja Labs` (19:1444), 48×48, `public/figma/ninja-labs-mascot-48.svg`; footer mascot (19:1457), 28×28, `public/figma/ninja-labs-mascot.svg`. Arrow glyphs →/↗ are SF Pro text, not exported SVGs.

## Data shape — the typed record this screen implies (fields + example values from the design copy)
`OnboardingCompletion { step: 4; onboardingCompletedAt: string; actions: Array<{id:'bounties'|'playground'|'about'; title:string; description:string; href:string}>; }` — `onboardingCompletedAt` is set on completion; action titles are “Browse active bounties”, “Try Injective in the Playground”, and “Learn more about Ninja Labs”.
