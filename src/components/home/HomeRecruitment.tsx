"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

/**
 * Recruitment on the home: while a cohort accepts applications, the invitation to apply (or, once I applied, my application's
 * status and the way to edit it); after the cohort closed, my latest application's status. Nothing when there is nothing to say.
 */
export function HomeRecruitment() {
  const t = useTranslations("home.recruit");
  const format = useFormatter();
  const api = useCohortApi();
  const current = useCurrentCohort();
  const mine = useAccountQuery(api.getMyCohortApplications);
  if (current.status === "loading" || mine.loading) return null;
  const cohort = current.cohort;
  const applications = mine.data ?? [];
  const forCohort = cohort ? applications.find((item) => item.cohortId === cohort.id && item.status !== "WITHDRAWN") : undefined;
  const latest = forCohort ?? applications.find((item) => item.status !== "WITHDRAWN");
  const invite = Boolean(cohort?.acceptingApplications) && !forCohort;
  if (!invite && !latest) return null;
  return (
    <section aria-label={t("heading")} className="mx-auto max-w-content px-4 pt-16 sm:px-6">
      {invite && cohort ? (
        <div className="flex flex-col gap-5 rounded-card border border-primary-soft-border bg-primary-soft p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Badge variant="selected">{t("badge")}</Badge>
            <h2 className="mt-3 break-words font-display text-2xl text-ink">{t("title", { name: cohort.name })}</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {cohort.closesAt ? t("closes", { date: format.dateTime(new Date(cohort.closesAt), { dateStyle: "medium" }) }) : t("body")}
            </p>
          </div>
          <Link
            className="shrink-0 rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/recruit"
          >
            {t("cta")}
          </Link>
        </div>
      ) : latest ? (
        <div>
          <CohortApplicationCard application={latest} onChanged={mine.refresh} variant="compact" />
          <Link className="mt-3 inline-block text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/recruit">{t("details")}</Link>
        </div>
      ) : null}
    </section>
  );
}
