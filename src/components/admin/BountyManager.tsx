"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AdminListStatus } from "@/components/admin/AdminListStatus";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { BOUNTY_TEXT_MAX } from "@/lib/input-limits";
import { scrollIntoViewRespectingMotion } from "@/lib/scroll";
import { opsInput, opsTextarea } from "@/components/admin/ops-ui";
import { useAdminList, useAdminRecordDelete, useLoadFailedToast, useSingleFlightCallback } from "@/components/admin/useAdminList";
import { Badge } from "@/components/ui/Badge";
import { useKeyedSingleFlight } from "@/components/ui/useSingleFlight";
import { RewardPill } from "@/components/ui/RewardPill";
import { type AdminBounty, adminErrorDescription, adminTextFieldErrors, expirePublicLists } from "@/lib/admin-helpers";
import { bountyToForm, emptyBountyForm, formToBounty, isIsoDateTime, rewardIntegerDigitsMax, validateBountyForm, type BountyFormErrors, type BountyFormValues } from "@/lib/admin-bounty-form";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { tokenDecimalsFor } from "@/lib/api/codecs";
import { BOUNTY_CATEGORIES } from "@/lib/bounty-categories";
import { isDeadlinePassed } from "@/lib/bounty-status";
import { opsErrorCode } from "@/lib/admin-operations";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { Link } from "@/i18n/navigation";

/** An OPEN bounty still reads Active in the BE until someone transitions it; past its deadline it no longer accepts submissions. */
const isPastDeadline = (iso: string) => isIsoDateTime(iso) && isDeadlinePassed(iso);

const columns = [
  { id: "title", widthClass: "w-[244px]" },
  { id: "sponsor", widthClass: "w-[149px]" },
  { id: "reward", widthClass: "w-[199px]" },
  { id: "intake", widthClass: "w-[111px]" },
  { id: "status", widthClass: "w-[164px]" },
  { id: "deadline", widthClass: "w-[136px]" },
  { id: "action", widthClass: "w-[147px]" },
];

const statusVariants = { draft: "neutral", funding: "warning", active: "success", submissionClosed: "warning", reviewing: "warning", completed: "neutral", cancelled: "danger" } as const;

type Mode = { kind: "create" } | { kind: "edit"; slug: string };

export function BountyManager({ bounties, children, tabs }: { bounties: AdminBounty[]; children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.bounties");
  const tCommon = useTranslations("admin.common");
  // The app formatter is UTC-pinned (src/i18n/request.ts); the deadline cell overrides it with the admin's own zone so it
  // reads like the datetime-local edit field (which is browser-local), and always prints the zone abbreviation.
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [mode, setMode] = useState<Mode>({ kind: "create" });
  const [form, setForm] = useState<BountyFormValues>(emptyBountyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<BountyFormErrors>({});
  const [originalDeadline, setOriginalDeadline] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminBounty | null>(null);
  // Bounties with a transition in flight: a second click would send the same target again and answer INVALID_TRANSITION right after the success toast.
  const transitionFlight = useKeyedSingleFlight();
  const formRef = useRef<HTMLElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const editing = mode.kind === "edit";

  // Same ISO gate as the edit field (`toLocalDateTimeInput`): V8 reads a stray "07.14" as 2001-07-14, which must not
  // render as a real date in the table while the form treats it as invalid.
  const deadlineCell = (iso: string) =>
    !isIsoDateTime(iso) ? "–" : format.dateTime(new Date(iso), { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" });

  /** Forgets the picked file, including the native input's own selection (it would keep showing the name, and picking the same file again fires no change). */
  const clearCoverFile = () => {
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  /** Clears the stored cover and any picked file; the save then sends `coverImageUrl: null` so the BE drops it. */
  const removeCover = () => {
    updateForm("coverImage", null);
    clearCoverFile();
  };

  // `reload` re-reads the list after a write. The write has already succeeded by then, so a failed re-read only says "could not load"
  // (never "save failed": a retry of an already-created bounty would create a duplicate).
  const fetchBounties = useCallback(() => api.getAdminBounties(), [api]);
  const toastLoadFailed = useLoadFailedToast(t("toast.loadFailedTitle"), t("toast.loadFailedDescription"));
  const { records, setRecords, loadState, reload, retry } = useAdminList(fetchBounties, bounties, toastLoadFailed);

  const updateForm = <Key extends keyof BountyFormValues>(key: Key, value: BountyFormValues[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const fieldError = (key: keyof BountyFormValues) => {
    const error = errors[key];
    return error ? <span className="mt-1 block text-xs font-normal text-danger" id={`bounty-${key}-error`}>{t(`form.errors.${error}`, { digits: rewardIntegerDigitsMax(tokenDecimalsFor(form.currency) ?? 18), max: key === "description" ? BOUNTY_TEXT_MAX.description : key === "reviewProcess" ? BOUNTY_TEXT_MAX.reviewProcess : BOUNTY_TEXT_MAX.deliverables })}</span> : null;
  };

  const invalidProps = (key: keyof BountyFormValues) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `bounty-${key}-error` } : {};

  const startCreate = () => {
    setMode({ kind: "create" });
    setForm(emptyBountyForm());
    clearCoverFile();
    setErrors({});
    setOriginalDeadline(undefined);
    scrollIntoViewRespectingMotion(formRef.current);
  };

  const startEdit = (bounty: AdminBounty) => {
    setMode({ kind: "edit", slug: bounty.slug });
    const initial = bountyToForm(bounty);
    setForm(initial);
    clearCoverFile();
    setErrors({});
    setOriginalDeadline(initial.deadline);
    scrollIntoViewRespectingMotion(formRef.current);
  };

  // The BE stores one `category` (`formToBounty` → `tags[0]`), so the chips are single-select: a multi-toggle let
  // "Design" be added behind the default "Dev" and saved as DEV, and deselecting every chip silently saved OTHER.
  const selectTag = (tag: AdminBounty["tags"][number]) => {
    setForm((current) => ({ ...current, tags: [tag] }));
  };

  // Validation runs outside the single-flight guard: a rejected form must not hold it (a fixed retry right after has to go through).
  const persistBounty = useSingleFlightCallback(async () => {
    setSaving(true);
    try {
      const coverImage = coverFile ? (await api.uploadAdminMedia(coverFile)).url : form.coverImage;
      const existing = mode.kind === "edit" ? records.find((record) => record.slug === mode.slug) : undefined;
      const bounty = formToBounty(form, mode.kind === "edit"
        ? { slug: mode.slug, coverImage, existingStatus: existing?.status ?? "draft" }
        : { slug: "", coverImage });
      await api.saveAdminBounty(bounty, mode.kind === "create");
      expirePublicLists(["bounties"]);
      pushAdminToast({ variant: "success", title: mode.kind === "edit" ? t("toast.updatedTitle") : t("toast.createdTitle"), description: tCommon("savedDescription", { title: form.title }) });
      startCreate();
      await reload();
    } catch (error) {
      // A BE-only text rejection (hidden characters, nothing visible) names its property: show it on the field, not as a generic failure.
      const inline = adminTextFieldErrors(error, { title: "title", sponsorName: "sponsor", description: "description", requirements: "deliverables", evaluationCriteria: "reviewProcess" } as const);
      if (Object.keys(inline).length > 0) {
        setErrors((current) => ({ ...current, ...inline }));
        pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("form.errors.summary") });
      } else {
        pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: adminErrorDescription(error, tCommon, t("toast.saveFailedDescription")) });
      }
    } finally {
      setSaving(false);
    }
  });

  const saveBounty = () => {
    const nextErrors = validateBountyForm(form, { originalDeadline, editing });
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: t("form.errors.summary") });
      return;
    }
    void persistBounty();
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveBounty();
  };

  const transition = async (bounty: AdminBounty) => {
    const to = bounty.status === "active" ? "SUBMISSION_CLOSED" : "OPEN";
    await transitionFlight.run(bounty.slug, async () => {
      try {
        await api.transitionAdminBounty(bounty.slug, to);
        expirePublicLists(["bounties"]);
        pushAdminToast({ variant: "success", title: t("toast.statusUpdatedTitle"), description: t("toast.statusUpdatedDescription", { title: bounty.title, to }) });
        await reload();
      } catch (error) {
        // A blocked transition (BE 400 with a blocker list, e.g. REWARDS_UNFUNDED) is the common failure here; the blockers themselves live in Operations.
        const blocked = opsErrorCode(error, "transition").code === "TRANSITION_BLOCKED";
        pushAdminToast({ variant: "danger", title: t("toast.transitionFailedTitle"), description: blocked ? t("toast.transitionBlockedDescription") : adminErrorDescription(error, tCommon, t("toast.transitionFailedDescription")) });
      }
    });
  };

  const remove = useAdminRecordDelete<AdminBounty>({
    call: (bounty) => api.deleteAdminBounty(bounty.slug),
    keyOf: (bounty) => bounty.slug,
    setRecords,
    closeDialog: () => setPendingDelete(null),
    onRemoved: (bounty) => {
      expirePublicLists(["bounties"]);
      // The form may be editing the record that just went away: a later save would PATCH a missing row.
      if (mode.kind === "edit" && mode.slug === bounty.slug) startCreate();
    },
    describeError: (error) => adminErrorDescription(error, tCommon, t("toast.deleteFailedDescription")),
    successToast: (bounty) => ({ title: t("toast.deletedTitle"), description: bounty.title }),
    failedTitle: tCommon("deleteFailed"),
    reload,
  });

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
        <AdminListStatus failedText={t("toast.loadFailedDescription")} onRetry={retry} state={loadState} />
        {loadState === "ready" ? (
        <AdminTable columns={columns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[1120px]">
          {records.map((bounty) => (
            <tr className="border-t border-border" key={bounty.slug}>
              <td className={`px-5 py-4 text-sm font-semibold text-ink ${adminLongTextCell}`}>{bounty.title}</td>
              <td className={`px-5 py-4 text-sm text-ink-secondary ${adminLongTextCell}`}>{bounty.sponsor}</td>
              <td className="px-5 py-4"><RewardPill reward={bounty.reward} />{bounty.rewardContractAddress ? <p className="mt-1 text-xs text-ink-muted" title={bounty.rewardContractAddress}>EVM {bounty.rewardChainId} · {bounty.rewardContractAddress.slice(0, 6)}…{bounty.rewardContractAddress.slice(-4)}</p> : null}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{t(`intake.${bounty.intakeEnabled ? "ON" : "OFF"}`)}<p className="mt-1 text-xs text-ink-muted">{t(`submissionModes.${bounty.submissionMode === "agent" ? "Agent" : "Direct"}`)}</p></td>
              <td className="px-5 py-4">{bounty.status === "active" && isPastDeadline(bounty.deadline) ? <Badge variant="warning">{t("statuses.pastDeadline")}</Badge> : <Badge variant={statusVariants[bounty.status]}>{t(`statuses.${bounty.status}`)}</Badge>}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{deadlineCell(bounty.deadline)}</td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><button className="rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong" onClick={() => startEdit(bounty)} type="button">{tCommon("edit")}</button>{["draft", "funding", "active"].includes(bounty.status) ? <button className="rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong disabled:cursor-not-allowed disabled:opacity-60" disabled={transitionFlight.isBusy(bounty.slug)} onClick={() => transition(bounty)} type="button">{bounty.status === "active" ? t("close") : t("open")}</button> : null}<Link className="rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={{ pathname: "/admin/operations", query: { bounty: bounty.slug } }}>{t("operations")}</Link><button className="rounded-control border border-danger px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-danger" onClick={() => setPendingDelete(bounty)} type="button">{tCommon("delete")}</button></div></td>
            </tr>
          ))}
        </AdminTable>
        ) : null}
      </div>

      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{editing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">{editing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
        <form noValidate onSubmit={save}>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold text-ink">{t("form.title")}
              <input className={opsInput} {...invalidProps("title")} onChange={(event) => updateForm("title", event.target.value)} placeholder={t("form.titlePlaceholder")} type="text" value={form.title} />
              {fieldError("title")}
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.sponsor")}
              <input className={opsInput} {...invalidProps("sponsor")} onChange={(event) => updateForm("sponsor", event.target.value)} placeholder={t("form.sponsorPlaceholder")} type="text" value={form.sponsor} />
              {fieldError("sponsor")}
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.deadline")}
              <input className={opsInput} {...invalidProps("deadline")} onChange={(event) => updateForm("deadline", event.target.value)} required type="datetime-local" value={form.deadline} />
              {fieldError("deadline")}
            </label>
            {form.intake === "ON" || form.applicationDeadline ? (
              <label className="block text-sm font-semibold text-ink">{t("form.applicationDeadline")}
                <input className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" {...invalidProps("applicationDeadline")} onChange={(event) => updateForm("applicationDeadline", event.target.value)} type="datetime-local" value={form.applicationDeadline} />
                {fieldError("applicationDeadline")}
              </label>
            ) : null}
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.reward")}</p>
              <div className="mt-2 flex gap-3">
                <div className="w-fit"><AdminSelect disabled={editing} label={t("form.rewardCurrency")} onChange={(value) => updateForm("currency", value as BountyFormValues["currency"])} options={["INJ", "USDC"]} value={form.currency} /></div>
                <input aria-label={t("form.rewardAmount")} className={`${opsInput} mt-0! min-w-0 flex-1`} {...invalidProps("amount")} disabled={editing} inputMode="decimal" onChange={(event) => updateForm("amount", event.target.value)} placeholder={t("form.amountPlaceholder")} type="text" value={form.amount} />
              </div>
              {fieldError("amount")}
              {editing ? <p className="mt-2 text-xs text-ink-muted">{t("form.rewardLockedHint")}</p> : null}
            </div>
            <label className="block text-sm font-semibold text-ink">{t("form.maxWinners")}
              <input className={opsInput} {...invalidProps("maxWinners")} inputMode="numeric" onChange={(event) => updateForm("maxWinners", event.target.value)} type="text" value={form.maxWinners} />
              {fieldError("maxWinners")}
              <span className="mt-2 block text-xs font-normal text-ink-muted">{t("form.maxWinnersHint")}</span>
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.intake")}</p>
              <div className="mt-2 w-fit"><AdminSelect formatOption={(option) => t(`intake.${option}`)} label={t("form.intake")} onChange={(value) => updateForm("intake", value as BountyFormValues["intake"])} options={["OFF", "ON"]} value={form.intake} /></div>
              <p className="mt-2 text-xs text-ink-muted">{t("form.intakeHint")}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("form.submissionMode")}</p>
              <div className="mt-2 w-fit"><AdminSelect formatOption={(option) => t(`submissionModes.${option}`)} label={t("form.submissionMode")} onChange={(value) => updateForm("submissionMode", value as BountyFormValues["submissionMode"])} options={["Direct", "Agent"]} value={form.submissionMode} /></div>
              <p className="mt-2 text-xs text-ink-muted">{t("form.submissionModeHint")}</p>
            </div>
            <div className="text-sm font-semibold text-ink">
              <label className="block">{t("form.coverImage")}
                <input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal text-ink-secondary file:mr-3 file:rounded-control file:border file:border-primary-outline file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-strong" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} ref={coverInputRef} type="file" />
              </label>
              <span className="mt-2 block text-xs font-normal text-ink-muted">{coverFile?.name ?? form.coverImage ?? tCommon("fileHint")}</span>
              {form.coverImage || coverFile ? <button className="mt-2 text-xs font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={removeCover} type="button">{tCommon("removeImage")}</button> : null}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink" id="bounty-tags-label">{t("form.tags")}</p>
              <div aria-labelledby="bounty-tags-label" className="mt-2 flex flex-wrap gap-2" role="group">
                {BOUNTY_CATEGORIES.map((tag) => <button aria-pressed={form.tags.includes(tag)} className={form.tags.includes(tag) ? "inline-flex h-6 items-center rounded-full max-sm:h-10 bg-primary px-2.5 max-sm:px-4 text-xs font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : "inline-flex h-6 items-center rounded-full max-sm:h-10 max-sm:px-4 bg-primary-soft px-2.5 text-xs font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"} key={tag} onClick={() => selectTag(tag)} type="button">{t(`tags.${tag}`)}</button>)}
              </div>
            </div>
            <label className="block text-sm font-semibold text-ink">{t("form.description")}
              <textarea className={opsTextarea} {...invalidProps("description")} onChange={(event) => updateForm("description", event.target.value)} placeholder={t("form.descriptionPlaceholder")} value={form.description} />
              {fieldError("description")}
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.deliverables")}
              <textarea className={opsTextarea} {...invalidProps("deliverables")} onChange={(event) => updateForm("deliverables", event.target.value)} placeholder={t("form.deliverablesPlaceholder")} value={form.deliverables} />
              <p className="mt-2 text-xs text-ink-muted">{t("form.deliverablesHint")}</p>
              {fieldError("deliverables")}
            </label>
            <label className="block text-sm font-semibold text-ink">{t("form.reviewProcess")}
              <input className={opsInput} {...invalidProps("reviewProcess")} onChange={(event) => updateForm("reviewProcess", event.target.value)} placeholder={t("form.reviewProcessPlaceholder")} type="text" value={form.reviewProcess} />
              {fieldError("reviewProcess")}
            </label>
          </div>
          <button className="mt-5 h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">{saving ? tCommon("saving") : editing ? t("form.save") : t("form.create")}</button>
          {editing ? null : <p className="mt-3 text-xs text-ink-muted">{t("form.rewardNote")}</p>}
        </form>
      </section>
      <DeleteConfirmDialog onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && void remove(pendingDelete)} title={pendingDelete?.title ?? null} />
    </>
  );
}
