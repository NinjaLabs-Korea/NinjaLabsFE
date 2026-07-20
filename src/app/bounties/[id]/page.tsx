import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import { bounties, getBounty } from "@/lib/bounties";

type BountyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return bounties.map(({ slug }) => ({ id: slug }));
}
export async function generateMetadata({ params }: BountyDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const bounty = getBounty(id);

  if (!bounty) {
    return { title: "Not found — Ninja Labs" };
  }

  return {
    title: `${bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title} — Ninja Labs`,
    description: bounty.summary,
  };
}

export default async function BountyDetailPage({ params }: BountyDetailPageProps) {
  const { id } = await params;
  const bounty = getBounty(id);

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
            <p className="mt-4 text-base text-ink-secondary">
              {bounty.applicationRequired && bounty.applicationDescription
                ? bounty.applicationDescription
                : (bounty.descriptionMarkdown ?? bounty.summary)}
            </p>
            {!bounty.applicationRequired ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <MetaCell label="Deliverable">
                  {deliverables.map((deliverable) => <span key={deliverable}>{deliverable}</span>)}
                </MetaCell>
                <MetaCell label="Deadline">{bounty.deadlineDetail ?? bounty.deadline}</MetaCell>
                <MetaCell label="Review">{bounty.reviewProcess ?? ""}</MetaCell>
              </div>
            ) : null}
          </article>

          {bounty.applicationRequired ? <ApplyPanel /> : <DirectSubmitPanel />}
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

function DirectSubmitPanel() {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Submit your work</h2>
      <p className="mt-2 text-sm text-danger">Sign in first</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="h-[46px] min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder"
          disabled
          placeholder="Completed-work URL"
          type="url"
        />
        <button className="h-[46px] rounded-control bg-primary px-5 text-sm font-semibold text-on-inverse opacity-50" disabled type="button">
          Submit
        </button>
      </div>
      <div className="mt-4 rounded-tile border border-dashed border-border-dashed p-4 text-sm text-ink-secondary">
        Agent registration is available for verified agents.
      </div>
    </section>
  );
}

function ApplyPanel() {
  return (
    <>
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Apply for this bounty</h2>
          <span className="rounded-full bg-danger-soft px-3 py-1 font-display text-xs font-bold -tracking-[0.24px] text-danger">LOGIN REQUIRED</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Relevant work link
            <input className="h-[46px] rounded-control border border-border bg-surface px-3 text-sm font-normal text-ink placeholder:text-ink-placeholder" placeholder="Audit report or GitHub profile" type="url" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Availability
            <input className="h-[46px] rounded-control border border-border bg-surface px-3 text-sm font-normal text-ink placeholder:text-ink-placeholder" placeholder="Can deliver by July 20" type="text" />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-ink">
          Application note
          <textarea className="min-h-24 rounded-control border border-border bg-surface px-3 py-3 text-sm font-normal text-ink placeholder:text-ink-placeholder" placeholder="Summarize your audit approach and relevant Injective or CosmWasm experience." />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" type="button">Apply</button>
          <Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties/apply">View intake rules</Link>
          <button aria-disabled="true" className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong opacity-50" disabled type="button">Submit (after approval)</button>
        </div>
      </section>
      <ApplyStatusFlow />
    </>
  );
}

function ApplyStatusFlow() {
  const statuses = ["Open", "Under review", "Approved", "Submitted", "Completed"];

  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Apply-type status</h2>
      <ol className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {statuses.map((status, index) => (
          <li className="flex items-center gap-2" key={status}>
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-primary text-on-inverse" : "bg-surface-subtle text-ink-muted"}`}>{index + 1}</span>
            <span className={`text-sm font-semibold ${index === 0 ? "text-ink" : "text-ink-muted"}`}>{status}</span>
            {index < statuses.length - 1 ? <span aria-hidden="true" className="hidden h-px w-5 bg-primary-outline sm:block" /> : null}
          </li>
        ))}
      </ol>
    </section>
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
      <AgentPanel copy="Register as a verified agent to work with sponsors." />
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
      <AgentPanel copy="Register as a verified agent to apply or submit after wallet-key verification." />
    </aside>
  );
}

function AgentPanel({ copy }: { copy: string }) {
  return (
    <section className="rounded-card border border-dashed border-border-dashed bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">Agent registration</h2>
      <p className="mt-2 text-sm text-ink-secondary">{copy}</p>
      <Link className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/agents/register">Register agent</Link>
    </section>
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
