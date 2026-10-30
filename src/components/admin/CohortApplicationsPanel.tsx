"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { CohortReviewDialog } from "@/components/admin/CohortReviewDialog";
import { opsButton, opsCell, opsDateTime, opsInput, opsPrimaryButton } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminCohortApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { cohortAdminErrorKey, type CohortAdminErrorKey } from "@/lib/cohort-errors";
import { COHORT_APPLICATION_SEARCH_MAX } from "@/lib/input-limits";
import {
  COHORT_APPLICATION_STATUSES,
  isChoiceType,
  isCohortApplicationStatus,
  localized,
  type AdminCohort,
  type AdminCohortApplication,
  type AdminCohortApplicationFilter,
  type AdminCohortApplicationPage,
  type CohortApplicationStatus,
  type CohortReviewDecision,
} from "@/lib/cohorts";

const ALL = "ALL";
const columns = ["applicant", "contact", "intro", "status", "applied", "action"] as const;
const statusVariant = { SUBMITTED: "warning", ACCEPTED: "success", REJECTED: "danger", WITHDRAWN: "neutral" } as const satisfies Record<CohortApplicationStatus, string>;

/** `cohort-2nd-applications-2026-10-27.csv`: a name a spreadsheet user can tell apart; the cohort name is slugged to ASCII-safe characters. */
function csvFileName(cohortName: string): string {
  const slug = cohortName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "cohort";
  return `${slug}-applications-${new Date().toISOString().slice(0, 10)}.csv`;
}

/** Saves text as a file in the browser (no server round trip: the CSV already came back from the BE). */
function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * The applications of one cohort: filters (status, one choice question + option, search), 30 per page, a review dialog per row
 * and a CSV export of the same filter. The table keeps the shared admin table rules (horizontal scroll on phones, nowrap actions).
 */
export function CohortApplicationsPanel({ cohort, onReviewed }: { cohort: AdminCohort; onReviewed: () => void }) {
  const api = useAdminCohortApi();
  const t = useTranslations("admin.recruitment.applications");
  const locale = useLocale();
  const tErrors = useTranslations(ERROR_COPY.adminCohort.messages);
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [status, setStatus] = useState<string>(ALL);
  const [questionId, setQuestionId] = useState<string>(ALL);
  const [optionId, setOptionId] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminCohortApplicationFilter>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminCohortApplicationPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [reviewing, setReviewing] = useState<AdminCohortApplication | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<CohortAdminErrorKey | null>(null);
  const [exporting, setExporting] = useState(false);
  // Only the newest request may write state (a slow page must not overwrite the filter the operator just applied).
  const latestRequest = useRef(0);
  // The page the rows on screen belong to: a failed fetch of another page steps back to it, so the pager never labels old rows with the new page.
  const shownPage = useRef(1);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    return api.getAdminCohortApplications(cohort.id, filter, page).then(
      (next) => {
        if (request !== latestRequest.current) return;
        shownPage.current = next.page;
        setData(next);
        setFailed(false);
      },
      () => {
        if (request !== latestRequest.current) return;
        setFailed(true);
        setPage(shownPage.current);
        pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") });
      },
    );
  }, [api, cohort.id, filter, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const choice = (value: string) => (value === ALL ? undefined : value);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const nextStatus = choice(status);
    setData(null);
    setFailed(false);
    shownPage.current = 1;
    setPage(1);
    setFilter({
      ...(nextStatus && isCohortApplicationStatus(nextStatus) ? { status: nextStatus } : {}),
      ...(choice(questionId) && choice(optionId) ? { questionId, optionId } : {}),
      ...(query.trim() ? { q: query.trim() } : {}),
    });
  };

  const reset = () => {
    setStatus(ALL);
    setQuestionId(ALL);
    setOptionId(ALL);
    setQuery("");
    setData(null);
    setFailed(false);
    shownPage.current = 1;
    setPage(1);
    setFilter({});
  };

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      downloadText(csvFileName(cohort.name), await api.exportAdminCohortApplications(cohort.id, filter));
    } catch (error) {
      pushAdminToast({ variant: "danger", title: t("toast.exportFailedTitle"), description: tErrors(cohortAdminErrorKey(error)) });
    } finally {
      setExporting(false);
    }
  };

  const review = async (input: { decision: CohortReviewDecision; note: string }) => {
    if (!reviewing || reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      await api.reviewAdminCohortApplication(reviewing.id, input);
      pushAdminToast({ variant: "success", title: t("toast.reviewedTitle"), description: t("toast.reviewedDescription", { name: reviewing.displayName, decision: t(`decisions.${input.decision}`) }) });
      setReviewing(null);
      onReviewed();
      await load();
    } catch (error) {
      setReviewError(cohortAdminErrorKey(error));
      // A withdrawn or vanished application: the row on screen is stale.
      void load();
    } finally {
      setReviewBusy(false);
    }
  };

  // Only choice questions can be filtered on: the option list follows the chosen question (a changed question clears the option).
  const choiceQuestions = cohort.questions.filter((question) => isChoiceType(question.type));
  const chosenQuestion = choiceQuestions.find((question) => question.id === questionId);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Object.keys(filter).length > 0;

  return (
    <section aria-labelledby="cohort-applications-heading" className="rounded-card border border-border bg-surface p-[21px] shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
          <h2 className="mt-2 break-words font-display text-2xl tracking-[-0.24px] text-ink" id="cohort-applications-heading">{t("heading", { name: cohort.name })}</h2>
        </div>
        <button className={opsButton} disabled={exporting} onClick={() => void exportCsv()} type="button">{exporting ? t("exporting") : t("export")}</button>
      </div>

      <form aria-label={t("filters.label")} className="mt-5 flex flex-wrap items-end gap-4" noValidate onSubmit={apply}>
        <div className="w-full sm:w-[180px]">
          <span className="block text-sm font-semibold text-ink">{t("filters.status")}</span>
          <div className="mt-2">
            <AdminSelect formatOption={(option) => (option === ALL ? t("filters.all") : t(`statuses.${option}`))} label={t("filters.status")} onChange={setStatus} options={[ALL, ...COHORT_APPLICATION_STATUSES]} value={status} />
          </div>
        </div>
        <div className="w-full sm:w-[220px]">
          <span className="block text-sm font-semibold text-ink">{t("filters.question")}</span>
          <div className="mt-2">
            <AdminSelect
              disabled={choiceQuestions.length === 0}
              formatOption={(option) => (option === ALL ? t("filters.all") : localized(choiceQuestions.find((question) => question.id === option)?.label ?? { ko: option, en: null, zh: null }, locale))}
              label={t("filters.question")}
              onChange={(next) => { setQuestionId(next); setOptionId(ALL); }}
              options={[ALL, ...choiceQuestions.map((question) => question.id)]}
              value={questionId}
            />
          </div>
        </div>
        <div className="w-full sm:w-[220px]">
          <span className="block text-sm font-semibold text-ink">{t("filters.option")}</span>
          <div className="mt-2">
            <AdminSelect
              disabled={!chosenQuestion}
              formatOption={(option) => (option === ALL ? t("filters.all") : localized(chosenQuestion?.options?.find((item) => item.id === option)?.label ?? { ko: option, en: null, zh: null }, locale))}
              key={questionId}
              label={t("filters.option")}
              onChange={setOptionId}
              options={[ALL, ...(chosenQuestion?.options ?? []).map((item) => item.id)]}
              value={optionId}
            />
          </div>
        </div>
        <div className="w-full sm:w-[260px]">
          <label className="block text-sm font-semibold text-ink" htmlFor="cohort-applications-q">{t("filters.search")}</label>
          <input className={opsInput} id="cohort-applications-q" maxLength={COHORT_APPLICATION_SEARCH_MAX} onChange={(event) => setQuery(event.target.value)} placeholder={t("filters.searchPlaceholder")} value={query} />
        </div>
        <div className="flex items-center gap-2">
          <button className={opsPrimaryButton} type="submit">{t("filters.apply")}</button>
          <button className={opsButton} onClick={reset} type="button">{t("filters.reset")}</button>
        </div>
      </form>

      <div className="mt-6">
        {!data ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">{failed ? t("toast.loadFailedDescription") : t("loading")}</p>
        ) : data.items.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card">{filtered ? t("emptyFiltered") : t("empty")}</p>
        ) : (
          <AdminTable columns={columns.map((id) => ({ id, label: t(`columns.${id}`) }))} minWidthClass="min-w-[980px]">
            {data.items.map((row) => (
              <tr className="border-t border-border" key={row.id}>
                <td className={`${opsCell} ${adminLongTextCell}`}>
                  <p className="font-semibold text-ink">{row.displayName}</p>
                  <p className="mt-1 text-xs text-ink-muted">{row.user.nickname}</p>
                  <p className="text-xs text-ink-muted">{row.user.email}</p>
                </td>
                <td className={`${opsCell} ${adminLongTextCell}`}>
                  <p>{row.telegram}</p>
                  <p className="mt-1">{row.twitter}</p>
                </td>
                <td className={`${opsCell} ${adminLongTextCell}`}><p className="line-clamp-3 whitespace-pre-wrap">{row.intro}</p></td>
                <td className={opsCell}><Badge variant={statusVariant[row.status]}>{t(`statuses.${row.status}`)}</Badge></td>
                <td className={`${opsCell} whitespace-nowrap`}>{opsDateTime(format, row.createdAt, timeZone)}</td>
                <td className={opsCell}>
                  {row.status === "WITHDRAWN" ? (
                    <span className="text-xs text-ink-muted">{t("withdrawnNote")}</span>
                  ) : (
                    <button className="h-11 rounded-control border border-primary-outline bg-surface px-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { setReviewError(null); setReviewing(row); }} type="button">{row.status === "SUBMITTED" ? t("review") : t("changeDecision")}</button>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
        {data && data.items.length > 0 ? <p className="mt-3 text-xs text-ink-muted">{t("total", { total: data.total })}</p> : null}
        {data && pages > 1 ? (
          <nav aria-label={t("pagination")} className="mt-4 flex items-center justify-end gap-3 text-sm text-ink-secondary">
            <button className={opsButton} disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">{t("previous")}</button>
            <span>{t("pageOf", { page, pages })}</span>
            <button className={opsButton} disabled={page >= pages} onClick={() => setPage((current) => current + 1)} type="button">{t("next")}</button>
          </nav>
        ) : null}
      </div>

      <CohortReviewDialog
        application={reviewing}
        busy={reviewBusy}
        error={reviewError}
        onCancel={() => { if (!reviewBusy) setReviewing(null); }}
        onConfirm={(input) => void review(input)}
      />
    </section>
  );
}
