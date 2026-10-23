"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
  /**
   * Where focus goes after close when the element that opened the dialog can no longer take it
   * (removed or disabled by the confirmed action, e.g. a revoked agent's buttons). Otherwise focus
   * returns to the opener, as the native `<dialog>` does.
   */
  returnFocusTo?: () => HTMLElement | null | undefined;
};

export function Modal({ open, onClose, labelledBy, describedBy, role, children, returnFocusTo }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  // Read through a ref so an inline `returnFocusTo={() => ...}` callback (new identity every render) never re-runs the
  // open/close effect: that would re-capture the opener (or re-close) on each parent render while the dialog is open.
  const returnFocusToRef = useRef(returnFocusTo);
  useEffect(() => {
    returnFocusToRef.current = returnFocusTo;
  });

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      wasOpenRef.current = true;
      dialog.showModal();
      return;
    }

    dialog.close();
    if (!wasOpenRef.current) {
      return;
    }
    wasOpenRef.current = false;
    const opener = openerRef.current;
    openerRef.current = null;
    const target = opener?.isConnected && !opener.matches(":disabled") ? opener : returnFocusToRef.current?.();
    target?.focus();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role={role}
      className="m-auto max-w-[440px] rounded-card border border-border bg-surface p-6 shadow-frame backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const dialog = dialogRef.current;

        if (event.target !== dialog || !dialog) {
          return;
        }

        const { bottom, left, right, top } = dialog.getBoundingClientRect();

        if (
          event.clientX < left ||
          event.clientX > right ||
          event.clientY < top ||
          event.clientY > bottom
        ) {
          onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
