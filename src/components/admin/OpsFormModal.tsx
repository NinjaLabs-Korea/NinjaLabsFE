"use client";

import { useTranslations } from "next-intl";
import { useId, type FormEvent, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { opsButton, opsPrimaryButton } from "@/components/admin/ops-ui";

type OpsFormModalProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /** Warning/danger callout above the fields (e.g. the two-person rule note). */
  callout?: { tone: "warning" | "danger"; text: string };
  submitLabel: string;
  busy: boolean;
  /** Disables submit without the in-flight label (e.g. the action cannot work until an operator fixes configuration). */
  submitDisabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  children?: ReactNode;
};

/** Form dialog for one operations action (ui/Modal: ESC, backdrop, focus return). The submit button shows `saving` while in flight. */
export function OpsFormModal({ open, eyebrow, title, description, callout, submitLabel, busy, submitDisabled, onCancel, onSubmit, children }: OpsFormModalProps) {
  const t = useTranslations("admin.common");
  const titleId = useId();
  const descriptionId = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && !submitDisabled) onSubmit();
  };
  return (
    <Modal describedBy={description ? descriptionId : undefined} labelledBy={titleId} onClose={onCancel} open={open}>
      <form noValidate onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink" id={titleId}>{title}</h2>
        {description ? <div className="mt-2 text-sm text-ink-muted" id={descriptionId}>{description}</div> : null}
        {callout ? (
          <div className={`mt-4 rounded-tile border border-border px-4 py-3 text-sm font-semibold ${callout.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}>{callout.text}</div>
        ) : null}
        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button className={opsButton} onClick={onCancel} type="button">{t("cancel")}</button>
          <button className={opsPrimaryButton} disabled={busy || submitDisabled} type="submit">{busy ? t("saving") : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
