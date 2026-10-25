"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { opsButton, opsCell, opsDateTime, opsInput, opsPrimaryButton, opsShort } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { AUDIT_ENTITY_TYPE_MAX, auditActorKind, isAuditUuid, type AdminAuditLog, type AdminAuditLogFilter, type AdminAuditLogPage } from "@/lib/admin-audit";

const columns = ["time", "actor", "action", "entity"] as const;

/** Read-only audit-log table (GET /admin/audit-logs): filter by entity type / UUID, newest first, 30 per page. */
export function AuditLogViewer({ children, tabs }: { children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.audit");
  const tOps = useTranslations("admin.operations");
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [filter, setFilter] = useState<AdminAuditLogFilter>({});
  const [invalidId, setInvalidId] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminAuditLogPage | null>(null);
  const [failed, setFailed] = useState(false);
  // Only the newest request may write state (a slow page must not overwrite the filter the operator just applied).
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    return api.getAdminAuditLogs(filter, page).then(
      (next) => {
        if (request !== latestRequest.current) return;
        setData(next);
        setFailed(false);
      },
      () => {
        if (request !== latestRequest.current) return;
        setFailed(true);
        pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") });
      },
    );
  }, [api, filter, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const id = entityId.trim();
    if (id && !isAuditUuid(id)) {
      setInvalidId(true);
      return;
    }
    setInvalidId(false);
    setData(null);
    setPage(1);
    setFilter({ ...(entityType.trim() ? { entityType: entityType.trim() } : {}), ...(id ? { entityId: id } : {}) });
  };

  const reset = () => {
    setEntityType("");
    setEntityId("");
    setInvalidId(false);
    setData(null);
    setPage(1);
    setFilter({});
  };

  const actorCell = (log: AdminAuditLog) => {
    const kind = auditActorKind(log);
    if (kind === "user") return <span className="font-mono text-xs" title={log.actorUserId ?? undefined}>{opsShort(log.actorUserId)}</span>;
    if (kind === "agent") return <span className="flex items-center gap-2"><Badge variant="neutral">{t("actors.agent")}</Badge><span className="font-mono text-xs" title={log.actorAgentId ?? undefined}>{opsShort(log.actorAgentId)}</span></span>;
    if (kind === "script") return <span className="flex items-center gap-2"><Badge variant="neutral">{t("actors.script")}</Badge>{log.actorUserId ? <span className="font-mono text-xs" title={log.actorUserId}>{opsShort(log.actorUserId)}</span> : null}</span>;
    return <Badge variant="neutral">{t("actors.unknown")}</Badge>;
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>{children}</div>
        <Badge variant="neutral">{tOps("adminOnlyBadge")}</Badge>
      </div>
      <div>{tabs}</div>
      <form aria-label={t("filterLabel")} className="mt-6 flex flex-wrap items-start gap-4 rounded-card border border-border bg-surface p-[21px] shadow-card" noValidate onSubmit={apply}>
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="audit-entity-type">{t("entityType")}</label>
          <input className={`${opsInput} sm:w-[220px]`} id="audit-entity-type" maxLength={AUDIT_ENTITY_TYPE_MAX} onChange={(event) => setEntityType(event.target.value)} placeholder={t("entityTypePlaceholder")} value={entityType} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="audit-entity-id">{t("entityId")}</label>
          <input aria-describedby={invalidId ? "audit-entity-id-error" : undefined} aria-invalid={invalidId} className={`${opsInput} font-mono sm:w-[360px]`} id="audit-entity-id" onChange={(event) => setEntityId(event.target.value)} placeholder={t("entityIdPlaceholder")} value={entityId} />
          {invalidId ? <p className="mt-1 text-xs text-danger" id="audit-entity-id-error" role="alert">{t("invalidEntityId")}</p> : null}
        </div>
        <div className="flex items-center gap-2 sm:mt-[26px]">
          <button className={opsPrimaryButton} type="submit">{t("apply")}</button>
          <button className={opsButton} onClick={reset} type="button">{t("reset")}</button>
          <button className={opsButton} onClick={() => void load()} type="button">{tOps("refresh")}</button>
        </div>
      </form>
      <div className="mt-6">
        {data && data.items.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card">{t("empty")}</p>
        ) : !data ? (
          <p className="rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">{failed ? t("toast.loadFailedDescription") : tOps("loading")}</p>
        ) : (
          <AdminTable columns={columns.map((id) => ({ id, label: t(`columns.${id}`) }))} minWidthClass="min-w-[820px]">
            {data.items.map((log) => (
              <tr className="border-t border-border" key={log.id}>
                <td className={opsCell}>{opsDateTime(format, log.createdAt, timeZone)}</td>
                <td className={opsCell}>{actorCell(log)}</td>
                <td className={`${opsCell} font-mono text-xs font-semibold text-ink`}>{log.action}</td>
                <td className={opsCell}>{log.entityType}<p className="mt-1 font-mono text-xs text-ink-muted" title={log.entityId ?? undefined}>{log.entityId ?? "–"}</p></td>
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
    </>
  );
}
