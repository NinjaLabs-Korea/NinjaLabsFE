"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { BountyOperations } from "@/components/admin/BountyOperations";
import { opsButton } from "@/components/admin/ops-ui";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { useAdminApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import type { AdminBounty } from "@/lib/admin-helpers";

/** `?bounty=<id>` deep link (BountyManager's "Operations" action). Read after mount so the static page never depends on search params. */
function bountyFromLocation(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("bounty");
  } catch {
    return null;
  }
}

/** Bounty picker + the selected bounty's operations. Bounties come from the same GET /admin/bounties as BountyManager. */
export function OperationsConsole({ bounties: initial, children, tabs }: { bounties: AdminBounty[]; children: ReactNode; tabs: ReactNode }) {
  const api = useAdminApi();
  const t = useTranslations("admin.operations");
  const [bounties, setBounties] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  // api mode renders with no rows and reads GET /admin/bounties after mount — "no bounties yet" only once that read answered empty.
  const [listState, setListState] = useState<"loading" | "ready" | "failed">(initial.length ? "ready" : "loading");

  const loadBounties = useCallback(() => api.getAdminBounties().then(
    (rows) => {
      setBounties(rows);
      setListState("ready");
      setSelected((current) => {
        const wanted = current ?? bountyFromLocation();
        return wanted && rows.some((row) => row.slug === wanted) ? wanted : rows[0]?.slug ?? null;
      });
    },
    () => {
      setListState((current) => (current === "ready" ? current : "failed"));
      pushAdminToast({ variant: "danger", title: t("toast.bountiesFailedTitle"), description: t("toast.bountiesFailedDescription") });
    },
  ), [api, t]);

  useEffect(() => {
    void loadBounties();
  }, [loadBounties]);

  const select = (id: string) => {
    setSelected(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("bounty", id);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // history is optional; the picker state is the source of truth
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>{children}</div>
        <Badge variant="neutral">{t("adminOnlyBadge")}</Badge>
      </div>
      <div>{tabs}</div>
      <section className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        {bounties.length === 0 ? (
          listState === "failed" ? (
            <p className="flex flex-wrap items-center gap-3 text-sm text-ink-muted" role="status">{t("toast.bountiesFailedDescription")}<button className={opsButton} onClick={() => { setListState("loading"); void loadBounties(); }} type="button">{t("retry")}</button></p>
          ) : (
            <p className="text-sm text-ink-muted" role="status">{listState === "loading" ? t("loading") : t("noBounties")}</p>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-ink">{t("pickBounty")}</p>
            <AdminSelect formatOption={(id) => bounties.find((bounty) => bounty.slug === id)?.title ?? id} label={t("pickBounty")} onChange={select} options={bounties.map((bounty) => bounty.slug)} value={selected ?? bounties[0].slug} />
          </div>
        )}
      </section>
      {selected ? <BountyOperations bountyId={selected} key={selected} onStatusChange={() => void loadBounties()} /> : null}
    </>
  );
}
