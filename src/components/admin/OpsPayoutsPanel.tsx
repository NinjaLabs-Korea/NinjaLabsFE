"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
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
import { operatorAmountFromBaseUnits, operatorAmountToBaseUnits, tokenDecimalsFor } from "@/lib/api/codecs";

const columns = ["recipient", "amount", "status", "requested", "approved", "tx", "action"] as const;
const payoutVariant = (status: string) => (status === "PAID" ? "success" : status === "FAILED" || status === "CANCELLED" ? "danger" : status === "APPROVED" ? "primary-soft" : "warning");

/** Below Tailwind's `md` (768px) the payouts render as cards: the 7-column table needs ~980px and a phone would show only the first column. */
const NARROW_QUERY = "(max-width: 767.98px)";
function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const list = window.matchMedia(NARROW_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
const getNarrow = () => (typeof window.matchMedia === "function" ? window.matchMedia(NARROW_QUERY).matches : false);
const getNarrowServer = () => false;

type Dialog =
  | { kind: "request"; reward: OpsReward; submissionId: string; amount: string; error?: string; walletError?: string }
  | { kind: "approve"; payout: OpsPayout }
  | { kind: "paid"; payout: OpsPayout; txHash: string; error?: string };

/**
 * Payouts: request one for an approved submission (amount in base units via codecs, capped by the reward's headroom), approve it
 * (two-person rule: the requesting admin sees why they cannot - PAYOUT_SELF_APPROVAL - unless the deployment allows self-approval,
 * which is then audited), and record the multisig transfer's tx hash.
 */
export function OpsPayoutsPanel({ ops, busy, run, formatDate }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner; formatDate: OpsDateFormatter }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer);
  const submissionName = (id: string) => {
    const submission = ops.submissions.find((item) => item.id === id);
    return submission ? submission.agentName ?? submission.nickname ?? id : id;
  };
  const requestable = isBountyInProgress(ops.bounty.status) ? ops.rewards.filter(isRewardFunded) : [];

  const openRequest = (reward: OpsReward) => {
    const candidates = payoutCandidates(ops, reward.id);
    const headroom = rewardHeadroom(reward);
    setDialog({ kind: "request", reward, submissionId: (candidates.find((item) => item.recipientWalletAddress) ?? { id: "" }).id, amount: headroom && headroom !== "0" ? operatorAmountFromBaseUnits(headroom, reward.symbol) : "" });
  };

  const liveReward = dialog?.kind === "request" ? ops.rewards.find((item) => item.id === dialog.reward.id) : undefined;

  const submit = async () => {
    if (!dialog) return;
    if (dialog.kind === "request") {
      // The headroom is the reward's current one (a re-read after another admin's request shrinks it), not the snapshot from when the dialog opened.
      const reward = liveReward ?? dialog.reward;
      const amount = operatorAmountToBaseUnits(dialog.amount, reward.symbol);
      const headroom = rewardHeadroom(reward);
      // Validate the amount and the recipient wallet independently so both errors show at once (the BE answers 404
      // APPROVED_SUBMISSION_OR_WALLET_NOT_FOUND without an active primary wallet - say so before the round trip).
      const walletError = ops.submissions.find((item) => item.id === dialog.submissionId)?.recipientWalletAddress ? undefined : t("submissions.noWallet");
      const amountError = !amount ? t(tokenDecimalsFor(dialog.reward.symbol) === null ? "form.amountInvalidBaseUnits" : "form.amountInvalid", { symbol: dialog.reward.symbol })
        : headroom !== null && BigInt(amount) > BigInt(headroom) ? t("payouts.amountOverHeadroom", { amount: opsAmount(headroom, dialog.reward.symbol) }) : undefined;
      if (walletError || amountError || !amount) return setDialog({ ...dialog, error: amountError, walletError });
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

  // An approve / mark-paid dialog describes a payout in one status: close it when a re-read shows the payout moved on (another admin acted).
  const dialogPayout = dialog && dialog.kind !== "request" ? ops.payouts.find((item) => item.id === dialog.payout.id) : undefined;
  // A request dialog is stale once its reward stopped being requestable (bounty finished, reward not funded) or its submission got a payout meanwhile.
  const dialogCurrent = dialog === null ? false
    : dialog.kind === "request" ? requestable.some((item) => item.id === dialog.reward.id) && (dialog.submissionId === "" ? payoutCandidates(ops, dialog.reward.id).length > 0 : payoutCandidates(ops, dialog.reward.id).some((item) => item.id === dialog.submissionId))
      : dialogPayout !== undefined && (dialog.kind === "approve" ? canApprovePayout(dialogPayout) : canMarkPayoutPaid(dialogPayout));

  // One action renderer for the table cell and the phone card, so both layouts share the same rules and handlers.
  const payoutActions = (payout: OpsPayout) => {
    const mode = payoutApprovalMode(payout, ops.policy);
    const pending = busy.has(`payout:${payout.id}`);
    return (
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
    );
  };
  const recipientCell = (payout: OpsPayout) => (
    <>
      <p className="font-semibold text-ink [overflow-wrap:anywhere]">{submissionName(payout.submissionId)}</p>
      <p className="mt-1 font-mono text-xs text-ink-muted" title={payout.recipientAddress}>{opsShort(payout.recipientAddress)}</p>
    </>
  );
  const statusBadge = (payout: OpsPayout) => <Badge variant={payoutVariant(payout.status)}>{t(`payoutStatuses.${payout.status}`)}</Badge>;
  const requestedCell = (payout: OpsPayout) => <>{payout.requestedByMe ? t("payouts.byYou") : payout.requestedByNickname ?? "–"}<p className="mt-1 text-xs text-ink-muted">{formatDate(payout.requestedAt)}</p></>;
  const approvedCell = (payout: OpsPayout) => <>{payout.approvedByNickname ?? "–"}<p className="mt-1 text-xs text-ink-muted">{payout.approvedAt ? formatDate(payout.approvedAt) : ""}</p></>;
  const txCell = (payout: OpsPayout) => <>{opsShort(payout.txHash)}{payout.paidAt ? <p className="mt-1 font-sans text-ink-muted">{formatDate(payout.paidAt)}</p> : null}</>;

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
                <span className="min-w-0 text-ink-secondary [overflow-wrap:anywhere]">{t("payouts.headroom", { amount: opsAmount(headroom, reward.symbol) })}</span>
                <button className={opsPrimaryButton} disabled={!candidates.length || headroom === "0" || busy.has(`request:${reward.id}`)} onClick={() => openRequest(reward)} type="button">{t("payouts.request")}</button>
                {!candidates.length ? <span className="text-xs text-ink-muted">{t("payouts.noCandidates")}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {ops.payouts.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("payouts.empty")}</p>
      ) : narrow ? (
        <ul className="mt-4 space-y-3">
          {ops.payouts.map((payout) => (
            <li className="rounded-tile border border-border p-4 text-sm text-ink-secondary" data-payout-card key={payout.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{recipientCell(payout)}</div>
                {statusBadge(payout)}
              </div>
              <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                <dt className="font-semibold text-ink-notice">{t("payouts.columns.amount")}</dt>
                <dd className="[overflow-wrap:anywhere]">{opsAmount(payout.amount, payout.symbol)}</dd>
                <dt className="font-semibold text-ink-notice">{t("payouts.columns.requested")}</dt>
                <dd>{requestedCell(payout)}</dd>
                <dt className="font-semibold text-ink-notice">{t("payouts.columns.approved")}</dt>
                <dd>{approvedCell(payout)}</dd>
                <dt className="font-semibold text-ink-notice">{t("payouts.columns.tx")}</dt>
                <dd className="font-mono text-xs" title={payout.txHash ?? undefined}>{txCell(payout)}</dd>
              </dl>
              <div className="mt-3">{payoutActions(payout)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <AdminTable columns={columns.map((id) => ({ id, label: t(`payouts.columns.${id}`) }))} minWidthClass="min-w-[980px]">
            {ops.payouts.map((payout) => (
              <tr className="border-t border-border" key={payout.id}>
                <td className={opsCell}>{recipientCell(payout)}</td>
                <td className={opsCell}>{opsAmount(payout.amount, payout.symbol)}</td>
                <td className={opsCell}>{statusBadge(payout)}</td>
                <td className={opsCell}>{requestedCell(payout)}</td>
                <td className={opsCell}>{approvedCell(payout)}</td>
                <td className={`${opsCell} font-mono text-xs`} title={payout.txHash ?? undefined}>{txCell(payout)}</td>
                <td className={opsCell}>{payoutActions(payout)}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}
      <OpsFormModal
        busy={busyKey ? busy.has(busyKey) : false}
        callout={approveMode === "self-allowed" ? { tone: "warning", text: t("payouts.selfAllowedCallout") } : undefined}
        description={
          dialog?.kind === "request" ? t("payouts.requestDescription", { amount: opsAmount(rewardHeadroom(liveReward ?? dialog.reward), dialog.reward.symbol) })
            : dialog?.kind === "approve" ? t("payouts.approveDescription", { amount: opsAmount(dialog.payout.amount, dialog.payout.symbol), address: dialog.payout.recipientAddress })
              : dialog?.kind === "paid" ? t("payouts.paidDescription", { amount: opsAmount(dialog.payout.amount, dialog.payout.symbol), address: dialog.payout.recipientAddress })
                : undefined
        }
        eyebrow={t("payouts.eyebrow")}
        onCancel={() => setDialog(null)}
        onSubmit={() => void submit()}
        open={dialogCurrent}
        submitLabel={dialog?.kind === "request" ? t("payouts.request") : dialog?.kind === "approve" ? t("payouts.approve") : t("payouts.markPaid")}
        title={dialog?.kind === "request" ? t("payouts.requestTitle") : dialog?.kind === "approve" ? t("payouts.approveTitle") : t("payouts.paidTitle")}
      >
        {dialog?.kind === "request" ? (
          <>
            <div>
              <p className="text-sm font-semibold text-ink">{t("payouts.submission")}</p>
              <div className="mt-2 w-full max-w-full min-w-0"><AdminSelect formatOption={(id) => (id === "" ? t("payouts.submission") : ops.submissions.find((item) => item.id === id)?.recipientWalletAddress ? submissionName(id) : `${submissionName(id)} - ${t("submissions.noWallet")}`)} label={t("payouts.submission")} onChange={(submissionId) => setDialog({ ...dialog, submissionId, walletError: undefined })} options={payoutCandidates(ops, dialog.reward.id).map((item) => item.id)} value={dialog.submissionId} /></div>
              {dialog.walletError ? <p className="mt-1 text-xs font-normal text-danger" id="ops-payout-wallet-error" role="alert">{dialog.walletError}</p> : null}
            </div>
            <label className="block text-sm font-semibold text-ink">{t("payouts.amount", { symbol: dialog.reward.symbol })}
              <input aria-describedby={dialog.error ? "ops-payout-error" : "ops-payout-hint"} aria-invalid={dialog.error ? true : undefined} className={opsInput} inputMode="decimal" onChange={(event) => setDialog({ ...dialog, amount: event.target.value, error: undefined })} type="text" value={dialog.amount} />
              {dialog.error ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-payout-error" role="alert">{dialog.error}</span> : <span className="mt-1 block text-xs font-normal text-ink-muted" id="ops-payout-hint">{t(dialog.kind === "request" && tokenDecimalsFor(dialog.reward.symbol) === null ? "form.amountHintBaseUnits" : "form.amountHint")}</span>}
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
