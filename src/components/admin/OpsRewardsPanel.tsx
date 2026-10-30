"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import type { OpsDateFormatter, OpsRunner } from "@/components/admin/BountyOperations";
import { OpsFormModal } from "@/components/admin/OpsFormModal";
import { opsAmount, opsCell, opsInput, opsPanel, opsPanelEyebrow, opsPanelTitle, opsPrimaryButton, opsShort } from "@/components/admin/ops-ui";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { rewardIntegerDigitsMax } from "@/lib/admin-bounty-form";
import { PENDING_MULTISIG_SETUP } from "@/lib/admin-helpers";
import { isTxHash, type AdminOperations, type OpsReward } from "@/lib/admin-operations";
import { operatorAmountFromBaseUnits, operatorAmountToBaseUnits, tokenDecimalsFor } from "@/lib/api/codecs";

const columns = ["token", "status", "posted", "deposited", "allocated", "depositTx", "action"] as const;
const rewardVariant = (status: string) => (status === "DEPOSIT_PENDING" ? "warning" : status === "PAID" ? "neutral" : status === "FUNDED" || status === "PARTIALLY_PAID" ? "success" : "danger");

type DepositForm = { txHash: string; amount: string; errors: { txHash?: string; amount?: string } };

/** Rewards: deposit status per reward and the manual multisig deposit confirmation (tx hash + amount → base units via codecs). */
export function OpsRewardsPanel({ ops, busy, run, formatDate }: { ops: AdminOperations; busy: ReadonlySet<string>; run: OpsRunner; formatDate: OpsDateFormatter }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [target, setTarget] = useState<OpsReward | null>(null);
  const [form, setForm] = useState<DepositForm>({ txHash: "", amount: "", errors: {} });

  const open = (reward: OpsReward) => {
    setTarget(reward);
    setForm({ txHash: "", amount: operatorAmountFromBaseUnits(reward.amount, reward.symbol), errors: {} });
  };

  // Close the dialog when a re-read shows the reward is no longer awaiting its deposit (another admin confirmed it first): confirming again only answers an error.
  const live = target ? ops.rewards.find((item) => item.id === target.id) : undefined;
  const targetCurrent = live?.status === "DEPOSIT_PENDING";

  const multisigMissing = target?.custodyAddress === PENDING_MULTISIG_SETUP;

  const submit = async () => {
    if (!target || !live || multisigMissing) return;
    const depositedAmount = operatorAmountToBaseUnits(form.amount, target.symbol);
    const errors: DepositForm["errors"] = {};
    if (!isTxHash(form.txHash)) errors.txHash = t("form.txHashInvalid");
    if (!depositedAmount) errors.amount = t(tokenDecimalsFor(target.symbol) === null ? "form.amountInvalidBaseUnits" : "form.amountInvalid", { symbol: target.symbol });
    else if (depositedAmount.length > 30) errors.amount = t("form.amountTooLarge", { digits: rewardIntegerDigitsMax(tokenDecimalsFor(target.symbol) ?? 0) });
    else if (BigInt(depositedAmount) < BigInt(live.amount)) errors.amount = t("rewards.amountBelowPosted", { amount: opsAmount(live.amount, live.symbol) });
    if (errors.txHash || errors.amount) {
      setForm((current) => ({ ...current, errors }));
      return;
    }
    const ok = await run(`deposit:${target.id}`, () => api.confirmAdminDeposit(target.id, { txHash: form.txHash, depositedAmount: depositedAmount! }), {
      title: t("toast.depositConfirmedTitle"),
      description: opsAmount(depositedAmount, target.symbol),
    });
    if (ok) setTarget(null);
  };

  return (
    <section aria-labelledby="ops-rewards-title" className={opsPanel}>
      <p className={opsPanelEyebrow}>{t("rewards.eyebrow")}</p>
      <h3 className={opsPanelTitle} id="ops-rewards-title">{t("rewards.title")}</h3>
      <p className="mt-2 text-sm text-ink-muted">{t("rewards.description")}</p>
      {ops.rewards.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">{t("rewards.empty")}</p>
      ) : (
        <div className="mt-4">
          <AdminTable columns={columns.map((id) => ({ id, label: t(`rewards.columns.${id}`) }))} minWidthClass="min-w-[880px]">
            {ops.rewards.map((reward) => (
              <tr className="border-t border-border" key={reward.id}>
                <td className={`${opsCell} font-semibold text-ink`}>{reward.symbol}<p className="mt-1 text-xs font-normal text-ink-muted" title={reward.custodyAddress === PENDING_MULTISIG_SETUP ? undefined : (reward.custodyAddress ?? undefined)}>{reward.custodyAddress === PENDING_MULTISIG_SETUP ? <span className="font-semibold text-warning">{t("rewards.multisigNotConfigured")}</span> : t("rewards.custody", { address: opsShort(reward.custodyAddress) })}</p></td>
                <td className={opsCell}><Badge variant={rewardVariant(reward.status)}>{t(`rewardStatuses.${reward.status}`)}</Badge></td>
                <td className={opsCell}>{opsAmount(reward.amount, reward.symbol)}</td>
                <td className={opsCell}>{opsAmount(reward.depositedAmount, reward.symbol)}<p className="mt-1 text-xs text-ink-muted">{formatDate(reward.depositedAt)}</p></td>
                <td className={opsCell}>{reward.cap ? t("rewards.allocatedOf", { allocated: opsAmount(reward.allocated, reward.symbol), cap: opsAmount(reward.cap, reward.symbol) }) : "–"}</td>
                <td className={`${opsCell} font-mono text-xs`} title={reward.depositTxHash ?? undefined}>{opsShort(reward.depositTxHash)}</td>
                <td className={opsCell}>
                  {reward.status === "DEPOSIT_PENDING" ? (
                    <button className={opsPrimaryButton} disabled={busy.has(`deposit:${reward.id}`) || reward.custodyAddress === PENDING_MULTISIG_SETUP} onClick={() => open(reward)} type="button">{t("rewards.confirm")}</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}
      <OpsFormModal
        busy={target ? busy.has(`deposit:${target.id}`) : false}
        callout={multisigMissing ? { tone: "warning", text: t("rewards.multisigNotConfigured") } : undefined}
        submitDisabled={multisigMissing}
        description={target && !multisigMissing ? t("rewards.modalDescription", { amount: opsAmount(target.amount, target.symbol), address: target.custodyAddress ?? "–" }) : undefined}
        eyebrow={t("rewards.eyebrow")}
        onCancel={() => setTarget(null)}
        onSubmit={() => void submit()}
        open={targetCurrent}
        submitLabel={t("rewards.confirm")}
        title={t("rewards.modalTitle")}
      >
        <label className="block text-sm font-semibold text-ink">{t("form.txHash")}
          <input aria-describedby={form.errors.txHash ? "ops-deposit-tx-error" : undefined} aria-invalid={form.errors.txHash ? true : undefined} autoComplete="off" className={`${opsInput} font-mono`} onChange={(event) => setForm((current) => ({ ...current, txHash: event.target.value, errors: { ...current.errors, txHash: undefined } }))} placeholder="0x…" spellCheck={false} type="text" value={form.txHash} />
          {form.errors.txHash ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-deposit-tx-error" role="alert">{form.errors.txHash}</span> : null}
        </label>
        <label className="block text-sm font-semibold text-ink">{t("rewards.depositedAmount", { symbol: target?.symbol ?? "" })}
          <input aria-describedby={form.errors.amount ? "ops-deposit-amount-error" : "ops-deposit-amount-hint"} aria-invalid={form.errors.amount ? true : undefined} className={opsInput} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value, errors: { ...current.errors, amount: undefined } }))} type="text" value={form.amount} />
          {form.errors.amount ? <span className="mt-1 block text-xs font-normal text-danger" id="ops-deposit-amount-error" role="alert">{form.errors.amount}</span> : <span className="mt-1 block text-xs font-normal text-ink-muted" id="ops-deposit-amount-hint">{t(target && tokenDecimalsFor(target.symbol) === null ? "form.amountHintBaseUnits" : "form.amountHint")}</span>}
        </label>
      </OpsFormModal>
    </section>
  );
}
