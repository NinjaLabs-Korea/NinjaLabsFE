import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BountyFilters } from "@/components/bounties/BountyFilters";
import { BountyHero } from "@/components/bounties/BountyHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { settle } from "@/lib/api/public";
import { getRuntimeBounties } from "@/lib/bounties";
import { getBountyHero } from "@/lib/landing";
import { localeMetadata } from "@/i18n/alternates";

type BountiesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: BountiesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bounties.meta.list" });
  return localeMetadata(locale, "/bounties", { title: t("title"), description: t("description") });
}

export default async function BountiesPage({ params }: BountiesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bounties.list");
  const tBounties = await getTranslations("bounties");
  const { value: bounties, unavailable } = await settle(getRuntimeBounties(locale), []);
  const hero = await getBountyHero(locale, bounties);
  return (
    <>
      <BountyHero hero={hero} locale={locale} />
      <div className="mx-auto max-w-content px-6 py-16 pb-20">
        <section>
          <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" />
        </section>

        <section className="mt-8" aria-label={t("resultsLabel")}>
          {unavailable ? (
            <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
              <p className="text-sm font-semibold text-ink">{t("unavailable")}</p>
              <p className="mt-1 text-sm text-ink-muted">{tBounties("unavailableBody")}</p>
            </div>
          ) : (
            <BountyFilters bounties={bounties} />
          )}
        </section>
      </div>
    </>
  );
}
