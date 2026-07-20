import type { Metadata } from "next";
import Link from "next/link";

import { BountyFilters } from "@/components/bounties/BountyFilters";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBounties } from "@/lib/bounties";

export const metadata: Metadata = {
  title: "Bounties — Ninja Labs",
  description: "Find paid work from Injective ecosystem sponsors, ship useful pieces, and collect on-chain proof for your Ninja portfolio.",
};

export default function BountiesPage() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section>
        <div className="flex items-start justify-between gap-4">
          <SectionHeader eyebrow="Marketplace" heading="Bounties" level={1} size="xl" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="success">Public</Badge>
            <Link
              className="rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/bounties/apply"
            >
              How applying works →
            </Link>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          Find paid work from Injective ecosystem sponsors, ship useful pieces, and collect on-chain proof for your Ninja portfolio.
        </p>
      </section>

      <section className="mt-8" aria-label="Bounty filters and results">
        <BountyFilters bounties={getBounties()} />
      </section>

      <p className="mt-8 text-sm text-ink-muted">
        Sponsors may pay INJ or USDC as-is, with no platform-side swap.
      </p>
    </div>
  );
}
