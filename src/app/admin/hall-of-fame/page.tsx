import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Badge } from "@/components/ui/Badge";
import { getAdminHighlights } from "@/lib/admin";

const highlightColumns = [
  { id: "type", label: "Type", widthClass: "w-[22%]" },
  { id: "title", label: "Title", widthClass: "w-[32%]" },
  { id: "order", label: "Order", widthClass: "w-[12%]" },
  { id: "link", label: "Link", widthClass: "w-[18%]" },
  { id: "action", label: "Action", widthClass: "w-[16%]" },
];

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

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Manual</p>
              <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">Highlight curation</h2>
            </div>
            <button className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft">+ Add item</button>
          </div>
          <div className="mt-6">
            <AdminTable columns={highlightColumns} minWidthClass="min-w-[760px]">
              {highlights.map((highlight) => (
                <tr key={highlight.id} className="border-t border-border">
                  <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.type}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">{highlight.title}</td>
                  <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.order}</td>
                  <td className="px-5 py-4 text-sm text-ink-secondary">{highlight.link ?? "–"}</td>
                  <td className="px-5 py-4">
                    <button className="h-11 rounded-control border border-primary-outline bg-surface px-4 text-sm font-semibold text-primary-strong">Edit</button>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Form</p>
          <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">Add highlight</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-ink">
              Type
              <div className="mt-2 flex h-[46px] items-center justify-between rounded-control border border-border px-4 text-sm font-normal text-ink-secondary">Milestone <span>▾</span></div>
            </label>
            <label className="text-sm font-semibold text-ink">Title<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="Highlight title" /></label>
            <label className="text-sm font-semibold text-ink">Image<div className="mt-2 flex h-[46px] items-center rounded-control border border-border px-4 text-sm font-normal text-ink-placeholder">Upload image</div></label>
            <label className="text-sm font-semibold text-ink">Link <span className="font-normal text-ink-muted">(optional)</span><input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="https://" /></label>
            <label className="text-sm font-semibold text-ink">Display order<input type="number" className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="0" /></label>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft">Save</button>
        </section>
      </div>
    </section>
  );
}
