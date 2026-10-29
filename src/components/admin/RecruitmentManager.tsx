"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AdminListStatus } from "@/components/admin/AdminListStatus";
import { AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { CohortApplicationsPanel } from "@/components/admin/CohortApplicationsPanel";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { opsDateTime, opsInput, opsTextarea } from "@/components/admin/ops-ui";
import { scrollIntoViewRespectingMotion } from "@/lib/scroll";
import { useAdminList, useAdminRecordDelete, useLoadFailedToast } from "@/components/admin/useAdminList";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminCohortApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/admin-bounty-form";
import { cohortAdminErrorKey } from "@/lib/cohort-errors";
import type { AdminCohort, CohortStatus } from "@/lib/cohorts";
import { COHORT_DESCRIPTION_MAX, COHORT_NAME_MAX } from "@/lib/input-limits";

const cohortColumns = [
  { id: "name", widthClass: "w-[24%]" },
  { id: "status", widthClass: "w-[12%]" },
  { id: "window", widthClass: "w-[24%]" },
  { id: "applications", widthClass: "w-[20%]" },
  { id: "action", widthClass: "w-[20%]" },
];

const statusVariant = { DRAFT: "neutral", OPEN: "success", CLOSED: "warning" } as const satisfies Record<CohortStatus, string>;

type CohortForm = { name: string; description: string; opensAt: string; closesAt: string };
const emptyForm: CohortForm = { name: "", description: "", opensAt: "", closesAt: "" };
type FormErrors = Partial<Record<"name" | "description" | "window", "required" | "tooLong" | "window">>;

/** Mirror of the BE rules: a name, description up to 10 000 characters, `closesAt` strictly after `opensAt`. The BE still answers 400 `COHORT_INVALID_WINDOW`. */
export function validateCohortForm(form: CohortForm): FormErrors {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "required";
  else if ([...name].length > COHORT_NAME_MAX) errors.name = "tooLong";
  if ([...form.description].length > COHORT_DESCRIPTION_MAX) errors.description = "tooLong";
  if (form.opensAt && form.closesAt && new Date(form.closesAt).getTime() <= new Date(form.opensAt).getTime()) errors.window = "window";
  return errors;
}

const rowButton =
  "h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

type PendingTransition = { cohort: AdminCohort; to: "OPEN" | "CLOSED" };

/**
 * `/admin/recruitment`: the cohorts (create, edit, open, close, re-open, delete) and, for the selected one, its applications.
 * Opening needs no other open cohort (the BE answers 409 `COHORT_ALREADY_OPEN`), deleting needs no applications at all.
 */
export function RecruitmentManager({ children, tabs }: { children: ReactNode; tabs: ReactNode }) {
  const api = useAdminCohortApi();
  const t = useTranslations("admin.recruitment");
  const tCommon = useTranslations("admin.common");
  const tErrors = useTranslations(ERROR_COPY.adminCohort.messages);
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [mode, setMode] = useState<"create" | string>("create");
  const [form, setForm] = useState<CohortForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCohort | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<ReturnType<typeof cohortAdminErrorKey> | null>(null);
  const formRef = useRef<HTMLElement>(null);

  const fetchCohorts = useCallback(() => api.getAdminCohorts(), [api]);
  const toastLoadFailed = useLoadFailedToast(t("toast.loadFailedTitle"), t("toast.loadFailedDescription"));
  const { records, setRecords, loadState, reload, retry } = useAdminList(fetchCohorts, [], toastLoadFailed);

  const selected = records.find((cohort) => cohort.id === selectedId) ?? null;

  const updateForm = <K extends keyof CohortForm>(key: K, value: CohortForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === "opensAt" || key === "closesAt" ? { window: undefined } : {}) }));
  };

  const startNew = () => {
    setMode("create");
    setForm(emptyForm);
    setErrors({});
    scrollIntoViewRespectingMotion(formRef.current);
  };

  const editCohort = (cohort: AdminCohort) => {
    setMode(cohort.id);
    setForm({
      name: cohort.name,
      description: cohort.description ?? "",
      opensAt: cohort.opensAt ? toLocalDateTimeInput(cohort.opensAt) : "",
      closesAt: cohort.closesAt ? toLocalDateTimeInput(cohort.closesAt) : "",
    });
    setErrors({});
    scrollIntoViewRespectingMotion(formRef.current);
  };

  const saveCohort = async () => {
    if (saving) return;
    const nextErrors = validateCohortForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: tCommon("fixFields") });
      return;
    }
    setSaving(true);
    try {
      const original = mode === "create" ? undefined : records.find((cohort) => cohort.id === mode);
      // An unchanged window side keeps the stored instant byte for byte (the datetime-local field only has minute precision).
      const side = (local: string, stored: string | null | undefined) => (!local ? null : stored && toLocalDateTimeInput(stored) === local ? stored : fromLocalDateTimeInput(local));
      const saved = await api.saveAdminCohort(mode === "create" ? null : mode, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        opensAt: side(form.opensAt, original?.opensAt),
        closesAt: side(form.closesAt, original?.closesAt),
      });
      pushAdminToast({ variant: "success", title: mode === "create" ? t("toast.createdTitle") : t("toast.updatedTitle"), description: tCommon("savedDescription", { title: saved.name }) });
      startNew();
      await reload();
    } catch (error) {
      pushAdminToast({ variant: "danger", title: tCommon("saveFailed"), description: tErrors(cohortAdminErrorKey(error)) });
    } finally {
      setSaving(false);
    }
  };

  const runTransition = async () => {
    if (!pendingTransition || transitioning) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await api.transitionAdminCohort(pendingTransition.cohort.id, pendingTransition.to);
      pushAdminToast({ variant: "success", title: t(`toast.transitioned.${pendingTransition.to}`), description: pendingTransition.cohort.name });
      setPendingTransition(null);
      await reload();
    } catch (error) {
      setTransitionError(cohortAdminErrorKey(error));
      void reload();
    } finally {
      setTransitioning(false);
    }
  };

  const deleteCohort = useAdminRecordDelete<AdminCohort>({
    call: (cohort) => api.deleteAdminCohort(cohort.id),
    keyOf: (cohort) => cohort.id,
    setRecords,
    closeDialog: () => setPendingDelete(null),
    onRemoved: (cohort) => {
      if (selectedId === cohort.id) setSelectedId(null);
      if (mode === cohort.id) startNew();
    },
    describeError: (error) => tErrors(cohortAdminErrorKey(error)),
    successToast: (cohort) => ({ title: t("toast.deletedTitle"), description: cohort.name }),
    failedTitle: tCommon("deleteFailed"),
    reload,
  });

  const transitionKey = (cohort: AdminCohort, to: "OPEN" | "CLOSED") => (to === "CLOSED" ? "close" : cohort.status === "CLOSED" ? "reopen" : "open");
  const windowText = (cohort: AdminCohort) =>
    cohort.opensAt || cohort.closesAt
      ? `${cohort.opensAt ? opsDateTime(format, cohort.opensAt, timeZone) : t("window.unbounded")} ~ ${cohort.closesAt ? opsDateTime(format, cohort.closesAt, timeZone) : t("window.unbounded")}`
      : t("window.none");
  const formError = (key: keyof FormErrors) =>
    errors[key] ? <span className="mt-1 block text-xs font-normal text-danger" id={`cohort-${key}-error`} role="alert">{t(`form.errors.${errors[key]}`, { max: key === "name" ? COHORT_NAME_MAX : COHORT_DESCRIPTION_MAX })}</span> : null;
  const invalid = (key: keyof FormErrors) => ({ "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `cohort-${key}-error` : undefined });
  const isEditing = mode !== "create";
  const pendingKey = pendingTransition ? transitionKey(pendingTransition.cohort, pendingTransition.to) : "open";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        {children}
        <div className="flex items-center gap-3">
          <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
          <button
            className="h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={startNew}
            type="button"
          >
            {t("newCohort")}
          </button>
        </div>
      </div>
      {tabs}
      <div className="mt-6 space-y-6">
        <AdminListStatus failedText={t("toast.loadFailedDescription")} onRetry={retry} state={loadState} />
        {loadState === "ready" ? (
          records.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card">{t("empty")}</p>
          ) : (
            <AdminTable columns={cohortColumns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[1040px]">
              {records.map((cohort) => (
                <tr className={`border-t border-border ${cohort.id === selectedId ? "bg-primary-soft/40" : ""}`} key={cohort.id}>
                  <td className={`px-5 py-4 text-sm font-semibold text-ink ${adminLongTextCell}`}>{cohort.name}</td>
                  <td className="px-5 py-4"><Badge variant={statusVariant[cohort.status]}>{t(`statuses.${cohort.status}`)}</Badge></td>
                  <td className="px-5 py-4 text-sm text-ink-secondary">{windowText(cohort)}</td>
                  <td className="px-5 py-4 text-sm text-ink-secondary">
                    {t("counts", { total: cohort.applicationCounts.total, submitted: cohort.applicationCounts.SUBMITTED, accepted: cohort.applicationCounts.ACCEPTED, rejected: cohort.applicationCounts.REJECTED })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button aria-pressed={cohort.id === selectedId} className={rowButton} onClick={() => setSelectedId(cohort.id === selectedId ? null : cohort.id)} type="button">{t("actions.applications")}</button>
                      <button className={rowButton} onClick={() => editCohort(cohort)} type="button">{tCommon("edit")}</button>
                      {cohort.allowedTransitions.map((to) => (
                        <button className={rowButton} key={to} onClick={() => { setTransitionError(null); setPendingTransition({ cohort, to }); }} type="button">{t(`actions.${transitionKey(cohort, to)}`)}</button>
                      ))}
                      <button className="h-11 rounded-control border border-danger px-3 text-sm font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={cohort.applicationCounts.total > 0} onClick={() => setPendingDelete(cohort)} title={cohort.applicationCounts.total > 0 ? t("deleteBlocked") : undefined} type="button">{tCommon("delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )
        ) : null}

        {selected ? <CohortApplicationsPanel cohort={selected} onReviewed={() => void reload()} /> : loadState === "ready" && records.length > 0 ? <p className="text-sm text-ink-muted">{t("selectHint")}</p> : null}

        <section className="rounded-card border border-border bg-surface p-[21px] shadow-card" ref={formRef}>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{isEditing ? t("form.eyebrowEdit") : t("form.eyebrowCreate")}</p>
          <h2 className="mt-2 font-display text-2xl tracking-[-0.24px] text-ink">{isEditing ? t("form.titleEdit") : t("form.titleCreate")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-ink md:col-span-2">{t("form.name")}
              <input {...invalid("name")} className={opsInput} maxLength={COHORT_NAME_MAX} onChange={(event) => updateForm("name", event.target.value)} placeholder={t("form.namePlaceholder")} value={form.name} />
              {formError("name")}
            </label>
            <label className="text-sm font-semibold text-ink md:col-span-2">{t("form.description")}
              <textarea {...invalid("description")} className={opsTextarea} onChange={(event) => updateForm("description", event.target.value)} placeholder={t("form.descriptionPlaceholder")} value={form.description} />
              {formError("description")}
            </label>
            <label className="text-sm font-semibold text-ink">{t("form.opensAt")}
              <input {...invalid("window")} className={opsInput} onChange={(event) => updateForm("opensAt", event.target.value)} type="datetime-local" value={form.opensAt} />
            </label>
            <label className="text-sm font-semibold text-ink">{t("form.closesAt")}
              <input {...invalid("window")} className={opsInput} onChange={(event) => updateForm("closesAt", event.target.value)} type="datetime-local" value={form.closesAt} />
              {formError("window")}
            </label>
            <p className="text-xs text-ink-muted md:col-span-2">{t("form.windowHint")}</p>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void saveCohort()} type="button">{saving ? tCommon("saving") : tCommon("save")}</button>
          <p className="mt-3 text-xs text-ink-muted">{t("form.draftNote")}</p>
        </section>
      </div>

      <DeleteConfirmDialog onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && void deleteCohort(pendingDelete)} title={pendingDelete?.name ?? null} />
      <ConfirmDialog
        confirmDisabled={transitioning}
        confirmLabel={transitioning ? tCommon("saving") : t(`transition.${pendingKey}.confirm`)}
        description={t(`transition.${pendingKey}.description`)}
        eyebrow={t("transition.eyebrow")}
        onCancel={() => { if (!transitioning) setPendingTransition(null); }}
        onConfirm={() => void runTransition()}
        open={pendingTransition !== null}
        title={t(`transition.${pendingKey}.title`, { name: pendingTransition?.cohort.name ?? "" })}
      >
        {transitionError ? <p className="mt-3 text-sm font-semibold text-danger" role="alert">{tErrors(transitionError)}</p> : null}
      </ConfirmDialog>
    </>
  );
}
