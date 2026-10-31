"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAccountQuery } from "@/components/hooks/useAccountQuery";
import { useAccountApi } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { applicationBadge } from "@/lib/application-badge";
import { PageLoading } from "@/components/ui/PageLoading";

/** How many of my latest rows the home lists; the rest is on /applications. */
const HOME_ACTIVITY_LIMIT = 4;

/** My bounty applications and submissions with their status (the latest few), linking to the full list. */
export function HomeActivity() {
  const t = useTranslations("home.activity");
  const tApplications = useTranslations("account.applications");
  const format = useFormatter();
  // Page-load time, like /applications: deadlines are compared once per visit.
  const [now] = useState(() => Date.now());
  const api = useAccountApi();
  const query = useAccountQuery(api.getApplications);
  const rows = [...(query.data ?? [])].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, HOME_ACTIVITY_LIMIT);
  return (
    <section className="mx-auto max-w-content px-gutter pt-16">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/applications" }} />
      {query.loading ? (
        <PageLoading className="mt-7" label={t("loading")} variant="list" />
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
          {rows.map((row) => {
            const badge = applicationBadge(tApplications, row, now, { compact: true });
            return (
              <li key={row.id}>
                <Link
                  className="flex h-full min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  href={row.source === "submission" || row.status !== "open" ? `/bounties/${row.bountySlug}` : "/applications"}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <span className="text-xs text-ink-muted">{format.dateTime(new Date(row.appliedAt), { dateStyle: "medium" })}</span>
                  </span>
                  <span className="line-clamp-2 break-words font-display text-lg font-bold text-ink">{row.bountyTitle}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
