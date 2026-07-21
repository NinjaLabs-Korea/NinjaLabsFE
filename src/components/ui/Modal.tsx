"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
};

export function Modal({ open, onClose, labelledBy, role, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
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
