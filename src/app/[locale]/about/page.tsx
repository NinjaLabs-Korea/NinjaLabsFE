import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { InitialCohortProvider } from "@/components/recruit/useCurrentCohort";
import { CommunitySections } from "@/components/community/CommunitySections";
import { localeMetadata } from "@/i18n/alternates";
import { getRuntimeCurrentCohort } from "@/lib/cohorts-public";
import { getRuntimeCommunity } from "@/lib/community";
import { getRuntimeOpenBounties } from "@/lib/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community.metadata" });
  return localeMetadata(locale, "/about", { title: t("title"), description: t("description") });
}

/**
 * The community overview for everyone, signed in or not: the same sections as the hub (`CommunitySections`), with "About Ninja Labs" in front of them instead of the hero.
 * It is where the footer and the dashboard's quick links lead.
 */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [data, openBounties, cohort] = await Promise.all([getRuntimeCommunity(locale), getRuntimeOpenBounties(locale), getRuntimeCurrentCohort()]);
  return (
    <div className="pt-6">
      <InitialCohortProvider cohort={cohort}>
        <CommunitySections aboutLevel={1} data={data} locale={locale} openBounties={openBounties} />
      </InitialCohortProvider>
    </div>
  );
}
