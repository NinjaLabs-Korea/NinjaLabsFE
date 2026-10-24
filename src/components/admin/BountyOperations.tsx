"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { OpsApplicationsPanel } from "@/components/admin/OpsApplicationsPanel";
import { OpsLifecyclePanel } from "@/components/admin/OpsLifecyclePanel";
import { OpsPayoutsPanel } from "@/components/admin/OpsPayoutsPanel";
import { OpsRewardsPanel } from "@/components/admin/OpsRewardsPanel";
import { OpsSubmissionsPanel } from "@/components/admin/OpsSubmissionsPanel";
import { opsButton, opsDateTime } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { opsErrorCode, type AdminOperations } from "@/lib/admin-operations";

/** Runs one operations write: ignores a second click while the same key is in flight, toasts the outcome, re-reads the bounty. */
export type OpsRunner = (key: string, action: () => Promise<void>, success: { title: string; description?: string }, context?: "transition" | "other") => Promise<boolean>;
export type OpsDateFormatter = (value: string | null | undefined) => string;

const statusVariant = (status: string) =>
  status === "OPEN" ? "success" : status === "COMPLETED" ? "neutral" : status === "CANCELLED" ? "danger" : status === "DRAFT" ? "neutral" : "warning";

/** Per-bounty operations view: lifecycle, rewards, applications, submissions and payouts, all from GET /admin/bounties/:id/operations. */
export function BountyOperations({ bountyId, onStatusChange }: { bountyId: string; onStatusChange?: () => void }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [ops, setOps] = useState<AdminOperations | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  // Synchronous guard: two clicks in the same tick both see the old `busy` state.
  const inFlight = useRef(new Set<string>());

  const describe = useCallback((error: unknown, context: "transition" | "other" = "other"): string => {
    const { code, known } = opsErrorCode(error, context);
    return known ? t(`errors.${code}`) : t("errors.unknown", { code });
  }, [t]);

  // State is only set in the promise callbacks (never synchronously inside the effect).
  const load = useCallback(() => api.getAdminOperations(bountyId).then(
    (data) => {
      setOps(data);
      setLoadState("ready");
    },
    (error: unknown) => {
      setLoadState("failed");
      pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: describe(error) });
    },
  ), [api, bountyId, describe, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run: OpsRunner = async (key, action, success, context = "other") => {
    if (inFlight.current.has(key)) return false;
    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));
    try {
      await action();
      pushAdminToast({ variant: "success", title: success.title, description: success.description ?? "" });
      return true;
    } catch (error) {
      pushAdminToast({ variant: "danger", title: t("toast.actionFailedTitle"), description: describe(error, context) });
      return false;
    } finally {
      inFlight.current.delete(key);
      setBusy(new Set(inFlight.current));
      // Re-read on success AND failure: a 409/400 usually means the row moved under us (another admin, a resubmission).
      await load();
      if (context === "transition") onStatusChange?.();
    }
  };

  const formatDate: OpsDateFormatter = (value) => opsDateTime(format, value, timeZone);

  if (!ops) {
    return (
      <div className="mt-6 rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">
        {loadState === "failed" ? (
          <span className="flex flex-wrap items-center gap-3">{t("loadFailed")}<button className={opsButton} onClick={() => { setLoadState("loading"); void load(); }} type="button">{t("retry")}</button></span>
        ) : t("loading")}
      </div>
    );
  }

  return (
    <div>
      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card" aria-labelledby="ops-bounty-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("bountyEyebrow")}</p>
            <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink" id="ops-bounty-title">{ops.bounty.title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t("bountyMeta", { deadline: formatDate(ops.bounty.submissionDeadline), maxWinners: ops.bounty.maxWinners })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(ops.bounty.status)}>{t(`bountyStatuses.${ops.bounty.status}`)}</Badge>
            <button className={opsButton} onClick={() => void load()} type="button">{t("refresh")}</button>
          </div>
        </div>
      </section>
      <OpsLifecyclePanel busy={busy} ops={ops} run={run} />
      <OpsRewardsPanel busy={busy} formatDate={formatDate} ops={ops} run={run} />
      {ops.bounty.applicationRequired || ops.applications.length ? <OpsApplicationsPanel busy={busy} formatDate={formatDate} ops={ops} run={run} /> : null}
      <OpsSubmissionsPanel busy={busy} formatDate={formatDate} ops={ops} run={run} />
      <OpsPayoutsPanel busy={busy} formatDate={formatDate} ops={ops} run={run} />
    </div>
  );
}
