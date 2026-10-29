"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  // A `?bounty=<id>` link whose bounty is not in the list (typo, deleted since the link was shared): say so and select nothing,
  // instead of silently opening the first bounty where the admin could act on the wrong one.
  const [missing, setMissing] = useState<string | null>(null);
  const missingRef = useRef<string | null>(null);
  // api mode renders with no rows and reads GET /admin/bounties after mount - "no bounties yet" only once that read answered empty.
  const [listState, setListState] = useState<"loading" | "ready" | "failed">(initial.length ? "ready" : "loading");

  const loadBounties = useCallback(() => api.getAdminBounties().then(
    (rows) => {
      setBounties(rows);
      setListState("ready");
      setSelected((current) => {
        const fromLink = current === null ? bountyFromLocation() : null;
        const wanted = current ?? fromLink;
        if (wanted && rows.some((row) => row.slug === wanted)) return wanted;
        // Only the very first resolution reads the link; a later reload keeps "nothing selected" until the admin picks one.
        if (current === null && (fromLink || missingRef.current)) {
          missingRef.current = fromLink ?? missingRef.current;
          setMissing(missingRef.current);
          return null;
        }
        return rows[0]?.slug ?? null;
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
    missingRef.current = null;
    setMissing(null);
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
          <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-ink">{t("pickBounty")}</p>
            <AdminSelect formatOption={(id) => id === "" ? t("pickBountyPlaceholder") : bounties.find((bounty) => bounty.slug === id)?.title ?? id} label={t("pickBounty")} onChange={select} options={bounties.map((bounty) => bounty.slug)} value={selected ?? (missing ? "" : bounties[0].slug)} />
          </div>
          {missing ? <p className="mt-3 text-sm text-danger" role="alert">{t("bountyNotFound", { id: missing })}</p> : null}
          </>
        )}
      </section>
      {selected ? <BountyOperations bountyId={selected} key={selected} onStatusChange={() => void loadBounties()} /> : null}
    </>
  );
}
