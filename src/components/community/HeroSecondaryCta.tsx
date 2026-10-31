"use client";

import { useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { useAuthSnapshot, useCohortApi } from "@/components/auth/FoundationProvider";
import { useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Link } from "@/i18n/navigation";
import { isFinishedUser } from "@/lib/auth-route";
import { activeCohortApplication, type PublicCohort } from "@/lib/cohorts";

const WRAP_CLASS = "max-w-full min-w-0 [overflow-wrap:anywhere]";

/**
 * The hub hero's second call to action: "{cohort} 멤버 지원하기" -> `/recruit` while the open cohort accepts applications
 * ("지원 현황 보기" once I applied), otherwise the fallback link (past activities). The cohort is read in the browser so the hub
 * stays static. No label is ever shown and then replaced: while the cohort read is in flight, or the session / my applications
 * are still loading and decide the label, the button keeps its box with an invisible label. The fallback link shows only once
 * the read settled with no accepting cohort, or failed.
 */
export function HeroSecondaryCta({ className: base, fallbackHref, fallbackLabel }: { className: string; fallbackHref: string; fallbackLabel: string }) {
  // A long cohort name has no break opportunity: let the label wrap inside the hero instead of pushing the button past it.
  const className = `${base} ${WRAP_CLASS}`;
  const { status, cohort } = useCurrentCohort();
  const auth = useAuthSnapshot();
  if (status === "loading") return <Placeholder className={className} />;
  if (status === "ready" && cohort?.acceptingApplications) {
    if (auth.status === "loading") return <Placeholder className={className} cohort={cohort} />;
    return isFinishedUser(auth) ? <AppliedAwareLink className={className} cohort={cohort} /> : <ApplyLink className={className} cohort={cohort} />;
  }
  return (
    <Link className={className} href={fallbackHref}>
      {fallbackLabel}
    </Link>
  );
}

/** Keeps the button's box (the apply label is the sizer) without showing or announcing anything. */
function Placeholder({ className, cohort }: { className: string; cohort?: PublicCohort }) {
  const t = useTranslations("recruit.heroCta");
  return (
    <span aria-hidden="true" className={`${className} invisible`}>
      {t("apply", { name: cohort?.name ?? "" })}
    </span>
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
  const mine = useAccountQuery(useCohortApi().getMyCohortApplications, { reuseLast: true });
  if (mine.loading) return <Placeholder className={className} cohort={cohort} />;
  const applied = activeCohortApplication(mine.data, cohort.id) !== undefined;
  return (
    <Link className={className} href="/recruit">
      {applied ? t("viewStatus") : t("apply", { name: cohort.name })}
    </Link>
  );
}
