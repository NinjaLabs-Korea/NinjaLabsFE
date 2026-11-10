"use client";

import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useBountyApi } from "@/components/auth/FoundationProvider";
import { roomyField } from "@/components/ui/field-classes";
import { useSingleFlight } from "@/components/ui/useSingleFlight";
import { ERROR_COPY, errorCopyKey } from "@/lib/api/error-copy";
import { CONTACT_EMAIL } from "@/lib/contact";
import type { PayoutAddressFields } from "@/lib/contracts/account";
import { isPayoutAddressShape } from "@/lib/injective-address";

const focusClass = "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primaryButtonClass = `rounded-control bg-primary px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-on-inverse disabled:opacity-60 ${focusClass}`;

/** True when the row carries the BE #69 payout fields for an own APPROVED submission, so the card can offer (or lock) the form. */
export function offersPayoutAddress(row: PayoutAddressFields): boolean {
  return Boolean(row.submissionId) && row.payoutAddressEditable !== undefined;
}

/** One saved form of the address, monospace and wrapping inside the card. */
function SavedAddress({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/**
 * Payout address of an APPROVED submission (`PUT /submissions/:id/payout-address`, BE #69). The winner enters a `0x` or `inj1`
 * address; the BE stores the `inj1` form and answers both, which are shown here. Editable while `payoutAddressEditable`
 * (no payout row yet), read-only with a contact hint once the BE locked it. The format pre-check only saves a round trip: the BE
 * is authoritative (checksum, zero address) and its codes map through `ERROR_COPY.payoutAddress`.
 */
export function PayoutAddressForm({ row, onChanged }: { row: PayoutAddressFields; onChanged: () => void }) {
  const t = useTranslations("account.applications.payout");
  const tErrors = useTranslations(ERROR_COPY.payoutAddress.messages);
  const format = useFormatter();
  const api = useBountyApi();
  const inputId = useId();
  const messageId = useId();
  const { busy, run } = useSingleFlight();
  const [value, setValue] = useState(row.payoutAddress ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const submissionId = row.submissionId ?? "";
  const address = row.payoutAddress ?? null;
  const unchanged = [row.payoutAddress, row.payoutAddressEvm].some((known) => known !== null && known !== undefined && known.toLowerCase() === value.trim().toLowerCase());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    if (!isPayoutAddressShape(value)) {
      setError(t("invalidFormat"));
      return;
    }
    setError("");
    void run(async () => {
      try {
        await api.setPayoutAddress(submissionId, value);
        setSaved(true);
        onChanged();
      } catch (caught) {
        const key = errorCopyKey(caught, ERROR_COPY.payoutAddress);
        setError(tErrors(key));
        // A lock or a changed status means this card is stale: re-read so it shows the real state (read-only, or gone).
        if (key === "PAYOUT_ADDRESS_LOCKED" || key === "SUBMISSION_NOT_APPROVED" || key === "SUBMISSION_NOT_FOUND") onChanged();
      }
    });
  };

  const saveBlock = address ? (
    <dl>
      <SavedAddress label={t("injLabel")} value={address} />
      {row.payoutAddressEvm ? <SavedAddress label={t("evmLabel")} value={row.payoutAddressEvm} /> : null}
      {row.payoutAddressUpdatedAt ? <p className="mt-2 text-xs text-ink-muted">{t("savedAt", { date: format.dateTime(new Date(row.payoutAddressUpdatedAt), { dateStyle: "medium" }) })}</p> : null}
    </dl>
  ) : null;

  if (!row.payoutAddressEditable) {
    return (
      <section aria-label={t("title")} className="mt-4 rounded-tile border border-border bg-surface-subtle p-4">
        <h3 className="text-sm font-bold text-ink">{t("title")}</h3>
        {saveBlock}
        <p className="mt-3 text-sm text-ink-muted">
          {t("lockedNote")}{" "}
          <a className={`font-semibold text-primary-strong underline ${focusClass}`} href={`mailto:${CONTACT_EMAIL}`}>{t("contact")}</a>
        </p>
      </section>
    );
  }

  return (
    <section aria-label={t("title")} className="mt-4 rounded-tile border border-border bg-surface-subtle p-4">
      <h3 className="text-sm font-bold text-ink">{t("title")}</h3>
      <p className="mt-1 text-sm text-ink-muted">{address ? t("introSaved") : t("intro")}</p>
      <p className="mt-1 text-sm text-warning">{t("warningNote")}</p>
      {saveBlock}
      <form className="mt-3" noValidate onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink" htmlFor={inputId}>{t("label")}</label>
        <input
          aria-describedby={error ? messageId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className={`${roomyField} font-mono`}
          id={inputId}
          maxLength={100}
          onChange={(event) => { setValue(event.target.value); setError(""); setSaved(false); }}
          placeholder={t("placeholder")}
          spellCheck={false}
          type="text"
          value={value}
        />
        {error ? <p className="mt-2 text-sm text-danger" id={messageId} role="alert">{error}</p> : null}
        <p className="sr-only" role="status">{saved ? t("saved") : ""}</p>
        {saved ? <p aria-hidden="true" className="mt-2 text-sm text-success">{t("saved")}</p> : null}
        <button aria-busy={busy || undefined} className={`mt-3 ${primaryButtonClass}`} disabled={busy || value.trim() === "" || unchanged} type="submit">
          {busy ? t("saving") : address ? t("saveChange") : t("save")}
        </button>
      </form>
    </section>
  );
}
