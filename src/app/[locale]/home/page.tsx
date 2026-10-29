import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BountyCard } from "@/components/cards/BountyCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { HomeActivity } from "@/components/home/HomeActivity";
import { HomeGate } from "@/components/home/HomeGate";
import { HomeProfileCard } from "@/components/home/HomeProfileCard";
import { HomeQuickLinks } from "@/components/home/HomeQuickLinks";
import { HomeRecruitment } from "@/components/home/HomeRecruitment";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { localeAlternates } from "@/i18n/alternates";
import { getRuntimeLanding } from "@/lib/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]/home">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.metadata" });
  return {
    alternates: localeAlternates(locale, "/home"),
    // Signed-in only: nothing to index (a signed-out visitor is sent to the hub).
    robots: { index: false, follow: false },
    title: t("title"),
    description: t("description"),
  };
}

/**
 * The signed-in home for a user who finished onboarding. The personal sections (profile, my applications, recruitment) are
 * client islands behind `HomeGate`; the open bounties and the latest notices are public data rendered here and handed to the gate.
 */
export default async function HomePage({ params }: PageProps<"/[locale]/home">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const { bounties, news, unavailable } = await getRuntimeLanding(locale);
  return (
    <HomeGate>
      <HomeProfileCard />
      <HomeActivity />
      <HomeRecruitment />

      <section className="mx-auto max-w-content px-4 pt-16 sm:px-6">
        <SectionHeader eyebrow={t("bounties.eyebrow")} heading={t("bounties.heading")} level={2} size="lg" action={{ label: t("bounties.viewAll"), href: "/bounties" }} />
        {unavailable.bounties ? (
          <p className="mt-7 text-sm text-ink-muted" role="status">{t("bounties.unavailable")}</p>
        ) : bounties.length === 0 ? (
          <p className="mt-7 text-sm text-ink-muted">{t("bounties.empty")}</p>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {bounties.map((bounty) => (
              <BountyCard bounty={bounty} key={bounty.slug} showSummary={false} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-content px-4 pt-16 sm:px-6">
        <SectionHeader eyebrow={t("news.eyebrow")} heading={t("news.heading")} level={2} size="lg" action={{ label: t("news.viewAll"), href: "/notices" }} />
        {unavailable.news ? (
          <p className="mt-7 text-sm text-ink-muted" role="status">{t("news.unavailable")}</p>
        ) : news.length === 0 ? (
          <p className="mt-7 text-sm text-ink-muted">{t("news.empty")}</p>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {news.map((notice) => (
              <NewsCard key={notice.slug} notice={notice} />
            ))}
          </div>
        )}
      </section>

      <HomeQuickLinks />
    </HomeGate>
  );
}
