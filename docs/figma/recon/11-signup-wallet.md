## Frame — native width/height, x/y
1440 × 1174.59; x=5040, y=2925.7737.

## Shell — header/footer variance vs the standard chrome (logo+nav(Bounties,Hall of Fame,Members,Notices)+Browse/Get Started; footer 3-col + copyright). State IDENTICAL or list diffs.
IDENTICAL: 64px translucent/blurred header with logo, four nav links, Browse and Get Started; #0b1322 footer has logo/description, Platform and Community columns, divider/copyright. No third footer link column is shown.

## Surface — default vs inverse/dark sections; gradient usage
#fbfbfe default, white primary and aside cards, #eeefff NFT callout, #fdecec status badge, dark #0b1322 footer. No gradients.

## Layout — container max-width, gutters, section paddings, grid columns+gaps
1200px shell max with 24px gutters. Main 64px top/80px bottom; status then 32px separation. Signup container 1024px (explicit variance from Google’s 768px), 24px step/card gap. StepIndicator 45px, four 250px tracks / 8px gaps. Content is a 5-column grid with 20px gap: form spans 3 (606.4px) and aside spans 2 (397.6px); card padding 21px.

## Typography — every distinct text style seen: family, size/line-height, weight, tracking, color (hex as given by Figma)
Space Grotesk: brand Bold 20/30 #111a2e/white; hero regular 36/41.4 tracking -.36px #111a2e; aside heading regular 24/27.6 tracking -.24px #111a2e. Inter: uppercase kicker Bold 12/18 tracking .96px #4d3dff; buttons Semibold 16/24 white and secondary 14/21 #3d2ed9; step Semibold 14/21; body Regular 16/24 #77839c and 14/20 (#77839c, #263450); aside terms Semibold 14/20 #111a2e; status Semibold 12/18 #b42323. Header/footer styles: nav Medium 14/20 #4f5d77, footer links Regular 14/20 #b7b2ce, copyright Regular 12/16 #566180.

## Colors — every distinct color/gradient with hex/rgba values and where used
#fbfbfe page; #fff cards; #0b1322 footer; #4d3dff primary/current step; #dfddff completed step; #3d2ed9 completed text/secondary CTA; #f5f6fb future step; #eeefff NFT notice; #e3e7f1 borders; #111a2e headings; #263450 notice text; #77839c secondary; #fdecec/#b42323 status; #4f5d77 nav; #b7b2ce footer links; #566180 copyright; rgba(255,255,255,.85/.9/.08), rgba(17,26,46,.06/.05), rgba(33,24,125,.12). No gradients.

## Radii/Borders/Shadows — distinct values
Card/aside 20px, 1px #e3e7f1, shadow 0 1px 2px rgba(17,26,46,.06), 0 1px 3px rgba(17,26,46,.05); CTA/steps 10px (primary transparent border; secondary 1px #c3beff); NFT notice 14px/1px #e3e7f1; status 999px. Preview: 10px/1px #e3e7f1, 0 14px 36px rgba(33,24,125,.12).

## Components — instances of Badge / RewardPill / BountyCard / NewsCard / SectionHeader / StepIndicator / MemberCard / other repeats, with variant details (e.g. badge colors per category, pill with INJ icon vs $)
StepIndicator: completed Login #dfddff/#3d2ed9, active Wallet+NFT #4d3dff/white, Profile/Get Started future #f5f6fb/#77839c. Badge “NFT minted at sign-up.” Wallet card has primary Connect Wallet, NFT-success notice, secondary Connect later, and failure reassurance. Aside “NFT minting (confirmed)” has five definition rows: Recipient, Standard, Minter, Cost and limit, Failure path. Shared Header/Footer.

## Interactions — links, hover states, inputs, tabs/filters
Connect Wallet invokes Injective wallet (inj1…) then immediately mints Ninja NFT; Connect later proceeds without wallet; mint failure does not block signup and can retry from account. Header/footer links present. No hover state, inputs, tabs, or filters shown.

## Responsive inference — how the layout should collapse at 768/390 (grid cols, nav, stacking)
At 768, change 3+2 grid to one column: wallet card then aside; retain fluid four-step strip if labels fit. At 390 stack steps in order, full-width cards with 16px gutters, nav into menu, footer groups vertical.

## Assets — every image/svg: figma layer name, node id if identifiable, natural size, suggested public/figma/<filename>
Header `Ninja Labs mascot` (19:1166), 28×28, `public/figma/ninja-labs-mascot.svg`; footer same layer (19:1248), 28×28, same path. No other images/SVGs identified.

## Data shape — the typed record this screen implies (fields + example values from the design copy)
`WalletOnboarding { step: 2; walletAddress?: string; walletStatus: 'unconnected'|'connected'|'failed'|'deferred'; nftMintStatus: 'pending'|'minted'|'failed'; nftStandard: 'CW-721 Nestable'; minter: 'AWS KMS platform master wallet'; }` — address prefix `inj1…`, one user/one wallet/one Ninja NFT, platform-paid ~$0.0003 gas.
