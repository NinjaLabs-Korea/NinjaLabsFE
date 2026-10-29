"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { OpsRunner } from "@/components/admin/BountyOperations";
import { opsButton, opsDangerButton, opsPanel, opsPanelEyebrow, opsPanelTitle, opsPrimaryButton } from "@/components/admin/ops-ui";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LIFECYCLE_BLOCKER_CODES, type AdminOperations, type LifecycleBlocker } from "@/lib/admin-operations";

/** Lifecycle: every transition the BE allows from the current status, each with its localized blockers (button disabled while blocked). */
export function OpsLifecyclePanel({ ops, busy, run }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const blockerText = (blocker: LifecycleBlocker) =>
    (LIFECYCLE_BLOCKER_CODES as readonly string[]).includes(blocker.code)
      ? t(`blockers.${blocker.code}`, { count: blocker.count ?? 0 })
      : t("blockers.unknown", { code: blocker.code });

  // Like the other operations dialogs, the confirmation closes when a re-read shows the cancellation is no longer on offer (another admin moved
  // the bounty on, or a payout is now owed): confirming it would only answer INVALID_TRANSITION / a blocker error.
  const cancelAvailable = ops.lifecycle.allowedTransitions.includes("CANCELLED") && !ops.lifecycle.blockers.CANCELLED?.length;

  const transition = (to: string) =>
    run(`transition:${to}`, () => api.transitionAdminBounty(ops.bounty.id, to), {
      title: t("toast.transitionedTitle"),
      description: t("toast.transitionedDescription", { title: ops.bounty.title, status: t(`bountyStatuses.${to}`) }),
    }, "transition");

  return (
    <section aria-labelledby="ops-lifecycle-title" className={opsPanel}>
      <p className={opsPanelEyebrow}>{t("lifecycle.eyebrow")}</p>
      <h3 className={opsPanelTitle} id="ops-lifecycle-title">{t("lifecycle.title")}</h3>
      {ops.lifecycle.allowedTransitions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("lifecycle.none")}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ops.lifecycle.allowedTransitions.map((to) => {
            const blockers = ops.lifecycle.blockers[to] ?? [];
            const cancel = to === "CANCELLED";
            const pending = busy.has(`transition:${to}`);
            return (
              <li className="rounded-tile border border-border p-4" key={to}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{t("lifecycle.to", { status: t(`bountyStatuses.${to}`) })}</p>
                  <button
                    aria-describedby={blockers.length ? `ops-blockers-${to}` : undefined}
                    className={cancel ? opsDangerButton : blockers.length ? opsButton : opsPrimaryButton}
                    disabled={pending || blockers.length > 0}
                    onClick={() => (cancel ? setConfirmCancel(true) : void transition(to))}
                    type="button"
                  >
                    {pending ? t("working") : t(`lifecycle.actions.${to}`)}
                  </button>
                </div>
                {blockers.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-warning" id={`ops-blockers-${to}`}>
                    {blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blockerText(blocker)}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-ink-muted">{t(`lifecycle.hints.${to}`)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        calloutText={t("lifecycle.cancelCallout")}
        confirmLabel={t("lifecycle.actions.CANCELLED")}
        description={t("lifecycle.cancelDescription", { title: ops.bounty.title })}
        destructive
        eyebrow={t("lifecycle.eyebrow")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); void transition("CANCELLED"); }}
        open={confirmCancel && cancelAvailable}
        title={t("lifecycle.cancelTitle")}
      />
    </section>
  );
}
