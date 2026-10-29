"use client";

import { useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type DeleteConfirmDialogProps = {
  /** Title of the record being deleted; `null` keeps the dialog closed. */
  title: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  /** Delete request in flight (spinner, confirm disabled). */
  pending?: boolean;
};

/** Admin delete confirmation (shared copy under `admin.common`), replacing `window.confirm`. */
export function DeleteConfirmDialog({ title, onCancel, onConfirm, pending }: DeleteConfirmDialogProps) {
  const t = useTranslations("admin.common");
  return (
    <ConfirmDialog
      calloutText={t("deleteCallout")}
      confirmLabel={t("delete")}
      description={t("deleteDescription")}
      destructive
      eyebrow={t("deleteEyebrow")}
      onCancel={onCancel}
      onConfirm={onConfirm}
      pending={pending}
      open={title !== null}
      title={t("deleteConfirm", { title: title ?? "" })}
    />
  );
}
