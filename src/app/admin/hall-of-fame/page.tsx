import type { Metadata } from "next";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { Badge } from "@/components/ui/Badge";
import { getAdminHighlights } from "@/lib/admin";


export const metadata: Metadata = {
  title: "Admin · Hall of Fame — Ninja Labs",
  description: "Curate the milestones and highlights that celebrate the Ninja Labs community.",
};

export default function AdminHallOfFamePage() {
  const highlights = getAdminHighlights();

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Admin</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">Hall of Fame</h1>
          <p className="mt-4 text-lg text-ink-muted">
            Curate the milestones and highlights that celebrate the Ninja Labs community.
          </p>
        </div>
        <Badge variant="neutral">ADMIN ONLY</Badge>
      </div>

      <div className="mt-8">
        <AdminTabs active="hall-of-fame" />
      </div>

      <div className="mt-8 space-y-8">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Read-only</p>
              <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">Cumulative stats</h2>
            </div>
            <Badge variant="neutral">auto-aggregated / read-only</Badge>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              ["128", "Bounties run"],
              ["412", "Builders onboarded"],
              ["$—", "Rewards paid"],
            ].map(([value, label]) => (
              <article key={label} className="rounded-card border border-primary-soft-border bg-primary-soft p-5">
                <p className="font-display text-4xl font-bold text-primary">{value}</p>
                <p className="mt-2 text-sm text-ink-muted">{label}</p>
              </article>
            ))}
          </div>
        </section>

        <HighlightManager highlights={highlights} />
      </div>
      <AdminToastHost />
    </section>
  );
}
