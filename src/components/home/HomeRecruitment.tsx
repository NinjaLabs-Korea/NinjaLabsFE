"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { cohortAcceptingHint, lastCurrentCohort, useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

const SECTION_CLASS = "mx-auto max-w-content px-gutter pt-16";
/**
 * One height for every state of this section (the invite card, my application's status card, the loading reserve): the status
 * card is taller than the invite, so reserving only the invite's box made a builder with an application push the sections below
 * down after the read landed. Values measured at 375 and 768+ px in en.
 */
const CARD_MIN_HEIGHT = "min-h-[268px] md:min-h-[245px]";

/** The invitation card; `hidden` renders the same box with invisible content, to reserve its height while the reads load. */
function InviteCard({ name, closes, hidden = false }: { name: string; closes: string | null; hidden?: boolean }) {
  // The hub banner (`RecruitmentBanner`) shows the same invitation, so both read `recruit.banner`.
  const t = useTranslations("recruit.banner");
  const format = useFormatter();
  return (
    <div className={`flex flex-col gap-5 rounded-card border border-primary-soft-border bg-primary-soft p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between ${CARD_MIN_HEIGHT}${hidden ? " invisible" : ""}`}>
      <div className="min-w-0">
        <Badge variant="selected">{t("badge")}</Badge>
        <h2 className="mt-3 break-words font-display text-2xl text-ink">{t("title", { name })}</h2>
        <p className="mt-2 text-sm text-ink-muted">{closes ? t("closes", { date: format.dateTime(new Date(closes), { dateStyle: "medium" }) }) : t("body")}</p>
      </div>
      {hidden ? (
        <span className="shrink-0 rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold">{t("cta")}</span>
      ) : (
        <Link
          className="shrink-0 rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/recruit"
        >
          {t("cta")}
        </Link>
      )}
    </div>
  );
}

/**
 * Recruitment on the home: while a cohort accepts applications, the invitation to apply (or, once I applied, my application's
 * status and the way to edit it); after the cohort closed, my latest application's status. Nothing when there is nothing to say.
 */
export function HomeRecruitment() {
  const t = useTranslations("home.recruit");
  const banner = useTranslations("recruit.banner");
  const api = useCohortApi();
  const current = useCurrentCohort();
  const mine = useAccountQuery(api.getMyCohortApplications, { reuseLast: true });
  if (current.status === "loading" || mine.loading) {
    // Reserve the invite card's height when a cohort is known to accept applications (last answer, or the per-tab hint after a
    // hard reload): the card would otherwise pop in above the sections below it. No cohort: nothing, as before.
    const last = lastCurrentCohort(api);
    const expectInvite = last === undefined ? cohortAcceptingHint() === true : Boolean(last?.acceptingApplications);
    return expectInvite ? (
      <section aria-hidden="true" className={SECTION_CLASS}>
        <InviteCard closes={null} hidden name={last?.name ?? "Ninja Labs"} />
      </section>
    ) : null;
  }
  const cohort = current.cohort;
  const applications = mine.data ?? [];
  const forCohort = cohort ? applications.find((item) => item.cohortId === cohort.id && item.status !== "WITHDRAWN") : undefined;
  const latest = forCohort ?? applications.find((item) => item.status !== "WITHDRAWN");
  const invite = Boolean(cohort?.acceptingApplications) && !forCohort;
  if (!invite && !latest) return null;
  return (
    <section aria-label={banner("label")} className={SECTION_CLASS}>
      {invite && cohort ? (
        <InviteCard closes={cohort.closesAt} name={cohort.name} />
      ) : latest ? (
        <div className={CARD_MIN_HEIGHT}>
          <CohortApplicationCard application={latest} onChanged={mine.refresh} variant="compact" />
          <Link className="mt-3 inline-block text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/recruit">{t("details")}</Link>
        </div>
      ) : null}
    </section>
  );
}
