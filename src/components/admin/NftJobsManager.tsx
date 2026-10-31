"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { opsButton, opsDateTime, opsCell, opsPrimaryButton, opsShort } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { useKeyedSingleFlight } from "@/components/ui/useSingleFlight";
import { NFT_JOB_STATUSES, opsErrorCode, type AdminNftJobPage, type NftJobStatus } from "@/lib/admin-operations";

/** BE `nft.status` values with a label under `admin.nftJobs.nftStatuses`; anything else is shown as the BE sent it. */
const NFT_STATUSES = ["PENDING", "MINTING", "MINTED", "ATTACHING", "ATTACHED", "FAILED"] as const;
const isNftStatus = (value: string): value is (typeof NFT_STATUSES)[number] => (NFT_STATUSES as readonly string[]).includes(value);

const columns = ["job", "owner", "attempts", "lastError", "updated", "action"] as const;

/** NFT job console: FAILED (default) / PENDING / PROCESSING pages from GET /admin/nft-jobs, and retry for FAILED jobs. */
export function NftJobsManager({ children, tabs }: { children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.nftJobs");
  const tOps = useTranslations("admin.operations");
  const nftStatusLabel = (value: string) => (isNftStatus(value) ? t(`nftStatuses.${value}`) : value);
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [status, setStatus] = useState<NftJobStatus>("FAILED");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminNftJobPage | null>(null);
  const [failed, setFailed] = useState(false);
  const { isBusy: isRetrying, run: runRetry } = useKeyedSingleFlight();
  // Only the newest request may write state: a slow FAILED page must not overwrite the PENDING page the operator switched to.
  const latestRequest = useRef(0);
  // The page the rows on screen belong to: a failed fetch of another page steps back to it, so the pager never labels old rows with the new page.
  const shownPage = useRef(1);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    return api.getAdminNftJobs(status, page).then(
      (next) => {
        if (request !== latestRequest.current) return;
        // Retrying the last row of the last page shrinks the total: step back to the new last page instead of an empty page
        // whose pager is hidden (pages === 1) and would strand the operator.
        const lastPage = Math.max(1, Math.ceil(next.total / next.pageSize));
        if (next.items.length === 0 && page > lastPage) {
          shownPage.current = lastPage;
          setPage(lastPage);
          return;
        }
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
  }, [api, page, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // The key stays busy through the reload: the retried row is still on screen (with an enabled button) until the new page lands.
  const retry = (jobId: string) =>
    runRetry(jobId, async () => {
      try {
        await api.retryAdminNftJob(jobId);
        pushAdminToast({ variant: "success", title: t("toast.retriedTitle"), description: t("toast.retriedDescription") });
      } catch (error) {
        const { code, known } = opsErrorCode(error);
        pushAdminToast({ variant: "danger", title: t("toast.retryFailedTitle"), description: known ? tOps(`errors.${code}`) : tOps("errors.unknown", { code }) });
      } finally {
        await load();
      }
    });

  const formatDate = (value: string | null) => opsDateTime(format, value, timeZone);
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
            <button aria-pressed={status === option} className={`inline-flex h-6 items-center rounded-full max-sm:h-10 max-sm:px-4 px-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${status === option ? "bg-primary text-primary-soft" : "bg-primary-soft text-primary-strong"}`} key={option} onClick={() => {
              // Another status is another list: drop the old rows so FAILED jobs (with Retry) never sit under the Pending tab while it loads.
              if (option === status) return;
              setStatus(option);
              shownPage.current = 1;
              setPage(1);
              setData(null);
              setFailed(false);
            }} type="button">
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
                <td className={`${opsCell} ${adminLongTextCell}`}><p className="font-semibold text-ink">{t(`jobTypes.${job.jobType}`)}</p><p className="mt-1 text-xs text-ink-muted">{t("nftLine", { type: t(`nftTypes.${job.nftType}`), status: nftStatusLabel(job.nftStatus) })}</p>{job.bountyTitle ? <p className="mt-1 text-xs text-ink-muted">{job.bountyTitle}</p> : null}</td>
                <td className={`${opsCell} ${adminLongTextCell}`}>{job.ownerNickname ?? "–"}<p className="mt-1 font-mono text-xs text-ink-muted" title={job.ownerWalletAddress ?? undefined}>{opsShort(job.ownerWalletAddress)}</p></td>
                <td className={opsCell}>{job.retryCount}</td>
                <td className={`${opsCell} max-w-[320px] font-mono text-xs ${adminLongTextCell}`}>{job.lastError ?? "–"}</td>
                <td className={opsCell}>{formatDate(job.updatedAt)}</td>
                <td className={opsCell}>{job.status === "FAILED" ? <button className={opsPrimaryButton} disabled={isRetrying(job.id)} onClick={() => void retry(job.id)} type="button">{isRetrying(job.id) ? tOps("working") : t("retry")}</button> : null}</td>
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
