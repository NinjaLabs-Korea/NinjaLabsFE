import { formatUtcDate, toCategoryLabel, toRewards, type RewardRow } from "./api/codecs";
import type { Bounty } from "./types";
import { fetchAllPublicPages } from "./api/paging";
import { fetchPublicJson, loadFromRuntime } from "./api/public";

export const bounties: Bounty[] = [
  {
    slug: "iasset-price-widget", title: "Build an iAsset price widget", summary: "Create a reusable React component for iAsset market data.", descriptionMarkdown: "Build a reusable price widget for Injective iAssets that product teams can embed without recreating pricing logic. The widget should present current price data clearly and handle loading and unavailable states gracefully.\n\nShip a **production-ready embeddable widget** with a small integration surface: one component, sensible defaults, and clear props. Follow the pricing conventions described in the [Injective docs](https://docs.injective.network) so the widget behaves consistently across products.", submissionGuideMarkdown: "Submit everything reviewers need to run the widget without extra back-and-forth.\n\n- A public GitHub repository with build and test instructions\n- A preview URL demonstrating live, loading, and unavailable states\n- A README covering integration props and setup notes", category: "Dev", status: "active", reward: { amount: 500, currency: "INJ" }, sponsor: "Injective", deadline: "Open", daysLeft: 7, deadlineDetail: "July 14, 2026 at 23:59 UTC", coverImage: "", deliverables: ["GitHub repository", "Preview URL", "README with integration notes"], reviewProcess: "Ninja Labs triage followed by Injective sponsor approval.", submissionMode: "direct",
  },
  {
    slug: "wallet-onboarding-states", title: "Design wallet onboarding states", summary: "Map install, connect, failure, and retry states for new builders.", descriptionMarkdown: "Design a wallet onboarding flow that helps new builders understand each connection state. Account for success, failure, and recovery without making the first connection feel intimidating.\n\nDeliver an **annotated end-to-end flow** with high-fidelity screens and handoff notes that engineers can implement directly, covering every state a new builder can land in.", submissionGuideMarkdown: "Include the full design package so review can start immediately.\n\n- The annotated onboarding flow showing every connection state\n- High-fidelity screens for success, failure, and recovery paths\n- State documentation and handoff notes for engineering", category: "Design", status: "active", reward: { amount: 300, currency: "USDC" }, sponsor: "Helix", deadline: "Open", daysLeft: 5, coverImage: "", deliverables: ["Annotated flow", "High-fidelity screens", "State and handoff notes"], reviewProcess: "Ninja Labs reviews the flow before Helix approves the final handoff.", submissionMode: "direct",
  },
  {
    slug: "contract-security-audit", title: "Smart contract security audit", summary: "Review a CosmWasm reward vault and deliver a concise findings report.", descriptionMarkdown: "Review an Injective smart contract for security issues and document findings with reproducible evidence. Focus on meaningful risks, practical remediation, and a report a sponsor can act on.\n\nProduce an **actionable audit report** that ranks findings by severity, includes reproduction notes for each issue, and gives the sponsor concrete remediation steps.", submissionGuideMarkdown: "Package findings so the sponsor can verify and act on them quickly.\n\n- The audit report with findings ranked by severity\n- Reproduction notes with exact steps and evidence for each finding\n- Remediation recommendations mapped to each issue", category: "Dev", status: "active", reward: { amount: 800, currency: "USDC" }, sponsor: "Ninja Labs", deadline: "Open", daysLeft: 12, coverImage: "", deliverables: ["Audit report", "Reproduction notes", "Remediation recommendations"], reviewProcess: "Ninja Labs validates findings and coordinates sponsor review.", submissionMode: "direct", applicationRequired: true, applicationTitle: "Smart contract audit for reward vault", applicationDescription: "Audit the CosmWasm reward vault before mainnet exposure. Applications are reviewed by the sponsor; approved applicants receive the audit scope and submit findings with reproducible evidence.",
  },
  {
    slug: "injective-dev-tutorial", title: "Write an Injective dev tutorial", summary: "Explain account funding, contract interaction, and testnet verification.", descriptionMarkdown: "Write an educational tutorial that helps Injective developers complete a useful task from start to finish. Use clear steps, accurate examples, and enough context for a new builder to follow along.\n\nDeliver a **published-ready tutorial draft** with working code examples that have been verified against current Injective tooling, so editorial review can focus on clarity instead of correctness.", submissionGuideMarkdown: "Submit the tutorial in a form the editorial team can verify and publish.\n\n- The tutorial draft in published-ready markdown\n- Working code examples verified against current Injective tooling\n- A short note on the developer task covered and any prerequisites", category: "Content", status: "active", reward: { amount: 250, currency: "INJ" }, sponsor: "Injective", deadline: "Open", daysLeft: 9, coverImage: "", deliverables: ["Tutorial draft", "Working code examples", "Published-ready markdown"], reviewProcess: "Ninja Labs checks technical accuracy before Injective editorial approval.", submissionMode: "direct",
  },
  {
    slug: "helix-volume-analytics", title: "Helix volume analytics card", summary: "Build a small dashboard module for spot and perpetual activity.", descriptionMarkdown: "Create a dashboard that makes Helix trading volume easy to explore across useful time periods and markets. Prioritize legible data presentation and interactions that help users inspect changes.\n\nShip a **deployed analytics dashboard** backed by a source repository, with notes that explain the data pipeline, refresh cadence, and setup steps.", submissionGuideMarkdown: "Provide the project in a state reviewers can open and inspect right away.\n\n- The source repository with setup instructions\n- The deployed dashboard URL\n- Data and setup notes describing sources, refresh cadence, and known limits", category: "Dev", status: "active", reward: { amount: 650, currency: "USDC" }, sponsor: "Helix", deadline: "Open", daysLeft: 14, coverImage: "", deliverables: ["Source repository", "Deployed dashboard", "Data and setup notes"], reviewProcess: "Ninja Labs reviews implementation quality with Helix sponsor approval.", submissionMode: "direct",
  },
  {
    slug: "hydro-liquidity-explainer", title: "Hydro liquidity explainer", summary: "Publish a builder-friendly guide to staking, vaults, and incentives.", descriptionMarkdown: "Explain Hydro liquidity concepts in language that Injective community members can use. Connect the core concepts to practical participation and make unfamiliar terms easy to understand.\n\nDeliver **publication-ready explainer copy** with supporting diagrams or worked examples that connect each concept to a concrete way of participating.", submissionGuideMarkdown: "Send the complete explainer package for clarity review.\n\n- The explainer draft covering the core Hydro liquidity concepts\n- Supporting diagrams or worked examples\n- Publication-ready copy with unfamiliar terms defined", category: "Content", status: "active", reward: { amount: 180, currency: "INJ" }, sponsor: "Hydro", deadline: "Open", daysLeft: 10, coverImage: "", deliverables: ["Explainer draft", "Supporting diagrams or examples", "Publication-ready copy"], reviewProcess: "Ninja Labs reviews clarity before Hydro approves publication.", submissionMode: "direct",
  },
  {
    slug: "neptune-api-docs", title: "Neptune API docs structure", summary: "Restructure navigation, examples, and empty states for faster scanning.", descriptionMarkdown: "Write clear, useful documentation for the Neptune API that helps developers make successful requests quickly. Improve navigation, examples, and explanations where implementation details are currently hard to discover.\n\nDeliver **verified documentation updates** with request examples that run against the live API, plus a change summary reviewers can scan in one pass.", submissionGuideMarkdown: "Bundle the documentation changes so verification is straightforward.\n\n- The documentation updates with improved navigation and explanations\n- Verified request examples that run against the Neptune API\n- A change summary listing what moved, changed, or was added", category: "Design", status: "active", reward: { amount: 420, currency: "USDC" }, sponsor: "Neptune", deadline: "Open", daysLeft: 16, coverImage: "", deliverables: ["Documentation updates", "Verified request examples", "Change summary"], reviewProcess: "Ninja Labs verifies examples before Neptune approves the documentation.", submissionMode: "direct",
  },
  {
    slug: "agent-skill-benchmark", title: "Agent skill benchmark suite", summary: "Score agent submissions against a reproducible Injective task set.", descriptionMarkdown: "Build a benchmark suite that scores AI agent submissions against a reproducible set of Injective tasks. Submissions are in and the sponsor is reviewing them; a requested revision can still be resubmitted.\n\nDeliver a **runnable benchmark harness** with task definitions, scoring rules, and a results report.", submissionGuideMarkdown: "Submit the harness in a state reviewers can run end to end.\n\n- The benchmark repository with setup instructions\n- Task definitions and scoring rules\n- A results report for the reference agents", category: "Dev", status: "reviewing", reward: { amount: 400, currency: "INJ" }, sponsor: "Ninja Labs", deadline: "Closed", deadlineDetail: "July 10, 2026 at 23:59 UTC", coverImage: "", deliverables: ["Benchmark repository", "Task definitions and scoring rules", "Results report"], reviewProcess: "Ninja Labs scores the harness before sponsor approval.", submissionMode: "direct",
  },
  {
    slug: "design-system-build", title: "Design system build", summary: "Component inventory and page polish for the first Ninja Labs client demo.", descriptionMarkdown: "Create a consistent design system for an Injective product with reusable foundations and components. The completed work should make future product surfaces easier to build and maintain.\n\nThe finished system paired a **reusable component library** with design foundations and usage guidance so teams could adopt it without guesswork.", category: "Design", status: "closed", reward: { amount: 300, currency: "INJ" }, sponsor: "Helix", deadline: "Closed", coverImage: "", deliverables: ["Design foundations", "Component library", "Usage guidance"], reviewProcess: "Ninja Labs reviewed the system and approved the completed delivery.", submissionMode: "direct",
  },
  {
    slug: "quest-copy-refresh", title: "Quest copy refresh", summary: "Rewrite onboarding quests to make first testnet actions easier to finish.", descriptionMarkdown: "Refresh onboarding quest copy so builders understand each step and its value. Keep the voice direct, useful, and consistent across the quest experience.\n\nThe refresh delivered **updated quest copy** alongside voice and terminology notes so future edits stay consistent with the builder-facing tone.", category: "Content", status: "closed", reward: { amount: 150, currency: "USDC" }, sponsor: "Ninja Labs", deadline: "Closed", coverImage: "", deliverables: ["Updated quest copy", "Voice and terminology notes", "Change summary"], reviewProcess: "Ninja Labs and Injective approved the completed copy refresh.", submissionMode: "direct",
  },
];

export function getBounties(): Bounty[] { return bounties; }
export function getBounty(slug: string): Bounty | undefined { return bounties.find((bounty) => bounty.slug === slug); }
export function getActiveBounties(): Bounty[] { return bounties.filter((bounty) => bounty.status === "active"); }

type BountyRewardRow = RewardRow & { tokenType: string };
type BountyListRow = {
  id: string;
  title: string;
  summary: string;
  sponsor_name: string;
  category: string;
  status: string;
  application_required: boolean;
  submission_mode: "DIRECT" | "AGENT";
  cover_image_url: string | null;
  application_deadline: string | null;
  submission_deadline: string;
  rewards: BountyRewardRow[];
};
type BountyDetailRow = BountyListRow & {
  description: string;
  requirements: string;
  evaluation_criteria: string;
};
// "Closed" is a data sentinel (see mock records); components render a localized label for it. Open bounties expose the
// countdown as a number so the card can localize it (`bounties.card.daysLeft`) instead of a hardcoded "D-7".
// An unparseable deadline counts as passed (NaN → 0): the bounty presents as closed rather than "Active" forever.
function daysUntil(value: string): number {
  const remaining = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  return Number.isNaN(remaining) ? 0 : remaining;
}

/** BE lifecycle → public status. DRAFT/FUNDING_PENDING never reach the public list, so anything else that is not open or under review is closed. */
export function toBountyStatus(status: string): Bounty["status"] {
  if (status === "OPEN") return "active";
  if (status === "SUBMISSION_CLOSED" || status === "IN_REVIEW") return "reviewing";
  return "closed";
}

/**
 * Public status including the deadline: a BE `OPEN` bounty whose `submission_deadline` has passed (or cannot be parsed)
 * no longer accepts applications or submissions (BE answers DEADLINE_PASSED), so it presents as `closed` - status badge,
 * list chip and action panel alike - instead of "Active" with no countdown.
 */
export function toPublicBountyStatus(status: string, submissionDeadline: string, now = Date.now()): Bounty["status"] {
  if (status !== "OPEN") return toBountyStatus(status);
  const deadline = new Date(submissionDeadline).getTime();
  return Number.isNaN(deadline) || deadline <= now ? "closed" : "active";
}

const DEADLINE_DETAIL_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
};

const markdownListItem = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

/** Deliverables are the list items of the requirements markdown, with inline formatting stripped. */
export function deliverablesFromMarkdown(markdown: string | undefined): string[] {
  if (!markdown) return [];
  return markdown.split("\n").flatMap((line) => {
    const item = markdownListItem.exec(line)?.[1];
    if (!item) return [];
    const text = item
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    return text ? [text] : [];
  });
}

function toBounty(row: BountyListRow | BountyDetailRow, locale: string): Bounty {
  const rewards = toRewards(row.rewards);
  const detail = "description" in row ? row : null;
  const submissionMode = row.submission_mode === "AGENT" ? "agent" : "direct";
  const status = toPublicBountyStatus(row.status, row.submission_deadline);
  const daysLeft = status === "active" ? daysUntil(row.submission_deadline) : 0;
  return {
    slug: row.id,
    title: row.title,
    summary: row.summary,
    category: toCategoryLabel(row.category) ?? "Other",
    status,
    reward: rewards[0] ?? { amount: 0, currency: "INJ" },
    ...(rewards.length > 1 ? { rewards } : {}),
    sponsor: row.sponsor_name,
    deadline: daysLeft > 0 ? "Open" : "Closed",
    ...(daysLeft > 0 ? { daysLeft } : {}),
    // UTC-pinned like every other displayed date; "" when the BE value cannot be parsed (the detail page then shows the status label).
    deadlineDetail: formatUtcDate(row.submission_deadline, locale, DEADLINE_DETAIL_FORMAT),
    coverImage: row.cover_image_url ?? "",
    descriptionMarkdown: detail?.description ?? row.summary,
    submissionGuideMarkdown: detail?.requirements,
    deliverables: deliverablesFromMarkdown(detail?.requirements),
    // Missing review process / completion steps fall back to localized defaults in the detail page.
    reviewProcess: detail?.evaluation_criteria,
    submissionMode,
    applicationRequired: row.application_required,
    applicationTitle: row.application_required ? row.title : undefined,
    applicationDescription: row.application_required ? row.summary : undefined,
  };
}

// Filtering is client-side, so the list loads every BE page (see lib/api/paging.ts).
async function fetchAllBounties(locale: string): Promise<Bounty[]> {
  const rows = await fetchAllPublicPages<BountyListRow>("/bounties");
  return rows.map((row) => toBounty(row, locale));
}

/**
 * `locale` formats API dates for display and comes from the server page (`params.locale`); this module never
 * imports `next-intl/server` because it is also bundled into the client through `lib/mocks/api-client`.
 */
export function getRuntimeBounties(locale: string): Promise<Bounty[]> {
  return loadFromRuntime({ mock: getBounties, api: () => fetchAllBounties(locale) });
}

/** Page-level loader: an unreachable API renders an unavailable state instead of the error boundary. */
export async function loadRuntimeBounties(locale: string): Promise<{ bounties: Bounty[]; unavailable: boolean }> {
  try {
    return { bounties: await getRuntimeBounties(locale), unavailable: false };
  } catch {
    return { bounties: [], unavailable: true };
  }
}

export function getRuntimeBounty(id: string, locale: string): Promise<Bounty | undefined> {
  return loadFromRuntime({
    mock: () => getBounty(id),
    api: async () => {
      try {
        return toBounty(await fetchPublicJson<BountyDetailRow>(`/bounties/${encodeURIComponent(id)}`), locale);
      } catch {
        return undefined;
      }
    },
  });
}
