"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { opsButton, opsCell, opsPrimaryButton, opsShort } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { NFT_JOB_STATUSES, opsErrorCode, type AdminNftJobPage, type NftJobStatus } from "@/lib/admin-operations";

const columns = ["job", "owner", "attempts", "lastError", "updated", "action"] as const;

/** NFT job console: FAILED (default) / PENDING / PROCESSING pages from GET /admin/nft-jobs, and retry for FAILED jobs. */
export function NftJobsManager({ children, tabs }: { children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.nftJobs");
  const tOps = useTranslations("admin.operations");
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [status, setStatus] = useState<NftJobStatus>("FAILED");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminNftJobPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // Only the newest request may write state: a slow FAILED page must not overwrite the PENDING page the operator switched to.
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    return api.getAdminNftJobs(status, page).then(
      (next) => {
        if (request !== latestRequest.current) return;
        // Retrying the last row of the last page shrinks the total: step back to the new last page instead of an empty page
        // whose pager is hidden (pages === 1) and would strand the operator.
        const lastPage = Math.max(1, Math.ceil(next.total / next.pageSize));
        if (next.items.length === 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(next);
        setFailed(false);
      },
      () => {
        if (request !== latestRequest.current) return;
        setFailed(true);
        pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") });
      },
    );
  }, [api, page, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (jobId: string) => {
    if (inFlight.current.has(jobId)) return;
    inFlight.current.add(jobId);
    setRetrying(new Set(inFlight.current));
    try {
      await api.retryAdminNftJob(jobId);
      pushAdminToast({ variant: "success", title: t("toast.retriedTitle"), description: t("toast.retriedDescription") });
    } catch (error) {
      const { code, known } = opsErrorCode(error);
      pushAdminToast({ variant: "danger", title: t("toast.retryFailedTitle"), description: known ? tOps(`errors.${code}`) : tOps("errors.unknown", { code }) });
    } finally {
      inFlight.current.delete(jobId);
      setRetrying(new Set(inFlight.current));
      await load();
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "–";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "–" : format.dateTime(date, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" });
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>{children}</div>
        <Badge variant="neutral">{tOps("adminOnlyBadge")}</Badge>
      </div>
      <div>{tabs}</div>
      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <div aria-label={t("filterLabel")} className="flex flex-wrap items-center gap-2" role="group">
          {NFT_JOB_STATUSES.map((option) => (
            <button aria-pressed={status === option} className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${status === option ? "bg-primary text-primary-soft" : "bg-primary-soft text-primary-strong"}`} key={option} onClick={() => { setStatus(option); setPage(1); }} type="button">
              {t(`statuses.${option}`)}
            </button>
          ))}
          <button className={`${opsButton} ml-auto`} onClick={() => void load()} type="button">{tOps("refresh")}</button>
        </div>
        <p className="mt-3 text-sm text-ink-muted">{t(`hints.${status}`)}</p>
      </section>
      <div className="mt-6">
        {data && data.items.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card">{t("empty")}</p>
        ) : !data ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">{failed ? t("toast.loadFailedDescription") : tOps("loading")}</p>
        ) : (
          <AdminTable columns={columns.map((id) => ({ id, label: t(`columns.${id}`) }))} minWidthClass="min-w-[960px]">
            {data.items.map((job) => (
              <tr className="border-t border-border" key={job.id}>
                <td className={opsCell}><p className="font-semibold text-ink">{t(`jobTypes.${job.jobType}`)}</p><p className="mt-1 text-xs text-ink-muted">{t("nftLine", { type: t(`nftTypes.${job.nftType}`), status: job.nftStatus })}</p>{job.bountyTitle ? <p className="mt-1 text-xs text-ink-muted">{job.bountyTitle}</p> : null}</td>
                <td className={opsCell}>{job.ownerNickname ?? "–"}<p className="mt-1 font-mono text-xs text-ink-muted" title={job.ownerWalletAddress ?? undefined}>{opsShort(job.ownerWalletAddress)}</p></td>
                <td className={opsCell}>{job.retryCount}</td>
                <td className={`${opsCell} max-w-[320px] break-words font-mono text-xs`}>{job.lastError ?? "–"}</td>
                <td className={opsCell}>{formatDate(job.updatedAt)}</td>
                <td className={opsCell}>{job.status === "FAILED" ? <button className={opsPrimaryButton} disabled={retrying.has(job.id)} onClick={() => void retry(job.id)} type="button">{retrying.has(job.id) ? tOps("working") : t("retry")}</button> : null}</td>
              </tr>
            ))}
          </AdminTable>
        )}
        {data && pages > 1 ? (
          <nav aria-label={t("pagination")} className="mt-4 flex items-center justify-end gap-3 text-sm text-ink-secondary">
            <button className={opsButton} disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">{t("previous")}</button>
            <span>{t("pageOf", { page, pages })}</span>
            <button className={opsButton} disabled={page >= pages} onClick={() => setPage((current) => current + 1)} type="button">{t("next")}</button>
          </nav>
        ) : null}
      </div>
    </>
  );
}
