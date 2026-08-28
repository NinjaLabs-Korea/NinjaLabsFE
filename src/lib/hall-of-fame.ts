import { fetchPublicJson } from "@/lib/api/public";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export const hallOfFame = {
  stats: [
    { value: "128", label: "Bounties run" },
    { value: "412", label: "Builders onboarded" },
    { value: "$—", label: "Rewards paid" },
  ],
  highlights: [
    { category: "Milestone", title: "100th builder onboarded", body: "A growing group of builders is collecting proof of work on Injective." },
    { category: "Featured bounty", title: "Build an iAsset price widget", body: "A reusable price widget for Injective iAssets became a builder favorite." },
    { category: "Partnership", title: "Ninja Labs KR community partner wall", body: "Community partners are helping more builders find their next contribution." },
  ],
  milestones: [
    { title: "Ninja Labs launches", date: "April 8, 2026", description: "The first bounties opened for the Injective builder community." },
    { title: "100th builder onboarded", date: "May 3, 2026", description: "A hundred builders joined to complete work and collect proof." },
    { title: "First community partnership", date: "June 20, 2026", description: "Ninja Labs KR joined the growing community partner network." },
  ],
} as const;

type HighlightRow = {
  id: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  published_at: string | null;
};
type StatsRow = { completedBounties: number; builders: number; completionNfts: number; sponsors: number };

export type RuntimeHallOfFame = {
  stats: Array<{ value: string; label: string }>;
  highlights: Array<{ category: "Milestone" | "Featured bounty" | "Partnership"; title: string; body: string; href: string }>;
  milestones: Array<{ title: string; date: string; description: string }>;
};

export async function getRuntimeHallOfFame(): Promise<RuntimeHallOfFame> {
  if (loadRuntimeConfig().runtimeMode === "mock") {
    return {
      stats: [...hallOfFame.stats],
      highlights: hallOfFame.highlights.map((item) => ({ ...item, href: "/notices" })),
      milestones: [...hallOfFame.milestones],
    };
  }
  const [rows, stats] = await Promise.all([
    fetchPublicJson<HighlightRow[]>("/hall-of-fame"),
    fetchPublicJson<StatsRow>("/hall-of-fame/stats"),
  ]);
  const category = (type: string): "Milestone" | "Featured bounty" | "Partnership" =>
    type === "MILESTONE" ? "Milestone" : type === "PARTNERSHIP" ? "Partnership" : "Featured bounty";
  return {
    stats: [
      { value: String(stats.completedBounties), label: "Bounties completed" },
      { value: String(stats.builders), label: "Builders rewarded" },
      { value: String(stats.completionNfts), label: "Completion NFTs" },
    ],
    highlights: rows.map((row) => ({
      category: category(row.type),
      title: row.title,
      body: row.description,
      href: row.link_url ?? "/notices",
    })),
    milestones: rows.filter((row) => row.type === "MILESTONE").map((row) => ({
      title: row.title,
      date: row.published_at ? new Date(row.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
      description: row.description,
    })),
  };
}
