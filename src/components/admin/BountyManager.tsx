"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminTable } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import type { AdminBounty } from "@/lib/admin";
import { useAdminApi } from "@/components/auth/FoundationProvider";

const columns = [
  { id: "title", widthClass: "w-[244px]" },
  { id: "sponsor", widthClass: "w-[149px]" },
  { id: "reward", widthClass: "w-[199px]" },
  { id: "intake", widthClass: "w-[111px]" },
  { id: "status", widthClass: "w-[164px]" },
  { id: "deadline", widthClass: "w-[136px]" },
  { id: "action", widthClass: "w-[147px]" },
];

const tags = ["Dev", "Design", "Content", "Other"] as const;
const statusVariants = { draft: "neutral", funding: "warning", active: "success", reviewing: "warning", closed: "danger" } as const;

type FormValues = {
  title: string;
  sponsor: string;
  deadline: string;
  amount: string;
  currency: "INJ" | "USDC";
  intake: "OFF" | "ON";
  submissionMode: "Direct" | "Agent";
  coverImage: string | null;
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
  submissionMode: "Direct",
  coverImage: null,
  tags: ["Dev"],
  description: "",
  submissionGuide: "",
  deliverables: "",
  reviewProcess: "",
});

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

export function BountyManager({ bounties, children, tabs }: { bounties: AdminBounty[]; children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.bounties");
  const tCommon = useTranslations("admin.common");
  const [records, setRecords] = useState(bounties);
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const formRef = useRef<HTMLElement>(null);
  const editing = mode.kind === "edit";

  useEffect(() => {
    api.getAdminBounties().then(setRecords).catch(() => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") }));
  }, [api, t]);

  const updateForm = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startCreate = () => {
    setMode({ kind: "create" });
    setForm(emptyForm());
    setCoverFile(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startEdit = (bounty: AdminBounty) => {
    setMode({ kind: "edit", slug: bounty.slug });
    setForm({
      title: bounty.title,
      sponsor: bounty.sponsor,
      deadline: bounty.deadline.slice(0, 16),
      amount: String(bounty.reward.amount),
      currency: bounty.reward.currency,
      intake: bounty.intakeEnabled ? "ON" : "OFF",
      submissionMode: bounty.submissionMode === "agent" ? "Agent" : "Direct",
      coverImage: bounty.coverImage,
      tags: bounty.tags,
      description: bounty.description,
      submissionGuide: bounty.submissionGuide,
      deliverables: bounty.deliverables.join("\n"),
      reviewProcess: bounty.reviewProcess,
    });
    setCoverFile(null);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleTag = (tag: AdminBounty["tags"][number]) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((currentTag) => currentTag !== tag) : [...current.tags, tag],
    }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const coverImage = coverFile ? (await api.uploadAdminMedia(coverFile)).url : form.coverImage;
      const bounty: AdminBounty = {
        slug: mode.kind === "edit" ? mode.slug : "",
        title: form.title,
        sponsor: form.sponsor,
        reward: { amount: Number(form.amount) || 0, currency: form.currency },
        intakeEnabled: form.intake === "ON",
        submissionMode: form.submissionMode === "Agent" ? "agent" : "direct",
        coverImage,
        deadline: new Date(form.deadline).toISOString(),
        tags: form.tags,
        description: form.description,
        submissionGuide: form.submissionGuide,
        deliverables: form.deliverables.split("\n").map((line) => line.trim()).filter(Boolean),
        reviewProcess: form.reviewProcess,
        status: mode.kind === "edit" ? records.find((record) => record.slug === mode.slug)?.status ?? "draft" : Number(form.amount) > 0 ? "funding" : "draft",
      };
      await api.saveAdminBounty(bounty, mode.kind === "create");
      setRecords(await api.getAdminBounties());
      pushAdminToast({ variant: "success", title: mode.kind === "edit" ? t("toast.updatedTitle") : t("toast.createdTitle"), description: tCommon("savedDescription", { title: form.title }) });
      startCreate();
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("toast.saveFailedDescription") });
    }
  };

  const transition = async (bounty: AdminBounty) => {
    const to = bounty.status === "active" ? "SUBMISSION_CLOSED" : "OPEN";
    try {
      await api.transitionAdminBounty(bounty.slug, to);
      setRecords(await api.getAdminBounties());
      pushAdminToast({ variant: "success", title: t("toast.statusUpdatedTitle"), description: t("toast.statusUpdatedDescription", { title: bounty.title, to }) });
    } catch {
      pushAdminToast({ variant: "danger", title: t("toast.transitionFailedTitle"), description: t("toast.transitionFailedDescription") });
    }
  };

  const remove = async (bounty: AdminBounty) => {
    if (!window.confirm(tCommon("deleteConfirm", { title: bounty.title }))) return;
    try {
      await api.deleteAdminBounty(bounty.slug);
      setRecords((current) => current.filter((item) => item.slug !== bounty.slug));
      pushAdminToast({ variant: "success", title: t("toast.deletedTitle"), description: bounty.title });
    } catch {
      pushAdminToast({ variant: "danger", title: tCommon("deleteFailed"), description: t("toast.deleteFailedDescription") });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>{children}</div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
          <button className="h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={startCreate} type="button">{t("newBounty")}</button>
        </div>
      </div>

      <div>{tabs}</div>
      <div className="mt-6">
        <AdminTable columns={columns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[900px]">
          {records.map((bounty) => (
            <tr className="border-t border-border" key={bounty.slug}>
              <td className="px-5 py-4 text-sm font-semibold text-ink">{bounty.title}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.sponsor}</td>
              <td className="px-5 py-4"><RewardPill reward={bounty.reward} />{bounty.rewardContractAddress ? <p className="mt-1 text-xs text-ink-muted" title={bounty.rewardContractAddress}>EVM {bounty.rewardChainId} · {bounty.rewardContractAddress.slice(0, 6)}…{bounty.rewardContractAddress.slice(-4)}</p> : null}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{t(`intake.${bounty.intakeEnabled ? "ON" : "OFF"}`)}<p className="mt-1 text-xs text-ink-muted">{t(`submissionModes.${bounty.submissionMode === "agent" ? "Agent" : "Direct"}`)}</p></td>
              <td className="px-5 py-4"><Badge variant={statusVariants[bounty.status]}>{t(`statuses.${bounty.status}`)}</Badge></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{bounty.deadline}</td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><button className="rounded-control border border-primary-outline px-3 py-2 text-sm font-semibold text-primary-strong" onClick={() => startEdit(bounty)} type="button">{tCommon("edit")}</button>{["draft", "funding", "active"].includes(bounty.status) ? <button className="rounded-control border border-primary-outline px-3 py-2 text-sm font-semibold text-primary-strong" onClick={() => transition(bounty)} type="button">{bounty.status === "active" ? t("close") : t("open")}</button> : null}<button className="rounded-control border border-danger px-3 py-2 text-sm font-semibold text-danger" onClick={() => remove(bounty)} type="button">{tCommon("delete")}</button></div></td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{editing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">{editing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <form onSubmit={save}>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">{t("form.title")}
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("title", event.target.value)} placeholder={t("form.titlePlaceholder")} type="text" value={form.title} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.sponsor")}
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("sponsor", event.target.value)} placeholder={t("form.sponsorPlaceholder")} type="text" value={form.sponsor} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.deadline")}
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("deadline", event.target.value)} required type="datetime-local" value={form.deadline} />
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.reward")}</p>
              <div className="mt-2 flex gap-3">
                <div className="w-fit"><AdminSelect label={t("form.rewardCurrency")} onChange={(value) => updateForm("currency", value as FormValues["currency"])} options={["INJ", "USDC"]} value={form.currency} /></div>
                <input aria-label={t("form.rewardAmount")} className="h-[46px] min-w-0 flex-1 rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("amount", event.target.value)} placeholder={t("form.amountPlaceholder")} type="number" value={form.amount} />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.intake")}</p>
              <div className="mt-2 w-fit"><AdminSelect formatOption={(option) => t(`intake.${option}`)} label={t("form.intake")} onChange={(value) => updateForm("intake", value as FormValues["intake"])} options={["OFF", "ON"]} value={form.intake} /></div>
              <p className="mt-2 text-xs text-ink-muted">{t("form.intakeHint")}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.submissionMode")}</p>
              <div className="mt-2 w-fit"><AdminSelect formatOption={(option) => t(`submissionModes.${option}`)} label={t("form.submissionMode")} onChange={(value) => updateForm("submissionMode", value as FormValues["submissionMode"])} options={["Direct", "Agent"]} value={form.submissionMode} /></div>
              <p className="mt-2 text-xs text-ink-muted">{t("form.submissionModeHint")}</p>
            </div>
            <label className="block text-sm font-semibold text-ink">{t("form.coverImage")}
              <input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal text-ink-secondary file:mr-3 file:rounded-control file:border file:border-primary-outline file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-strong" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} type="file" />
              <span className="mt-2 block text-xs font-normal text-ink-muted">{coverFile?.name ?? form.coverImage ?? tCommon("fileHint")}</span>
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.tags")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => <button aria-pressed={form.tags.includes(tag)} className={form.tags.includes(tag) ? "inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : "inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"} key={tag} onClick={() => toggleTag(tag)} type="button">{t(`tags.${tag}`)}</button>)}
              </div>
            </div>
            <label className="block text-sm font-semibold text-ink">{t("form.description")}
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("description", event.target.value)} placeholder={t("form.descriptionPlaceholder")} value={form.description} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.submissionGuide")}
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("submissionGuide", event.target.value)} placeholder={t("form.submissionGuidePlaceholder")} value={form.submissionGuide} />
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.deliverables")}
              <textarea className="mt-2 min-h-[112px] w-full rounded-control border border-border px-[17px] py-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("deliverables", event.target.value)} placeholder={t("form.deliverablesPlaceholder")} value={form.deliverables} />
              <p className="mt-2 text-xs text-ink-muted">{t("form.deliverablesHint")}</p>
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.reviewProcess")}
              <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onChange={(event) => updateForm("reviewProcess", event.target.value)} placeholder={t("form.reviewProcessPlaceholder")} type="text" value={form.reviewProcess} />
            </label>
          </div>
          <button className="mt-5 h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">{editing ? t("form.save") : t("form.create")}</button>
          <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
        </form>
      </section>
    </>
  );
}
