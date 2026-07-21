"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminTable } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import type { AdminBounty } from "@/lib/admin";

const columns = [
  { id: "title", label: "Title", widthClass: "w-[244px]" },
  { id: "sponsor", label: "Sponsor", widthClass: "w-[149px]" },
  { id: "reward", label: "Reward", widthClass: "w-[199px]" },
  { id: "intake", label: "Intake", widthClass: "w-[111px]" },
  { id: "status", label: "Status", widthClass: "w-[164px]" },
  { id: "deadline", label: "Deadline", widthClass: "w-[136px]" },
  { id: "action", label: "Action", widthClass: "w-[147px]" },
];

const tags = ["Dev", "Design", "Content", "Other"] as const;
const statusVariants = { active: "success", reviewing: "warning", closed: "danger" } as const;

type FormValues = {
  title: string;
  sponsor: string;
  deadline: string;
  amount: string;
  currency: "INJ" | "USDC";
  intake: "OFF" | "ON";
  tags: AdminBounty["tags"];
  description: string;
  submissionGuide: string;
  deliverables: string;
  reviewProcess: string;
};

const emptyForm = (): FormValues => ({
  title: "",
  sponsor: "",
  deadline: "",
  amount: "",
  currency: "INJ",
  intake: "OFF",
  tags: ["Dev"],
  description: "",
  submissionGuide: "",
  deliverables: "",
  reviewProcess: "",
});

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `bounty-${Date.now()}`;
}

function createUniqueSlug(title: string, records: AdminBounty[]) {
  const baseSlug = slugify(title);
  const existingSlugs = new Set(records.map(({ slug }) => slug));
  let slug = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

export function BountyManager({ bounties, children, tabs }: { bounties: AdminBounty[]; children: ReactNode; tabs: ReactNode }) {
  const [records, setRecords] = useState(bounties);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [form, setForm] = useState<FormValues>(emptyForm);
  const formRef = useRef<HTMLElement>(null);
  const editing = mode.kind === "edit";

  const updateForm = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setMode({ kind: "create" });
    setForm(emptyForm());
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startEdit = (bounty: AdminBounty) => {
    setMode({ kind: "edit", slug: bounty.slug });
    setForm({
      title: bounty.title,
      sponsor: bounty.sponsor,
      deadline: bounty.deadline,
      amount: String(bounty.reward.amount),
      currency: bounty.reward.currency,
      intake: bounty.intakeEnabled ? "ON" : "OFF",
      tags: bounty.tags,
      description: bounty.description,
      submissionGuide: bounty.submissionGuide,
      deliverables: bounty.deliverables.join("\n"),
      reviewProcess: bounty.reviewProcess,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleTag = (tag: AdminBounty["tags"][number]) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((currentTag) => currentTag !== tag) : [...current.tags, tag],
    }));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bounty = {
      title: form.title,
      sponsor: form.sponsor,
      reward: { amount: Number(form.amount) || 0, currency: form.currency },
      intakeEnabled: form.intake === "ON",
      deadline: form.deadline,
      tags: form.tags,
      description: form.description,
      submissionGuide: form.submissionGuide,
      deliverables: form.deliverables.split("\n").map((line) => line.trim()).filter(Boolean),
      reviewProcess: form.reviewProcess,
    };

    if (mode.kind === "edit") {
      setRecords((current) => current.map((record) => record.slug === mode.slug ? { ...record, ...bounty } : record));
      pushAdminToast({ variant: "success", title: "Bounty updated", description: `"${form.title}" — session preview, resets on reload.` });
    } else {
      setRecords((current) => [...current, { ...bounty, slug: createUniqueSlug(form.title, current), status: "active" }]);
      pushAdminToast({ variant: "success", title: "Bounty created", description: `"${form.title}" — session preview, resets on reload.` });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>{children}</div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">ADMIN ONLY</Badge>
          <button className="h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={startCreate} type="button">+ New Bounty</button>
        </div>
      </div>

      <div>{tabs}</div>
      <div className="mt-6">
        <AdminTable columns={columns} minWidthClass="min-w-[900px]">
          {records.map((bounty) => (
            <tr className="border-t border-border" key={bounty.slug}>
              <td className="px-5 py-4 text-sm font-semibold text-ink">{bounty.title}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.sponsor}</td>
              <td className="px-5 py-4"><RewardPill reward={bounty.reward} /></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.intakeEnabled ? "ON" : "OFF"}</td>
              <td className="px-5 py-4"><Badge variant={statusVariants[bounty.status]}>{bounty.status[0].toUpperCase() + bounty.status.slice(1)}</Badge></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.deadline}</td>
              <td className="px-5 py-4"><button className="rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => startEdit(bounty)} type="button">Edit</button></td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{editing ? "EDIT BOUNTY" : "BOUNTY"}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">{editing ? "Edit Bounty" : "New Bounty"}</h2>
        <form onSubmit={save}>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">Title
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("title", event.target.value)} placeholder="Bounty title" type="text" value={form.title} />
            </label>
            <label className="block text-sm font-semibold text-ink">Sponsor
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("sponsor", event.target.value)} placeholder="Sponsor name" type="text" value={form.sponsor} />
            </label>
            <label className="block text-sm font-semibold text-ink">Deadline
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("deadline", event.target.value)} placeholder="MM.DD.YYYY" type="text" value={form.deadline} />
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">Reward</p>
              <div className="mt-2 flex gap-3">
                <div className="w-fit"><AdminSelect label="Reward currency" onChange={(value) => updateForm("currency", value as FormValues["currency"])} options={["INJ", "USDC"]} value={form.currency} /></div>
                <input aria-label="Reward amount" className="h-[46px] min-w-0 flex-1 rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("amount", event.target.value)} placeholder="Amount" type="number" value={form.amount} />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Intake</p>
              <div className="mt-2 w-fit"><AdminSelect label="Intake" onChange={(value) => updateForm("intake", value as FormValues["intake"])} options={["OFF", "ON"]} value={form.intake} /></div>
              <p className="mt-2 text-xs text-ink-muted">Allow submissions from the public bounty page.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => <button aria-pressed={form.tags.includes(tag)} className={form.tags.includes(tag) ? "inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : "inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"} key={tag} onClick={() => toggleTag(tag)} type="button">{tag}</button>)}
              </div>
            </div>
            <label className="block text-sm font-semibold text-ink">Description
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("description", event.target.value)} placeholder="Describe the bounty" value={form.description} />
            </label>
            <label className="block text-sm font-semibold text-ink">Submission guide
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("submissionGuide", event.target.value)} placeholder="Add evaluation criteria and submission guidance" value={form.submissionGuide} />
            </label>
            <label className="block text-sm font-semibold text-ink">Deliverables
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("deliverables", event.target.value)} placeholder="One deliverable per line" value={form.deliverables} />
              <p className="mt-2 text-xs text-ink-muted">One item per line mirrors the public detail meta-row shape in this session preview only.</p>
            </label>
            <label className="block text-sm font-semibold text-ink">Review process
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("reviewProcess", event.target.value)} placeholder="Ninja Labs triage plus sponsor approval" type="text" value={form.reviewProcess} />
            </label>
          </div>
          <button className="mt-5 h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">{editing ? "Save" : "Create"}</button>
          <p className="mt-3 text-xs text-ink-muted">Session preview — changes are local to this tab and reset on reload.</p>
        </form>
      </section>
    </>
  );
}
