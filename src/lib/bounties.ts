import type { Bounty } from "./types";
import { fetchPublicJson } from "./api/public";
import { loadRuntimeConfig } from "./runtime/config";

export const bounties: Bounty[] = [
  {
    slug: "iasset-price-widget", title: "Build an iAsset price widget", summary: "Build a reusable price widget for Injective iAssets.", descriptionMarkdown: "Build a reusable price widget for Injective iAssets that product teams can embed without recreating pricing logic. The widget should present current price data clearly and handle loading and unavailable states gracefully.\n\nShip a **production-ready embeddable widget** with a small integration surface: one component, sensible defaults, and clear props. Follow the pricing conventions described in the [Injective docs](https://docs.injective.network) so the widget behaves consistently across products.", submissionGuideMarkdown: "Submit everything reviewers need to run the widget without extra back-and-forth.\n\n- A public GitHub repository with build and test instructions\n- A preview URL demonstrating live, loading, and unavailable states\n- A README covering integration props and setup notes", category: "Dev", status: "active", reward: { amount: 500, currency: "INJ" }, sponsor: "Injective", deadline: "D-7", deadlineDetail: "July 14, 2026 at 23:59 UTC", coverImage: "", deliverables: ["GitHub repository", "Preview URL", "README with integration notes"], reviewProcess: "Ninja Labs triage followed by Injective sponsor approval.", submissionMode: "direct", completionSteps: ["Build and test the widget", "Submit the repository and preview URL", "Receive sponsor approval"],
  },
  {
    slug: "wallet-onboarding-states", title: "Design a wallet onboarding flow", summary: "Create a clear wallet onboarding experience for new builders.", descriptionMarkdown: "Design a wallet onboarding flow that helps new builders understand each connection state. Account for success, failure, and recovery without making the first connection feel intimidating.\n\nDeliver an **annotated end-to-end flow** with high-fidelity screens and handoff notes that engineers can implement directly, covering every state a new builder can land in.", submissionGuideMarkdown: "Include the full design package so review can start immediately.\n\n- The annotated onboarding flow showing every connection state\n- High-fidelity screens for success, failure, and recovery paths\n- State documentation and handoff notes for engineering", category: "Design", status: "active", reward: { amount: 300, currency: "USDC" }, sponsor: "Helix", deadline: "D-5", coverImage: "", deliverables: ["Annotated flow", "High-fidelity screens", "State and handoff notes"], reviewProcess: "Ninja Labs reviews the flow before Helix approves the final handoff.", submissionMode: "direct", completionSteps: ["Map onboarding states", "Prepare screens and annotations", "Submit the design handoff"],
  },
  {
    slug: "contract-security-audit", title: "Smart contract security audit", summary: "Review an Injective smart contract for security issues.", descriptionMarkdown: "Review an Injective smart contract for security issues and document findings with reproducible evidence. Focus on meaningful risks, practical remediation, and a report a sponsor can act on.\n\nProduce an **actionable audit report** that ranks findings by severity, includes reproduction notes for each issue, and gives the sponsor concrete remediation steps.", submissionGuideMarkdown: "Package findings so the sponsor can verify and act on them quickly.\n\n- The audit report with findings ranked by severity\n- Reproduction notes with exact steps and evidence for each finding\n- Remediation recommendations mapped to each issue", category: "Dev", status: "active", reward: { amount: 800, currency: "USDC" }, sponsor: "Ninja Labs", deadline: "D-12", coverImage: "", deliverables: ["Audit report", "Reproduction notes", "Remediation recommendations"], reviewProcess: "Ninja Labs validates findings and coordinates sponsor review.", submissionMode: "direct", completionSteps: ["Review the contract scope", "Document verified findings", "Submit the audit report"], applicationRequired: true, applicationTitle: "Smart contract audit for reward vault", applicationDescription: "Audit the CosmWasm reward vault before mainnet exposure. Applications are reviewed by the sponsor; approved applicants receive the audit scope and submit findings with reproducible evidence.",
  },
  {
    slug: "injective-dev-tutorial", title: "Write an Injective dev tutorial", summary: "Write an educational tutorial for the Injective developer community.", descriptionMarkdown: "Write an educational tutorial that helps Injective developers complete a useful task from start to finish. Use clear steps, accurate examples, and enough context for a new builder to follow along.\n\nDeliver a **published-ready tutorial draft** with working code examples that have been verified against current Injective tooling, so editorial review can focus on clarity instead of correctness.", submissionGuideMarkdown: "Submit the tutorial in a form the editorial team can verify and publish.\n\n- The tutorial draft in published-ready markdown\n- Working code examples verified against current Injective tooling\n- A short note on the developer task covered and any prerequisites", category: "Content", status: "active", reward: { amount: 250, currency: "INJ" }, sponsor: "Injective", deadline: "D-9", coverImage: "", deliverables: ["Tutorial draft", "Working code examples", "Published-ready markdown"], reviewProcess: "Ninja Labs checks technical accuracy before Injective editorial approval.", submissionMode: "direct", completionSteps: ["Choose the developer task", "Write and verify the tutorial", "Submit the draft and examples"],
  },
  {
    slug: "helix-volume-analytics", title: "Build a Helix volume analytics dashboard", summary: "Create a dashboard that makes Helix trading volume easy to explore.", descriptionMarkdown: "Create a dashboard that makes Helix trading volume easy to explore across useful time periods and markets. Prioritize legible data presentation and interactions that help users inspect changes.\n\nShip a **deployed analytics dashboard** backed by a source repository, with notes that explain the data pipeline, refresh cadence, and setup steps.", submissionGuideMarkdown: "Provide the project in a state reviewers can open and inspect right away.\n\n- The source repository with setup instructions\n- The deployed dashboard URL\n- Data and setup notes describing sources, refresh cadence, and known limits", category: "Dev", status: "active", reward: { amount: 600, currency: "USDC" }, sponsor: "Helix", deadline: "D-14", coverImage: "", deliverables: ["Source repository", "Deployed dashboard", "Data and setup notes"], reviewProcess: "Ninja Labs reviews implementation quality with Helix sponsor approval.", submissionMode: "direct", completionSteps: ["Build the dashboard", "Deploy and document the data", "Submit the project URL"],
  },
  {
    slug: "hydro-liquidity-explainer", title: "Create a Hydro liquidity explainer", summary: "Explain Hydro liquidity concepts for the Injective community.", descriptionMarkdown: "Explain Hydro liquidity concepts in language that Injective community members can use. Connect the core concepts to practical participation and make unfamiliar terms easy to understand.\n\nDeliver **publication-ready explainer copy** with supporting diagrams or worked examples that connect each concept to a concrete way of participating.", submissionGuideMarkdown: "Send the complete explainer package for clarity review.\n\n- The explainer draft covering the core Hydro liquidity concepts\n- Supporting diagrams or worked examples\n- Publication-ready copy with unfamiliar terms defined", category: "Content", status: "active", reward: { amount: 180, currency: "INJ" }, sponsor: "Hydro", deadline: "D-10", coverImage: "", deliverables: ["Explainer draft", "Supporting diagrams or examples", "Publication-ready copy"], reviewProcess: "Ninja Labs reviews clarity before Hydro approves publication.", submissionMode: "direct", completionSteps: ["Outline the concepts", "Create examples and supporting material", "Submit the final explainer"],
  },
  {
    slug: "neptune-api-docs", title: "Improve Neptune API documentation", summary: "Write clear, useful documentation for the Neptune API.", descriptionMarkdown: "Write clear, useful documentation for the Neptune API that helps developers make successful requests quickly. Improve navigation, examples, and explanations where implementation details are currently hard to discover.\n\nDeliver **verified documentation updates** with request examples that run against the live API, plus a change summary reviewers can scan in one pass.", submissionGuideMarkdown: "Bundle the documentation changes so verification is straightforward.\n\n- The documentation updates with improved navigation and explanations\n- Verified request examples that run against the Neptune API\n- A change summary listing what moved, changed, or was added", category: "Content", status: "active", reward: { amount: 400, currency: "USDC" }, sponsor: "Neptune", deadline: "D-16", coverImage: "", deliverables: ["Documentation updates", "Verified request examples", "Change summary"], reviewProcess: "Ninja Labs verifies examples before Neptune approves the documentation.", submissionMode: "direct", completionSteps: ["Review the API documentation", "Write and verify updates", "Submit the change summary"],
  },
  {
    slug: "design-system-build", title: "Build a design system", summary: "Create a consistent design system for an Injective product.", descriptionMarkdown: "Create a consistent design system for an Injective product with reusable foundations and components. The completed work should make future product surfaces easier to build and maintain.\n\nThe finished system paired a **reusable component library** with design foundations and usage guidance so teams could adopt it without guesswork.", category: "Design", status: "closed", reward: { amount: 300, currency: "USDC" }, sponsor: "Ninja Labs", deadline: "Closed", coverImage: "", deliverables: ["Design foundations", "Component library", "Usage guidance"], reviewProcess: "Ninja Labs reviewed the system and approved the completed delivery.", submissionMode: "direct", completionSteps: ["Define foundations", "Build reusable components", "Complete sponsor review"],
  },
  {
    slug: "quest-copy-refresh", title: "Refresh quest copy", summary: "Refresh onboarding quest copy for a clearer builder experience.", descriptionMarkdown: "Refresh onboarding quest copy so builders understand each step and its value. Keep the voice direct, useful, and consistent across the quest experience.\n\nThe refresh delivered **updated quest copy** alongside voice and terminology notes so future edits stay consistent with the builder-facing tone.", category: "Content", status: "closed", reward: { amount: 120, currency: "INJ" }, sponsor: "Injective", deadline: "Closed", coverImage: "", deliverables: ["Updated quest copy", "Voice and terminology notes", "Change summary"], reviewProcess: "Ninja Labs and Injective approved the completed copy refresh.", submissionMode: "direct", completionSteps: ["Review the current journey", "Write the refreshed copy", "Complete editorial review"],
  },
];

export function getBounties(): Bounty[] { return bounties; }
export function getBounty(slug: string): Bounty | undefined { return bounties.find((bounty) => bounty.slug === slug); }
export function getActiveBounties(): Bounty[] { return bounties.filter((bounty) => bounty.status === "active"); }

type BountyRewardRow = { symbol: string; amount: string; tokenType: string };
type BountyListRow = {
  id: string;
  title: string;
  summary: string;
  sponsor_name: string;
  category: string;
  status: string;
  application_required: boolean;
  application_deadline: string | null;
  submission_deadline: string;
  rewards: BountyRewardRow[];
};
type BountyDetailRow = BountyListRow & {
  description: string;
  requirements: string;
  evaluation_criteria: string;
};
type BountyListResponse = { items: BountyListRow[] };

const categoryLabels = { DEV: "Dev", DESIGN: "Design", CONTENT: "Content", OTHER: "Other" } as const;

function dateLabel(value: string): string {
  const deadline = new Date(value);
  const days = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
  return days > 0 ? `D-${days}` : "Closed";
}

function toBounty(row: BountyListRow | BountyDetailRow): Bounty {
  const reward = row.rewards[0];
  const detail = "description" in row ? row : null;
  return {
    slug: row.id,
    title: row.title,
    summary: row.summary,
    category: categoryLabels[row.category as keyof typeof categoryLabels] ?? "Other",
    status: row.status === "OPEN" ? "active" : "closed",
    reward: {
      amount: reward ? Number(reward.amount) / 10 ** (reward.symbol === "USDC" ? 6 : 18) : 0,
      currency: reward?.symbol === "USDC" ? "USDC" : "INJ",
    },
    sponsor: row.sponsor_name,
    deadline: row.status === "OPEN" ? dateLabel(row.submission_deadline) : "Closed",
    deadlineDetail: new Date(row.submission_deadline).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" }),
    coverImage: "",
    descriptionMarkdown: detail?.description ?? row.summary,
    submissionGuideMarkdown: detail?.requirements,
    deliverables: detail?.requirements ? detail.requirements.split("\n").filter(Boolean) : [],
    reviewProcess: detail?.evaluation_criteria ?? "Sponsor review",
    submissionMode: "direct",
    completionSteps: ["Complete the work", "Submit the result URL", "Receive sponsor approval"],
    applicationRequired: row.application_required,
    applicationTitle: row.application_required ? row.title : undefined,
    applicationDescription: row.application_required ? row.summary : undefined,
  };
}

export async function getRuntimeBounties(): Promise<Bounty[]> {
  if (loadRuntimeConfig().runtimeMode === "mock") return getBounties();
  const response = await fetchPublicJson<BountyListResponse>("/bounties?page=1&pageSize=50");
  return response.items.map(toBounty);
}

export async function getRuntimeBounty(id: string): Promise<Bounty | undefined> {
  if (loadRuntimeConfig().runtimeMode === "mock") return getBounty(id);
  try {
    return toBounty(await fetchPublicJson<BountyDetailRow>(`/bounties/${encodeURIComponent(id)}`));
  } catch {
    return undefined;
  }
}
