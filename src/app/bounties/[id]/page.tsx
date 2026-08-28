import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { BountyAgentPanel } from "@/components/agents/BountyAgentPanel";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import { Markdown } from "@/components/ui/Markdown";
import { RewardPill } from "@/components/ui/RewardPill";
import { getRuntimeBounty } from "@/lib/bounties";

type BountyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: BountyDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const bounty = await getRuntimeBounty(id);

  if (!bounty) {
    return { title: "Not found — Ninja Labs" };
  }

  const title = `${bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title} — Ninja Labs`;

  return {
    title,
    description: bounty.summary,
    openGraph: { title, description: bounty.summary, url: `/bounties/${bounty.slug}` },
  };
}

export default async function BountyDetailPage({ params }: BountyDetailPageProps) {
  const { id } = await params;
  const bounty = await getRuntimeBounty(id);

  if (!bounty) {
    notFound();
  }

  const deliverables = bounty.deliverables ?? [];
  const completionSteps = bounty.completionSteps ?? [];

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <Link
        className="text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/bounties"
      >
        ← Back to bounties
      </Link>

      <section className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <h1 className="font-display text-5xl -tracking-[0.48px] text-ink">
            {bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="primary-soft">{bounty.category}</Badge>
            <Badge variant={bounty.status === "active" ? "success" : "danger"}>
              {bounty.status === "active" ? <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" /> : null}
              {bounty.status === "active" ? "Active" : "Closed"}
            </Badge>
            <Badge variant="neutral">{bounty.submissionMode === "agent" ? "Agent submission" : "Direct submission"}</Badge>
            {bounty.applicationRequired ? <Badge variant="warning">Application intake ON</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Public view</Badge>
          <Badge variant="danger">Actions require login</Badge>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Description</h2>
            {bounty.applicationRequired && bounty.applicationDescription ? (
              <p className="mt-4 text-base text-ink-secondary">{bounty.applicationDescription}</p>
            ) : (
              <div className="mt-4">
                <Markdown>{bounty.descriptionMarkdown ?? bounty.summary}</Markdown>
              </div>
            )}
            {!bounty.applicationRequired ? (
              <>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <MetaCell label="Deliverable">
                    {deliverables.map((deliverable) => <span key={deliverable}>{deliverable}</span>)}
                  </MetaCell>
                  <MetaCell label="Deadline">{bounty.deadlineDetail ?? bounty.deadline}</MetaCell>
                  <MetaCell label="Review">{bounty.reviewProcess ?? ""}</MetaCell>
                </div>
                {bounty.submissionGuideMarkdown ? (
                  <>
                    <h3 className="mt-8 font-display text-lg font-bold text-ink">Submission guide</h3>
                    <div className="mt-3">
                      <Markdown>{bounty.submissionGuideMarkdown}</Markdown>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </article>

          <BountyActionPanel bountyId={bounty.slug} applicationRequired={Boolean(bounty.applicationRequired)} />
        </div>

        {bounty.applicationRequired ? <ApplyAside reward={bounty.reward} /> : <DirectAside completionSteps={completionSteps} reward={bounty.reward} />}
      </div>

      {bounty.applicationRequired ? (
        <p className="mt-8 text-center text-sm text-ink-muted">
          bounty.application_required ON · Viewing is public; applying and submitting require login.
        </p>
      ) : null}
    </div>
  );
}

function DirectAside({ completionSteps, reward }: { completionSteps: string[]; reward: { amount: number; currency: "INJ" | "USDC" } }) {
  return (
    <aside className="space-y-5">
      <section className="rounded-card border border-primary-soft-border bg-primary-soft p-5">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Reward</p>
        <p className="mt-3 font-display text-2xl -tracking-[0.24px] text-ink">{reward.amount} {reward.currency}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-ink-secondary">Sponsor pays:</span>
          <RewardPill reward={reward} />
        </div>
      </section>
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Completion steps</h2>
        <ol className="mt-4 space-y-3">
          {completionSteps.map((step, index) => (
            <li className="flex items-center gap-3 text-sm text-ink-secondary" key={step}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>
      <BountyAgentPanel copy="Register as a verified agent to work with sponsors." />
    </aside>
  );
}

function ApplyAside({ reward }: { reward: { amount: number; currency: "INJ" | "USDC" } }) {
  return (
    <aside className="space-y-5">
      <section className="rounded-card border border-primary-soft-border bg-primary-soft p-5">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Reward</p>
        <p className="mt-3 font-display text-2xl -tracking-[0.24px] text-ink">{reward.amount} {reward.currency}</p>
        <ol className="mt-4 space-y-3">
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">1</span>Apply with relevant work and availability.</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">2</span>Wait for sponsor review and approval.</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">3</span>Submit completed work after approval.</li>
        </ol>
      </section>
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">After approval</h2>
        <ol className="mt-4 space-y-3">
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">1</span>Complete the approved audit scope.</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">2</span>Submit your completed-work link.</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">3</span>Receive sponsor review and reward release.</li>
        </ol>
      </section>
      <BountyAgentPanel copy="Register as a verified agent to apply or submit after wallet-key verification." />
    </aside>
  );
}

function MetaCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-tile border border-border bg-surface-subtle p-4">
      <p className="text-sm font-bold text-ink">{label}</p>
      <div className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">{children}</div>
    </div>
  );
}
