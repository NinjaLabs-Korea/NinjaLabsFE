"use client";

import { useId, type ReactNode } from "react";

import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  eyebrow: string;
  title: string;
  description: ReactNode;
  calloutText?: string;
  confirmLabel: string;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  eyebrow,
  title,
  description,
  calloutText,
  confirmLabel,
  destructive = false,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Modal
      labelledBy={titleId}
      onClose={onCancel}
      open={open}
      role={destructive ? "alertdialog" : undefined}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.96px] ${
          destructive ? "text-danger" : "text-primary"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        id={titleId}
        className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink"
      >
        {title}
      </h2>
      <div className="mt-2 text-sm text-ink-muted">{description}</div>
      {calloutText ? (
        <div className="mt-4 rounded-tile border border-border bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {calloutText}
        </div>
      ) : null}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          className="rounded-control border border-primary-outline bg-surface px-5 py-3 text-sm font-semibold leading-[21px] text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`rounded-control px-5 py-3 text-sm font-semibold leading-[21px] text-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            destructive ? "bg-danger" : "bg-primary"
          }`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
