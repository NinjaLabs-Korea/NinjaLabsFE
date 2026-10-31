"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAuthSnapshot, useCohortApi } from "@/components/auth/FoundationProvider";
import { cohortAcceptingHint, lastCurrentCohort, useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { isFinishedUser } from "@/lib/auth-route";
import { activeCohortApplication, type PublicCohort } from "@/lib/cohorts";

/**
 * "{name} 멤버 모집 중": shown only while the open cohort accepts applications (no cohort, a closed window, a failed read: nothing).
 * The cohort is read in the browser so the pages that carry the banner stay static. For a finished member who already applied
 * the button reads "View my application" (same rule as the hub hero); while that is being decided it keeps its box with an
 * invisible label, so the banner never changes size or text after it shows.
 */
export function RecruitmentBanner() {
  const t = useTranslations("recruit.banner");
  const format = useFormatter();
  const api = useCohortApi();
  const { status, cohort } = useCurrentCohort();
  // Per-tab hint (client only, so the server markup and the first client render agree): the banner would otherwise pop in
  // after the read and push the sections below it down.
  const hint = useSyncExternalStore(subscribeNever, cohortAcceptingHint, () => null);
  if (status === "loading") {
    const last = lastCurrentCohort(api);
    const expect = last === undefined ? hint === true : Boolean(last?.acceptingApplications);
    return expect ? (
      <section aria-hidden="true" className="mx-auto max-w-content px-gutter pb-16">
        <div className="invisible flex flex-col gap-5 rounded-card border border-primary-soft-border bg-primary-soft p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Badge variant="selected">{t("badge")}</Badge>
            <h2 className="mt-3 break-words font-display text-2xl text-ink">{t("title", { name: last?.name ?? "Ninja Labs" })}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t("body")}</p>
          </div>
          <span className={CTA_CLASS}>{t("cta")}</span>
        </div>
      </section>
    ) : null;
  }
  if (status !== "ready" || !cohort?.acceptingApplications) return null;
  return (
    <section aria-label={t("label")} className="mx-auto max-w-content px-gutter pb-16">
      <div className="flex flex-col gap-5 rounded-card border border-primary-soft-border bg-primary-soft p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Badge variant="selected">{t("badge")}</Badge>
          <h2 className="mt-3 break-words font-display text-2xl text-ink">{t("title", { name: cohort.name })}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {cohort.closesAt ? t("closes", { date: format.dateTime(new Date(cohort.closesAt), { dateStyle: "medium" }) }) : t("body")}
          </p>
        </div>
        <BannerCta cohort={cohort} />
      </div>
    </section>
  );
}

const subscribeNever = () => () => undefined;

const CTA_CLASS =
  "shrink-0 rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function BannerCta({ cohort }: { cohort: PublicCohort }) {
  const auth = useAuthSnapshot();
  if (auth.status === "loading") return <CtaPlaceholder />;
  return isFinishedUser(auth) ? <AppliedAwareCta cohort={cohort} /> : <ApplyCta />;
}

function ApplyCta() {
  const t = useTranslations("recruit.banner");
  return (
    <Link className={CTA_CLASS} href="/recruit">
      {t("cta")}
    </Link>
  );
}

function CtaPlaceholder() {
  const t = useTranslations("recruit.banner");
  return (
    <span aria-hidden="true" className={`${CTA_CLASS} invisible`}>
      {t("cta")}
    </span>
  );
}

/** Only a finished user can have applied, so only they pay for the "my applications" read. */
function AppliedAwareCta({ cohort }: { cohort: PublicCohort }) {
  const hero = useTranslations("recruit.heroCta");
  const mine = useAccountQuery(useCohortApi().getMyCohortApplications, { reuseLast: true });
  if (mine.loading) return <CtaPlaceholder />;
  const applied = activeCohortApplication(mine.data, cohort.id) !== undefined;
  if (!applied) return <ApplyCta />;
  return (
    <Link className={CTA_CLASS} href="/recruit">
      {hero("viewStatus")}
    </Link>
  );
}
