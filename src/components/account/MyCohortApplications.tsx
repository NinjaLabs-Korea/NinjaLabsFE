"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { Link } from "@/i18n/navigation";

/** The account page's list of my cohort applications (newest first), each with its status, plus the way to the application page. */
export function MyCohortApplications() {
  const t = useTranslations("recruit.account");
  const api = useCohortApi();
  const query = useAccountQuery(api.getMyCohortApplications);
  const headingId = useId();
  const rows = query.data ?? [];
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink" id={headingId}>{t("heading")}</h2>
        <Link className="text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/recruit">{t("recruitLink")}</Link>
      </div>
      {query.loading ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">{t("loading")}</p>
      ) : query.unavailable ? (
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted" role="status">
          {t("unavailable")}
          <button className="rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={query.refresh} type="button">{t("retry")}</button>
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((application) => (
            <li key={application.id}>
              <CohortApplicationCard application={application} onChanged={query.refresh} variant="compact" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
