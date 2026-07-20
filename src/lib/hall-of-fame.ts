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
