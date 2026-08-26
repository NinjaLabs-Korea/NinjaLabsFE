import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getRuntimeProfile, profiles } from "@/lib/members";

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return Object.keys(profiles).map((id) => ({ id }));
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getRuntimeProfile(id);

  if (!profile) {
    return { title: "Not found — Ninja Labs" };
  }

  return {
    title: `${profile.handle} — Ninja Labs`,
    description: profile.bio,
    openGraph: {
      title: `${profile.handle} — Ninja Labs`,
      description: profile.bio,
      url: `/members/${id}`,
    },
  };
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getRuntimeProfile(id);
  if (!profile) notFound();
  const completed = profile.completions.length > 0;

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6 rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-primary-soft-border font-display text-[30px] text-primary">{profile.initials}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-5xl -tracking-[0.48px] text-ink">{profile.handle}</h1>
              {profile.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
              <Badge variant={completed ? "success" : "neutral"}>{completed ? `${profile.completions.length} bounties completed` : "New builder"}</Badge>
            </div>
            <p className="mt-3 max-w-[768px] text-base text-ink-muted">{profile.bio}</p>
            <p className="mt-3 text-sm text-ink-muted">Joined {profile.joinedAt}</p>
          </div>
        </div>
        <Badge variant="success">Public and shareable</Badge>
      </section>

      <section className="mt-14 rounded-panel bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] p-6 text-on-inverse shadow-frame sm:p-10">
        <div className="grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary-outline">Portfolio</p>
            <h2 className="mt-2 font-display text-4xl">{completed ? "Proof of work, on-chain." : "The first proof starts here."}</h2>
            <p className="mt-4 text-base text-on-inverse/70">{completed ? "Every completed bounty mints a collectible record of work." : "Complete a bounty to add a permanent record of work to this portfolio."}</p>
          </div>
          <div className="rounded-card border border-on-inverse/15 bg-on-inverse/10 p-5 backdrop-blur-sm lg:col-span-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft-border font-display text-sm text-primary">N</div>
              <div><p className="font-semibold">Ninja NFT</p><p className="text-sm text-on-inverse/60">{profile.handle}</p></div>
            </div>
            {completed ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {profile.childNfts.map((nft) => <div key={nft.title} className="aspect-square rounded-[14px] bg-[linear-gradient(135deg,var(--color-primary-strong)_0%,var(--color-primary)_55%,var(--color-primary-outline)_100%)] p-3 shadow-nft"><span className="text-sm font-semibold">{nft.title}</span></div>)}
                <div className="flex aspect-square items-center justify-center rounded-[14px] border border-dashed border-on-inverse/30 text-sm text-on-inverse/70">+ next</div>
              </div>
            ) : (
              <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-on-inverse/25 bg-on-inverse/5 p-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-[14px] bg-on-inverse/10 font-display text-xl">N</div>
                <h3 className="mt-4 font-display text-xl font-bold">No bounty NFTs yet</h3>
                <p className="mt-2 max-w-sm text-sm text-on-inverse/70">Complete a bounty to add your first proof.</p>
                <Link className="mt-5 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-outline" href="/bounties">Browse active bounties</Link>
              </div>
            )}
            <p className="mt-4 text-sm text-on-inverse/60">{completed ? `${profile.completions.length} bounties completed` : "0 bounties completed · ready for the first proof"}</p>
          </div>
        </div>
      </section>

      <section className="py-14">
        <SectionHeader eyebrow="Bounty history" heading="Completed bounties" action={!completed ? { label: "View filled profile", href: "/members/jaemin" } : undefined} />
        {completed ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {profile.completions.slice(0, 3).map((completion, index) => {
              const bountySlugs = ["iasset-price-widget", "wallet-onboarding-states", "hydro-liquidity-explainer"];
              return (
                <Link className="rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/bounties/${bountySlugs[index]}`} key={completion.title}>
                  <Badge>{completion.category}</Badge><h3 className="mt-3 font-display text-lg font-bold text-ink">{completion.title}</h3><p className="mt-2 text-sm text-ink-muted">Completed {completion.completedAt}</p><div className="mt-4"><RewardPill reward={completion.reward} /></div>
                </Link>
              );
            })}
          </div>
        ) : <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center"><div className="flex size-14 items-center justify-center rounded-[14px] bg-primary-soft font-display text-xl text-primary">N</div><h3 className="mt-4 font-display text-xl font-bold text-ink">No completed bounties yet</h3><p className="mt-2 text-sm text-ink-muted">Find a bounty and make your first proof.</p><Link className="mt-5 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties">Find a first bounty</Link></div>}
      </section>

      <section id="agents">
        <SectionHeader eyebrow="Automation" heading="Agents" />
        {profile.agents.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{profile.agents.map((agent) => <article key={agent.name} className="rounded-card border border-dashed border-border bg-surface p-5"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold text-ink">{agent.name}</h3>{agent.verified ? <Badge variant="success">Verified</Badge> : null}</div><p className="mt-3 text-sm text-ink-muted">{agent.wallet}</p><p className="mt-2 text-sm text-ink-muted">{agent.completedBounties} bounties completed</p></article>)}</div> : <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-border bg-surface p-5"><div><h3 className="font-display text-xl font-bold text-ink">No registered agents yet</h3><p className="mt-1 text-sm text-ink-muted">Register an agent with signature verification.</p></div><Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">Register agent</Link></div>}
      </section>
    </div>
  );
}
