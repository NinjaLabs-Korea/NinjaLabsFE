"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { Toast } from "@/components/ui/Toast";

type AdminToast = {
  id: number;
  variant: "success" | "danger" | "warning" | "info";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

type AdminToastInput = Omit<AdminToast, "id">;

type ToastListener = (toast: AdminToast) => void;

const listeners = new Set<ToastListener>();
let nextToastId = 0;

export function pushAdminToast(toast: AdminToastInput) {
  const toastWithId = { ...toast, id: nextToastId++ };

  listeners.forEach((listener) => listener(toastWithId));
}

export function AdminToastHost() {
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  useEffect(() => {
    const addToast: ToastListener = (toast) => {
      setToasts((current) => [toast, ...current]);
    };

    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2.5">
      {toasts.map((toast) => (
        <DismissibleToast dismiss={dismissToast} key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function DismissibleToast({ dismiss, toast }: { dismiss: (id: number) => void; toast: AdminToast }) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismiss = toast.variant !== "danger";
  const onDismiss = useCallback(() => dismiss(toast.id), [dismiss, toast.id]);

  const clearDismissTimeout = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  }, []);

  const startDismissTimeout = useCallback(() => {
    if (autoDismiss) {
      clearDismissTimeout();
      timeout.current = setTimeout(onDismiss, 5000);
    }
  }, [autoDismiss, clearDismissTimeout, onDismiss]);

  useEffect(() => {
    startDismissTimeout();
    return clearDismissTimeout;
  }, [startDismissTimeout, clearDismissTimeout]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      startDismissTimeout();
    }
  };
  const handleAction = useCallback(() => {
    onDismiss();
    toast.onAction?.();
  }, [onDismiss, toast]);


  return (
    <div
      onBlurCapture={handleBlur}
      onFocusCapture={clearDismissTimeout}
      onMouseEnter={clearDismissTimeout}
      onMouseLeave={startDismissTimeout}
    >
      <Toast
        actionLabel={toast.actionLabel}
        description={toast.description}
        onAction={toast.actionLabel && toast.onAction ? handleAction : undefined}
        onDismiss={onDismiss}
        title={toast.title}
        variant={toast.variant}
      />
    </div>
  );
}
