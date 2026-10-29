"use client";

import { useTranslations } from "next-intl";
import { useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { Link } from "@/i18n/navigation";

/**
 * The Intro hero's second call to action: "{cohort} 멤버 지원하기" -> `/recruit` while the open cohort accepts applications,
 * otherwise the fallback link (past activities). The cohort is read in the browser so the Intro stays static; until the read
 * settles (or if it fails) the fallback shows.
 */
export function HeroSecondaryCta({ className, fallbackHref, fallbackLabel }: { className: string; fallbackHref: string; fallbackLabel: string }) {
  const t = useTranslations("recruit.heroCta");
  const { status, cohort } = useCurrentCohort();
  if (status === "ready" && cohort?.acceptingApplications) {
    return (
      <Link className={className} href="/recruit">
        {t("apply", { name: cohort.name })}
      </Link>
    );
  }
  return (
    <Link className={className} href={fallbackHref}>
      {fallbackLabel}
    </Link>
  );
}
