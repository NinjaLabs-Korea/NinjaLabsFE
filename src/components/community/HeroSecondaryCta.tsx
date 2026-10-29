"use client";

import { useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAuthSnapshot, useCohortApi } from "@/components/auth/FoundationProvider";
import { useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Link } from "@/i18n/navigation";
import { isFinishedUser } from "@/lib/auth-route";
import type { PublicCohort } from "@/lib/cohorts";

/**
 * The hub hero's second call to action: "{cohort} 멤버 지원하기" -> `/recruit` while the open cohort accepts applications
 * ("지원 현황 보기" once I applied), otherwise the fallback link (past activities). The cohort is read in the browser so the hub
 * stays static; until the read settles (or if it fails) the fallback shows.
 */
export function HeroSecondaryCta({ className, fallbackHref, fallbackLabel }: { className: string; fallbackHref: string; fallbackLabel: string }) {
  const { status, cohort } = useCurrentCohort();
  const finished = isFinishedUser(useAuthSnapshot());
  if (status === "ready" && cohort?.acceptingApplications) {
    return finished ? <AppliedAwareLink className={className} cohort={cohort} /> : <ApplyLink className={className} cohort={cohort} />;
  }
  return (
    <Link className={className} href={fallbackHref}>
      {fallbackLabel}
    </Link>
  );
}

function ApplyLink({ className, cohort }: { className: string; cohort: PublicCohort }) {
  const t = useTranslations("recruit.heroCta");
  return (
    <Link className={className} href="/recruit">
      {t("apply", { name: cohort.name })}
    </Link>
  );
}

/**
 * Only a finished user can have applied, so only they pay for the "my applications" read. While it loads the button keeps its
 * box and hides its label, so the apply label never flips to "view" after being shown.
 */
function AppliedAwareLink({ className, cohort }: { className: string; cohort: PublicCohort }) {
  const t = useTranslations("recruit.heroCta");
  const mine = useAccountQuery(useCohortApi().getMyCohortApplications);
  if (mine.loading) {
    return (
      <span aria-hidden="true" className={`${className} invisible`}>
        {t("apply", { name: cohort.name })}
      </span>
    );
  }
  const applied = (mine.data ?? []).some((item) => item.cohortId === cohort.id && item.status !== "WITHDRAWN");
  return (
    <Link className={className} href="/recruit">
      {applied ? t("viewStatus") : t("apply", { name: cohort.name })}
    </Link>
  );
}
