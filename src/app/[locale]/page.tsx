import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
 * The community hub: Ninja Labs as a community first, for everyone in every session state (signed in or not, finished or not;
 * nothing redirects away from it). Hero -> ongoing/upcoming events (only when there are some) -> recruitment banner (only while a
 * cohort accepts applications) -> past activities -> members -> achievements -> the bounty entry. The page is public data only;
 * the CTAs that depend on the session render in the browser behind reserved-size placeholders. The bounty marketing hero lives
 * at the top of `/bounties`.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [community, openBounties] = await Promise.all([getRuntimeCommunity(locale), getRuntimeOpenBounties(locale)]);

  return (
    <>
      <ClientMessages namespaces={["recruit"]}>
        <CommunityHero />
        <div className="pt-16">
          <CommunitySections data={community} locale={locale} openBounties={openBounties} />
        </div>
      </ClientMessages>
    </>
  );
}
