"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { OpsApplicationsPanel } from "@/components/admin/OpsApplicationsPanel";
import { OpsLifecyclePanel } from "@/components/admin/OpsLifecyclePanel";
import { OpsPayoutsPanel } from "@/components/admin/OpsPayoutsPanel";
import { OpsRewardsPanel } from "@/components/admin/OpsRewardsPanel";
import { OpsSubmissionsPanel } from "@/components/admin/OpsSubmissionsPanel";
import { opsBountyStatusVariant, opsButton, opsDateTime, type OpsDateFormatter, type OpsRunner } from "@/components/admin/ops-ui";
import { useBrowserTimeZone } from "@/components/admin/useBrowserTimeZone";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { useKeyedSingleFlight } from "@/components/ui/useSingleFlight";
import { ApiHttpError } from "@/lib/api/http";
import { opsErrorCode, type AdminOperations } from "@/lib/admin-operations";

/** Per-bounty operations view: lifecycle, rewards, applications, submissions and payouts, all from GET /admin/bounties/:id/operations. */
export function BountyOperations({ bountyId, onStatusChange }: { bountyId: string; onStatusChange?: () => void }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const format = useFormatter();
  const timeZone = useBrowserTimeZone();
  const [ops, setOps] = useState<AdminOperations | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const { busy, run: runKeyed } = useKeyedSingleFlight();
  // Only the newest read may write state: Refresh / the re-read after an action can overlap, and an older answer landing last
  // would put back a payout or submission state the operator has already moved past.
  const latestLoad = useRef(0);

  const describe = useCallback((error: unknown, context: "transition" | "other" = "other"): string => {
    const { code, known } = opsErrorCode(error, context);
    // A BE 400 on a free-text note names what was wrong: say it instead of the generic "check the fields".
    if (code === "VALIDATION_FAILED" && error instanceof ApiHttpError) {
      const messages = error.details.join(" ");
      if (/bidirectional/i.test(messages)) return t("errors.NOTE_BIDI_CHARS");
      if (/forfeited/i.test(messages)) return t("errors.NOTE_RESERVED_PREFIX");
    }
    return known ? t(`errors.${code}`) : t("errors.unknown", { code });
  }, [t]);

  // State is only set in the promise callbacks (never synchronously inside the effect).
  const load = useCallback(() => {
    const request = ++latestLoad.current;
    return api.getAdminOperations(bountyId).then(
      (data) => {
        if (request !== latestLoad.current) return;
        setOps(data);
        setLoadState("ready");
      },
      (error: unknown) => {
        if (request !== latestLoad.current) return;
        setLoadState("failed");
        pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: describe(error) });
      },
    );
  }, [api, bountyId, describe, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run: OpsRunner = async (key, action, success, context = "other") =>
    // The key stays busy through the re-read: the dialog of a succeeded action is still open until the new state lands,
    // and a second click in that window would send the same write again and toast an error right after the success.
    (await runKeyed(key, async () => {
      try {
        await action();
        pushAdminToast({ variant: "success", title: success.title, description: success.description ?? "" });
        return true;
      } catch (error) {
        pushAdminToast({ variant: "danger", title: t("toast.actionFailedTitle"), description: describe(error, context) });
        return false;
      } finally {
        // Re-read on success AND failure: a 409/400 usually means the row moved under us (another admin, a resubmission).
        await load();
        if (context === "transition") onStatusChange?.();
      }
    })) ?? false;

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
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("bountyEyebrow")}</p>
            <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink [overflow-wrap:anywhere]" id="ops-bounty-title">{ops.bounty.title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t("bountyMeta", { deadline: formatDate(ops.bounty.submissionDeadline), maxWinners: ops.bounty.maxWinners })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={opsBountyStatusVariant(ops.bounty.status)}>{t(`bountyStatuses.${ops.bounty.status}`)}</Badge>
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
