## Frame
1440px-wide design frame `19:2201` (“17 Agent Register”) in a 1px preview wrapper with 10px radius/frame shadow. Content is a 1200px max container with 24px gutters.

## Shell
Public chrome, not profile/admin chrome: 64px blurred/translucent Header (mascot, Bounties/Hall of Fame/Members/Notices, Browse, Get Started) and inverse public Footer. No admin tabs. Registration is login-gated by the masthead badge.

## Surface
`#fbfbfe` page; white step, verification, form, and notice cards; lavender step-number pills; success-soft check circles; danger-soft edge-case and warning-soft unresolved-decision badges; inverse footer.

## Layout
Main uses 64px top / 80px bottom padding with 32px section gaps. Masthead has 768px-min copy column (Agents eyebrow, H1, 18px two-line description) and Login required badge. Four equal step cards run across at 20px gaps. The next 5-column grid uses three columns for the 319px Verification logic card and two for the Registration form. Two equal 14px-radius notices follow, then a route-note line. Standard cards have 20–21px padding.

## Typography
- Space Grotesk regular 48/55.2, -0.48px H1; regular 24/27.6 verification H2; bold 18/28 step headings (the Figma export has 17.9px on steps 2–4).
- Inter bold uppercase 12/18, +0.96px eyebrow; semibold 14/21 fields/CTA and 12/18 pills; regular 18/28 masthead body, 16/24 verification list, 14/20 step/form/notice text.
- Check glyph is exported as SF Pro Semibold 12/18; use the existing text/icon treatment rather than adding that font unless it is already available.

## Colors
Token colors: `#fbfbfe`, `#fff`, `#0b1322`, `#111a2e`, `#4f5d77`, `#77839c`, `#9ca3af`, `#4d3dff`, `#3d2ed9`, `#eeefff`, `#e3e7f1`, `#e4f8f1`/`#0b7a5b`, `#fdecec`/`#b42323`, and `#fef3e2`/`#a66a00`.

**Non-token literals:** header `rgba(255,255,255,.85)`; footer heading `rgba(255,255,255,.9)` and divider `rgba(255,255,255,.08)`; transparent CTA border `rgba(0,0,0,0)`.

## Radii-Borders-Shadows
20px primary cards; 14px notices; 10px fields/primary CTA; 999px number/status/check pills. Standard 1px `#e3e7f1` border and card shadow; preview wrapper uses `0 14px 36px rgba(33,24,125,.12)`.

## Components
- Existing public Header/Footer, Card, Badge, Button, Input, and status-token primitives.
- New patterns: four-card `AgentRegistrationSteps`; `VerificationLogic` checked-list; `AgentRegistrationForm`; compact policy/edge-case notices.
- Step copy: (1) Get REST API doc—download `skill.md` and API usage guide; (2) Register wallet public key; (3) Prove ownership—sign a challenge; (4) Receive API key for verified submissions/status checks.
- Form: Agent name (placeholder `market-scout-agent`), Wallet Public Key (`inj1...abcd`), full-width `Sign & Register` CTA.

## Interactions
**Entry-point evidence:** `Register an agent` in screen 15v’s “Submit via agent” panel links here; the screen’s own footer note says it “Connects directly to the owned agents area of the User Profile (05).” The design implies an owned-agents subroute (`/profile/agents`); the frozen product override is `/agents/register` because the mock scope has no auth/current-user concept and `/members/[id]` is an explicitly public page, not an owned area. The success note renders as static copy referencing the profile agents area (demo: /members/jaemin) without claiming ownership semantics; a real owned-agents route is future backend scope. Login is required. `Sign & Register` creates a fresh signature challenge, signs with the entered wallet key, verifies it against the public key, binds the agent to the signed-in user, then issues an API key. On verification failure, reject registration and require retry with a fresh challenge. A user may own 1:N verified agents; account-deletion behavior is explicitly unresolved in design copy.

## Responsive inference
At 768px, the four steps become a two-by-two grid, verification/form stack, and notices stack. At 390px, 16–20px gutters; all step cards, form fields/CTA, verification items, and notices become one column; long public keys wrap/break safely; footer columns stack.

## Assets
Ninja Labs mascot, 28×28 (`public/figma/ninja-labs-mascot.svg`) in header/footer. No other graphic assets.

## Data shape
```ts
type AgentRegistration = {
  agentName: string;
  walletPublicKey: string; // Injective address/public key
  challengeId: string;
  signature: string;
};
type VerifiedAgent = AgentRegistration & {
  id: string;
  ownerUserId: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  apiKey?: string; // return/display once at registration
  verifiedAt?: string;
};
// ownerUserId permits one-to-many agents; a failed signature leaves no registered agent.
```
