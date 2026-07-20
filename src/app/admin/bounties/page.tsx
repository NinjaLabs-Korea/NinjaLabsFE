import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import { getAdminBounties } from "@/lib/admin";

const columns = [
  { id: "title", label: "Title", widthClass: "w-[244px]" },
  { id: "sponsor", label: "Sponsor", widthClass: "w-[149px]" },
  { id: "reward", label: "Reward", widthClass: "w-[199px]" },
  { id: "intake", label: "Intake", widthClass: "w-[111px]" },
  { id: "status", label: "Status", widthClass: "w-[164px]" },
  { id: "deadline", label: "Deadline", widthClass: "w-[136px]" },
  { id: "action", label: "Action", widthClass: "w-[147px]" },
];

const tags = ["Dev", "Design", "Content", "Other"];

const statusVariants = {
  active: "success",
  reviewing: "warning",
  closed: "danger",
} as const;

export const metadata: Metadata = {
  title: "Admin · Bounties — Ninja Labs",
  description: "Create and manage sponsor-backed bounties.",
};

export default function AdminBountiesPage() {
  const bounties = getAdminBounties();

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">ADMIN</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">Bounty management</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">Create and manage sponsor-backed bounties.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">ADMIN ONLY</Badge>
          <button className="h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft" type="button">+ New Bounty</button>
        </div>
      </div>

      <div className="mt-6">
        <AdminTabs active="bounties" />
      </div>

      <div className="mt-6">
        <AdminTable columns={columns} minWidthClass="min-w-[900px]">
          {bounties.map((bounty) => (
            <tr className="border-t border-border" key={bounty.slug}>
              <td className="px-5 py-4 text-sm font-semibold text-ink">{bounty.title}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.sponsor}</td>
              <td className="px-5 py-4"><RewardPill reward={bounty.reward} /></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.intakeEnabled ? "ON" : "OFF"}</td>
              <td className="px-5 py-4"><Badge variant={statusVariants[bounty.status]}>{bounty.status[0].toUpperCase() + bounty.status.slice(1)}</Badge></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.deadline}</td>
              <td className="px-5 py-4"><button className="rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong" type="button">Edit</button></td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">BOUNTY</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">New Bounty</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">Title
            <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="Bounty title" type="text" />
          </label>
          <label className="block text-sm font-semibold text-ink">Sponsor
            <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="Sponsor name" type="text" />
          </label>
          <label className="block text-sm font-semibold text-ink">Deadline
            <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="MM.DD.YYYY" type="text" />
          </label>
          <div>
            <p className="text-sm font-semibold text-ink">Reward</p>
            <div className="mt-2 flex gap-3">
              <div className="flex h-[46px] items-center rounded-control border border-border px-[17px] text-sm text-ink-secondary">INJ <span className="ml-2">▾</span></div>
              <input aria-label="Reward amount" className="h-[46px] min-w-0 flex-1 rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="Amount" type="number" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Intake</p>
            <div className="mt-2 flex h-[46px] w-fit items-center rounded-control border border-border px-[17px] text-sm text-ink-secondary">OFF <span className="ml-2">▾</span></div>
            <p className="mt-2 text-xs text-ink-muted">Allow submissions from the public bounty page.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => <span key={tag} className={tag === "Dev" ? "inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-soft" : "inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary-strong"}>{tag}</span>)}
            </div>
          </div>
          <label className="block text-sm font-semibold text-ink">Description
            <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="Describe the bounty" />
          </label>
          <label className="block text-sm font-semibold text-ink">Submission guide
            <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder" placeholder="Add evaluation criteria and submission guidance" />
          </label>
        </div>
        <button className="mt-5 h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft" type="button">Create</button>
      </section>
    </section>
  );
}
