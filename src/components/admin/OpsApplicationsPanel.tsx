"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import type { OpsDateFormatter, OpsRunner } from "@/components/admin/BountyOperations";
import { OpsActorCell } from "@/components/admin/OpsActorCell";
import { OpsFormModal } from "@/components/admin/OpsFormModal";
import { opsButton, opsCell, opsDangerButton, opsPanel, opsPanelEyebrow, opsPanelTitle, opsTextarea } from "@/components/admin/ops-ui";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { OPS_NOTE_MAX, applicationDecisionsFor, type AdminOperations, type OpsApplication } from "@/lib/admin-operations";
import { safeHttpUrl } from "@/lib/api/codecs";

const columns = ["applicant", "message", "status", "applied", "action"] as const;
const appVariant = (status: string) => (status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "PENDING" ? "warning" : "neutral");

/** Applications: approve / reject with an optional note (BE APPLICATION_APPROVAL_CLOSED once intake has ended — only reject is offered then). */
export function OpsApplicationsPanel({ ops, busy, run, formatDate }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner; formatDate: OpsDateFormatter }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [target, setTarget] = useState<{ application: OpsApplication; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [note, setNote] = useState("");
  // Close the dialog when a re-read shows the application is no longer open to this decision (another admin got there first).
  const live = target ? ops.applications.find((item) => item.id === target.application.id) : undefined;
  const targetCurrent = target !== null && live !== undefined && applicationDecisionsFor(live, ops.bounty).includes(target.decision);

  const submit = async () => {
    if (!target) return;
    const { application, decision } = target;
    const ok = await run(`application:${application.id}`, () => api.reviewAdminApplication(application.id, { decision, note }), {
      title: decision === "APPROVED" ? t("toast.applicationApprovedTitle") : t("toast.applicationRejectedTitle"),
      description: application.agentName ?? application.nickname ?? "",
    });
    if (ok) setTarget(null);
  };

  return (
    <section aria-labelledby="ops-applications-title" className={opsPanel}>
      <p className={opsPanelEyebrow}>{t("applications.eyebrow")}</p>
      <h3 className={opsPanelTitle} id="ops-applications-title">{t("applications.title")}</h3>
      {ops.applications.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("applications.empty")}</p>
      ) : (
        <div className="mt-4">
          <AdminTable columns={columns.map((id) => ({ id, label: t(`applications.columns.${id}`) }))} minWidthClass="min-w-[860px]">
            {ops.applications.map((application) => {
              const decisions = applicationDecisionsFor(application, ops.bounty);
              const portfolio = safeHttpUrl(application.portfolioUrl);
              return (
                <tr className="border-t border-border" key={application.id}>
                  <td className={opsCell}><OpsActorCell actor={application} /></td>
                  <td className={`${opsCell} max-w-[320px]`}>
                    <p className="whitespace-pre-line break-words">{application.message}</p>
                    {portfolio ? <a className="mt-1 block break-all text-xs font-semibold text-primary-strong underline" href={portfolio} rel="noreferrer" target="_blank">{t("applications.portfolio")}</a> : null}
                    {application.reviewNote ? <p className="mt-2 text-xs text-ink-muted">{t("applications.reviewNote", { note: application.reviewNote })}</p> : null}
                  </td>
                  <td className={opsCell}><Badge variant={appVariant(application.status)}>{t(`applicationStatuses.${application.status}`)}</Badge></td>
                  <td className={opsCell}>{formatDate(application.appliedAt)}</td>
                  <td className={opsCell}>
                    <div className="flex flex-wrap gap-2">
                      {decisions.map((decision) => (
                        <button className={decision === "APPROVED" ? opsButton : opsDangerButton} disabled={busy.has(`application:${application.id}`)} key={decision} onClick={() => { setTarget({ application, decision }); setNote(""); }} type="button">
                          {t(`applications.actions.${decision}`)}
                        </button>
                      ))}
                      {application.status === "PENDING" && !decisions.includes("APPROVED") && decisions.length ? <p className="w-full text-xs text-ink-muted">{t("applications.approvalClosed")}</p> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </div>
      )}
      <OpsFormModal
        busy={target ? busy.has(`application:${target.application.id}`) : false}
        description={target ? t("applications.modalDescription", { name: target.application.agentName ?? target.application.nickname ?? "–" }) : undefined}
        eyebrow={t("applications.eyebrow")}
        onCancel={() => setTarget(null)}
        onSubmit={() => void submit()}
        open={targetCurrent}
        submitLabel={target ? t(`applications.actions.${target.decision}`) : ""}
        title={target?.decision === "APPROVED" ? t("applications.approveTitle") : t("applications.rejectTitle")}
      >
        <label className="block text-sm font-semibold text-ink">{t("form.noteOptional")}
          <textarea className={opsTextarea} maxLength={OPS_NOTE_MAX} onChange={(event) => setNote(event.target.value)} value={note} />
        </label>
      </OpsFormModal>
    </section>
  );
}
