import type { Metadata } from "next";
import Link from "next/link";

import {
  BountyApplyAuthBadge,
  BountyApplyGuideCta,
} from "@/components/bounties/BountyApplyGuideCta";
import { Badge } from "@/components/ui/Badge";
import { loadRuntimeBounties } from "@/lib/bounties";

const statuses = ["Open", "Under review", "Approved", "Submitted", "Completed"];

export const metadata: Metadata = {
  title: "How applying works — Ninja Labs",
  description: "Some bounties accept work directly. Others require sponsor approval before you can submit.",
};

export default async function BountyApplyPage() {
  const { bounties, unavailable } = await loadRuntimeBounties();
  const applicationBounty = bounties.find(
    (bounty) => bounty.status === "active" && bounty.applicationRequired,
  );
  const directBounty = bounties.find(
    (bounty) => bounty.status === "active" && !bounty.applicationRequired,
  );
  const hasOpenBounty = Boolean(applicationBounty || directBounty);

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="max-w-[62rem]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">BOUNTIES</p>
          <h1 className="mt-3 font-display text-5xl -tracking-[0.48px] text-ink">How bounty applications work</h1>
          <p className="mt-4 max-w-[48rem] text-lg text-ink-secondary">
            Some bounties accept work directly. Others require sponsor approval before you can submit.
          </p>
        </div>
        <BountyApplyAuthBadge />
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="flex min-h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card">
          <Badge variant="success">Direct submit</Badge>
          <h2 className="mt-4 font-display text-2xl font-bold -tracking-[0.24px] text-ink">Submit-type bounty</h2>
          <p className="mt-3 text-base text-ink-secondary">Anyone can work on the bounty and submit when the work is ready.</p>
          <div className="mt-5 rounded-tile bg-primary-soft p-4 text-sm text-ink-secondary">
            The submission form is available on the bounty page right away.
          </div>
          {directBounty ? (
            <Link
              className="mt-5 inline-flex w-fit rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={`/bounties/${directBounty.slug}`}
            >
              View direct bounty
            </Link>
          ) : hasOpenBounty ? (
            <p className="mt-5 text-sm text-ink-muted">No submit-type bounties are open right now.</p>
          ) : null}
        </article>

        <article className="flex min-h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card">
          <Badge variant="warning">Application required</Badge>
          <h2 className="mt-4 font-display text-2xl font-bold -tracking-[0.24px] text-ink">Apply-type bounty</h2>
          <p className="mt-3 text-base text-ink-secondary">Submit work after the sponsor approves your application.</p>
          <div className="mt-5 rounded-tile bg-primary-soft p-4 text-sm text-ink-secondary">
            Apply with a short proposal. Once the sponsor approves it, the submission form unlocks on the bounty page.
          </div>
          {applicationBounty ? (
            <BountyApplyGuideCta bountyHref={`/bounties/${applicationBounty.slug}`} />
          ) : hasOpenBounty ? (
            <p className="mt-5 text-sm text-ink-muted">No apply-type bounties are open right now.</p>
          ) : null}
        </article>
      </section>

      {unavailable ? (
        <section className="mt-6 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-5" role="status">
          <p className="text-sm font-semibold text-ink">Open bounties are temporarily unavailable.</p>
          <p className="mt-1 text-sm text-ink-muted">We couldn’t reach the server. Please refresh in a moment.</p>
        </section>
      ) : !hasOpenBounty ? (
        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">No open bounties right now</h2>
            <p className="mt-1 text-sm text-ink-muted">New sponsor opportunities will appear in the bounty marketplace.</p>
          </div>
          <Link
            className="inline-flex shrink-0 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/bounties"
          >
            Browse all bounties
          </Link>
        </section>
      ) : null}

      <section className="mt-8 rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Application status</h2>
        <ol className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
          {statuses.map((status, index) => (
            <li className="flex flex-1 items-center gap-3 sm:gap-0" key={status}>
              <span className="w-fit rounded-full bg-surface-subtle px-3 py-1.5 text-sm text-ink-secondary">{status}</span>
              {index < statuses.length - 1 ? <span className="hidden h-px flex-1 bg-primary-outline sm:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4 text-xs text-ink-muted">Application status is tracked for bounties that require an application.</p>
    </div>
  );
}
