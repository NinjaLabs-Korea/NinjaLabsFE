"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

/**
 * "{name} 멤버 모집 중": shown only while the open cohort accepts applications (no cohort, a closed window, a failed read: nothing).
 * The cohort is read in the browser so the pages that carry the banner stay static.
 */
export function RecruitmentBanner() {
  const t = useTranslations("recruit.banner");
  const format = useFormatter();
  const { status, cohort } = useCurrentCohort();
  if (status !== "ready" || !cohort?.acceptingApplications) return null;
  return (
    <section aria-label={t("label")} className="mx-auto max-w-content px-4 pb-16 sm:px-6">
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
    </section>
  );
}
