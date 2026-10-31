"use client";

import { useTranslations } from "next-intl";
import type { AdminListLoadState } from "@/components/admin/useAdminList";
import { opsButton } from "@/components/admin/ops-ui";
import { PageLoading } from "@/components/ui/PageLoading";

/** Stands in for a manager's table until its first read answered: "Loading…", or the failure with a retry. Renders nothing once `ready`. */
export function AdminListStatus({ state, failedText, onRetry }: { state: AdminListLoadState; failedText: string; onRetry: () => void }) {
  const t = useTranslations("admin.common");
  if (state === "ready") return null;
  if (state === "loading") return <PageLoading label={t("loading")} variant="list" />;
  return (
    <p className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">
      {failedText}
      <button className={opsButton} onClick={onRetry} type="button">{t("retry")}</button>
    </p>
  );
}
