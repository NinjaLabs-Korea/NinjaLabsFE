"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { applicationStatusLabel, statusVariants } from "@/components/account/ApplicationsView";
import { useAccountApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import type { ApplicationStatus } from "@/lib/contracts/account";

/** How many of my latest rows the home lists; the rest is on /applications. */
const HOME_ACTIVITY_LIMIT = 4;

// `account.applications` keys of each status label (the same words as the My applications page, except that the compact
// home card keeps the short step names for approved rows). Rejected and not-accepted rows go through the shared label so a
// forfeited award reads the same here and on /applications.
const statusLabelKeys: Partial<Record<ApplicationStatus, string>> = {
  open: "steps.open",
  approved: "steps.approved",
  submitted: "steps.submitted",
  completed: "steps.completed",
  revisionRequested: "revisionRequestedStatus",
};

/** My bounty applications and submissions with their status (the latest few), linking to the full list. */
export function HomeActivity() {
  const t = useTranslations("home.activity");
  const tApplications = useTranslations("account.applications");
  const format = useFormatter();
  const api = useAccountApi();
  const query = useAccountQuery(api.getApplications);
  const rows = [...(query.data ?? [])].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, HOME_ACTIVITY_LIMIT);
  return (
    <section className="mx-auto max-w-content px-6 pt-16">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/applications" }} />
      {query.loading ? (
        <p className="mt-7 text-sm text-ink-muted" role="status">{t("loading")}</p>
      ) : query.unavailable ? (
        <div className="mt-7 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
          <p className="text-sm font-semibold text-ink">{t("unavailable")}</p>
          <button className="mt-3 rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={query.refresh} type="button">{t("retry")}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-7 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
          <Link className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties">{t("browse")}</Link>
        </div>
      ) : (
        <ul className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                className="flex h-full min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={row.source === "submission" || row.status !== "open" ? `/bounties/${row.bountySlug}` : "/applications"}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={statusVariants[row.status]}>{statusLabelKeys[row.status] ? tApplications(statusLabelKeys[row.status]!) : applicationStatusLabel(tApplications, row)}</Badge>
                  <span className="text-xs text-ink-muted">{format.dateTime(new Date(row.appliedAt), { dateStyle: "medium" })}</span>
                </span>
                <span className="line-clamp-2 break-words font-display text-lg font-bold text-ink">{row.bountyTitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
