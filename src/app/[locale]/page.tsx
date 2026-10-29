import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { IntroRedirect } from "@/components/auth/IntroRedirect";
import { CommunityHero } from "@/components/community/CommunityHero";
import { CommunitySections } from "@/components/community/CommunitySections";
import { ClientMessages } from "@/components/layout/ClientMessages";
import { localeMetadata } from "@/i18n/alternates";
import { getRuntimeCommunity } from "@/lib/community";
import { getRuntimeOpenBounties } from "@/lib/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.metadata" });
  return localeMetadata(locale, "/", { title: t("title"), description: t("description") });
}

/**
 * The Intro: Ninja Labs as a community first. Hero -> past activities -> members -> achievements -> open bounties (only when
 * there are some) -> recruitment banner (only while a cohort accepts applications). The bounty marketing hero lives at the top
 * of `/bounties`. A user who finished onboarding is sent to `/home` (`proxy.ts` hint cookie, `IntroRedirect` as the fallback).
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [community, openBounties] = await Promise.all([getRuntimeCommunity(locale), getRuntimeOpenBounties(locale)]);

  return (
    <>
      <IntroRedirect />
      <ClientMessages namespaces={["recruit"]}>
        <CommunityHero />
        <div className="pt-16">
          <CommunitySections data={community} locale={locale} openBounties={openBounties} />
        </div>
      </ClientMessages>
    </>
  );
}
