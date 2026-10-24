"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { AdminTable } from "@/components/admin/AdminTable";
import type { OpsDateFormatter, OpsRunner } from "@/components/admin/BountyOperations";
import { OpsFormModal } from "@/components/admin/OpsFormModal";
import { opsAmount, opsButton, opsCell, opsInput, opsPanel, opsPanelEyebrow, opsPanelTitle, opsPrimaryButton, opsShort } from "@/components/admin/ops-ui";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import {
  canApprovePayout,
  canMarkPayoutPaid,
  isBountyInProgress,
  isRewardFunded,
  isTxHash,
  payoutApprovalMode,
  payoutCandidates,
  rewardHeadroom,
  type AdminOperations,
  type OpsPayout,
  type OpsReward,
} from "@/lib/admin-operations";
import { baseUnitsToHuman, humanToBaseUnits } from "@/lib/api/codecs";

const columns = ["recipient", "amount", "status", "requested", "approved", "tx", "action"] as const;
const payoutVariant = (status: string) => (status === "PAID" ? "success" : status === "FAILED" || status === "CANCELLED" ? "danger" : status === "APPROVED" ? "primary-soft" : "warning");

type Dialog =
  | { kind: "request"; reward: OpsReward; submissionId: string; amount: string; error?: string }
  | { kind: "approve"; payout: OpsPayout }
  | { kind: "paid"; payout: OpsPayout; txHash: string; error?: string };

/**
 * Payouts: request one for an approved submission (amount in base units via codecs, capped by the reward's headroom), approve it
 * (two-person rule: the requesting admin sees why they cannot — PAYOUT_SELF_APPROVAL — unless the deployment allows self-approval,
 * which is then audited), and record the multisig transfer's tx hash.
 */
export function OpsPayoutsPanel({ ops, busy, run, formatDate }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner; formatDate: OpsDateFormatter }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const submissionName = (id: string) => {
    const submission = ops.submissions.find((item) => item.id === id);
    return submission ? submission.agentName ?? submission.nickname ?? id : id;
  };
  const requestable = isBountyInProgress(ops.bounty.status) ? ops.rewards.filter(isRewardFunded) : [];

  const openRequest = (reward: OpsReward) => {
    const candidates = payoutCandidates(ops, reward.id);
    const headroom = rewardHeadroom(reward);
    setDialog({ kind: "request", reward, submissionId: candidates[0]?.id ?? "", amount: headroom && headroom !== "0" ? baseUnitsToHuman(headroom, reward.symbol) ?? "" : "" });
  };

  const submit = async () => {
    if (!dialog) return;
    if (dialog.kind === "request") {
      const amount = humanToBaseUnits(dialog.amount, dialog.reward.symbol);
      const headroom = rewardHeadroom(dialog.reward);
      if (!amount) return setDialog({ ...dialog, error: t("form.amountInvalid", { symbol: dialog.reward.symbol }) });
      if (headroom !== null && BigInt(amount) > BigInt(headroom)) return setDialog({ ...dialog, error: t("payouts.amountOverHeadroom", { amount: opsAmount(headroom, dialog.reward.symbol) }) });
      const ok = await run(`request:${dialog.reward.id}`, () => api.requestAdminPayout({ rewardId: dialog.reward.id, submissionId: dialog.submissionId, amount }), {
        title: t("toast.payoutRequestedTitle"),
        description: t("toast.payoutRequestedDescription", { amount: opsAmount(amount, dialog.reward.symbol), name: submissionName(dialog.submissionId) }),
      });
      if (ok) setDialog(null);
      return;
    }
    if (dialog.kind === "approve") {
      const ok = await run(`payout:${dialog.payout.id}`, () => api.approveAdminPayout(dialog.payout.id), { title: t("toast.payoutApprovedTitle"), description: opsAmount(dialog.payout.amount, dialog.payout.symbol) });
      if (ok) setDialog(null);
      return;
    }
    if (!isTxHash(dialog.txHash)) return setDialog({ ...dialog, error: t("form.txHashInvalid") });
    const ok = await run(`payout:${dialog.payout.id}`, () => api.markAdminPayoutPaid(dialog.payout.id, dialog.txHash), { title: t("toast.payoutPaidTitle"), description: opsAmount(dialog.payout.amount, dialog.payout.symbol) });
    if (ok) setDialog(null);
  };

  const busyKey = !dialog ? "" : dialog.kind === "request" ? `request:${dialog.reward.id}` : `payout:${dialog.payout.id}`;
  const approveMode = dialog?.kind === "approve" ? payoutApprovalMode(dialog.payout, ops.policy) : "normal";

  return (
    <section aria-labelledby="ops-payouts-title" className={opsPanel}>
      <p className={opsPanelEyebrow}>{t("payouts.eyebrow")}</p>
      <h3 className={opsPanelTitle} id="ops-payouts-title">{t("payouts.title")}</h3>
      <p className="mt-2 text-sm text-ink-muted">{ops.policy.payoutSelfApprovalAllowed ? t("payouts.policySelfAllowed") : t("payouts.policyTwoPerson")}</p>
      {requestable.length ? (
        <ul className="mt-4 flex flex-wrap gap-3">
          {requestable.map((reward) => {
            const candidates = payoutCandidates(ops, reward.id);
            const headroom = rewardHeadroom(reward);
            return (
              <li className="flex flex-wrap items-center gap-3 rounded-tile border border-border px-4 py-3 text-sm" key={reward.id}>
                <span className="text-ink-secondary">{t("payouts.headroom", { amount: opsAmount(headroom, reward.symbol) })}</span>
                <button className={opsPrimaryButton} disabled={!candidates.length || headroom === "0" || busy.has(`request:${reward.id}`)} onClick={() => openRequest(reward)} type="button">{t("payouts.request")}</button>
                {!candidates.length ? <span className="text-xs text-ink-muted">{t("payouts.noCandidates")}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {ops.payouts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("payouts.empty")}</p>
      ) : (
        <div className="mt-4">
          <AdminTable columns={columns.map((id) => ({ id, label: t(`payouts.columns.${id}`) }))} minWidthClass="min-w-[980px]">
            {ops.payouts.map((payout) => {
              const mode = payoutApprovalMode(payout, ops.policy);
              const pending = busy.has(`payout:${payout.id}`);
              return (
                <tr className="border-t border-border" key={payout.id}>
                  <td className={opsCell}><p className="font-semibold text-ink">{submissionName(payout.submissionId)}</p><p className="mt-1 font-mono text-xs text-ink-muted" title={payout.recipientAddress}>{opsShort(payout.recipientAddress)}</p></td>
                  <td className={opsCell}>{opsAmount(payout.amount, payout.symbol)}</td>
                  <td className={opsCell}><Badge variant={payoutVariant(payout.status)}>{t(`payoutStatuses.${payout.status}`)}</Badge></td>
                  <td className={opsCell}>{payout.requestedByMe ? t("payouts.byYou") : payout.requestedByNickname ?? "–"}<p className="mt-1 text-xs text-ink-muted">{formatDate(payout.requestedAt)}</p></td>
                  <td className={opsCell}>{payout.approvedByNickname ?? "–"}<p className="mt-1 text-xs text-ink-muted">{payout.approvedAt ? formatDate(payout.approvedAt) : ""}</p></td>
                  <td className={`${opsCell} font-mono text-xs`} title={payout.txHash ?? undefined}>{opsShort(payout.txHash)}{payout.paidAt ? <p className="mt-1 font-sans text-ink-muted">{formatDate(payout.paidAt)}</p> : null}</td>
                  <td className={opsCell}>
                    <div className="flex flex-wrap gap-2">
                      {canApprovePayout(payout) ? (
                        mode === "self-blocked" ? (
                          <p className="max-w-[220px] text-xs font-semibold text-warning" id={`ops-payout-self-${payout.id}`}>{t("payouts.selfBlocked")}</p>
                        ) : (
                          <button className={opsButton} disabled={pending} onClick={() => setDialog({ kind: "approve", payout })} type="button">{t("payouts.approve")}</button>
                        )
                      ) : null}
                      {canMarkPayoutPaid(payout) ? <button className={opsPrimaryButton} disabled={pending} onClick={() => setDialog({ kind: "paid", payout, txHash: "" })} type="button">{t("payouts.markPaid")}</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </div>
      )}
      <OpsFormModal
        busy={busyKey ? busy.has(busyKey) : false}
        callout={approveMode === "self-allowed" ? { tone: "warning", text: t("payouts.selfAllowedCallout") } : undefined}
        description={
          dialog?.kind === "request" ? t("payouts.requestDescription", { amount: opsAmount(rewardHeadroom(dialog.reward), dialog.reward.symbol) })
            : dialog?.kind === "approve" ? t("payouts.approveDescription", { amount: opsAmount(dialog.payout.amount, dialog.payout.symbol), address: dialog.payout.recipientAddress })
              : dialog?.kind === "paid" ? t("payouts.paidDescription", { amount: opsAmount(dialog.payout.amount, dialog.payout.symbol), address: dialog.payout.recipientAddress })
                : undefined
        }
        eyebrow={t("payouts.eyebrow")}
        onCancel={() => setDialog(null)}
        onSubmit={() => void submit()}
        open={dialog !== null}
        submitLabel={dialog?.kind === "request" ? t("payouts.request") : dialog?.kind === "approve" ? t("payouts.approve") : t("payouts.markPaid")}
        title={dialog?.kind === "request" ? t("payouts.requestTitle") : dialog?.kind === "approve" ? t("payouts.approveTitle") : t("payouts.paidTitle")}
      >
        {dialog?.kind === "request" ? (
          <>
            <div>
              <p className="text-sm font-semibold text-ink">{t("payouts.submission")}</p>
              <div className="mt-2 w-fit"><AdminSelect formatOption={submissionName} label={t("payouts.submission")} onChange={(submissionId) => setDialog({ ...dialog, submissionId })} options={payoutCandidates(ops, dialog.reward.id).map((item) => item.id)} value={dialog.submissionId} /></div>
            </div>
            <label className="block text-sm font-semibold text-ink">{t("payouts.amount", { symbol: dialog.reward.symbol })}
              <input aria-describedby={dialog.error ? "ops-payout-error" : "ops-payout-hint"} aria-invalid={dialog.error ? true : undefined} className={opsInput} inputMode="decimal" onChange={(event) => setDialog({ ...dialog, amount: event.target.value, error: undefined })} type="text" value={dialog.amount} />
              {dialog.error ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-payout-error" role="alert">{dialog.error}</span> : <span className="mt-1 block text-xs font-normal text-ink-muted" id="ops-payout-hint">{t("form.amountHint")}</span>}
            </label>
          </>
        ) : null}
        {dialog?.kind === "paid" ? (
          <label className="block text-sm font-semibold text-ink">{t("form.txHash")}
            <input aria-describedby={dialog.error ? "ops-paid-error" : undefined} aria-invalid={dialog.error ? true : undefined} autoComplete="off" className={`${opsInput} font-mono`} onChange={(event) => setDialog({ ...dialog, txHash: event.target.value, error: undefined })} placeholder="0x…" spellCheck={false} type="text" value={dialog.txHash} />
            {dialog.error ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-paid-error" role="alert">{dialog.error}</span> : null}
          </label>
        ) : null}
      </OpsFormModal>
    </section>
  );
}
