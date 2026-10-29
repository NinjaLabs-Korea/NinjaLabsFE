import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CommunitySections } from "@/components/community/CommunitySections";
import { localeMetadata } from "@/i18n/alternates";
import { getRuntimeCommunity } from "@/lib/community";
import { getRuntimeOpenBounties } from "@/lib/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "community.metadata" });
  return localeMetadata(locale, "/about", { title: t("title"), description: t("description") });
}

/**
 * The community overview for everyone, signed in or not: the same sections as the Intro (`CommunitySections`), with "About Ninja Labs" in front of them instead of the hero.
 * It is where "Learn more about Ninja Labs" (signup step 4), the home and the footer lead, because a user who finished
 * onboarding is redirected away from the Intro itself.
 */
export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [data, openBounties] = await Promise.all([getRuntimeCommunity(locale), getRuntimeOpenBounties(locale)]);
  return (
    <div className="pt-6">
      <CommunitySections aboutLevel={1} data={data} locale={locale} openBounties={openBounties} />
    </div>
  );
}
