import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BountyFilters } from "@/components/bounties/BountyFilters";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { loadRuntimeBounties } from "@/lib/bounties";

type BountiesPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: BountiesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bounties.meta.list" });
  return { title: t("title"), description: t("description") };
}

export default async function BountiesPage({ params }: BountiesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bounties.list");
  const tBounties = await getTranslations("bounties");
  const { bounties, unavailable } = await loadRuntimeBounties();
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section>
        <div className="flex items-start justify-between gap-4">
          <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={1} size="xl" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="success">{t("publicBadge")}</Badge>
            <Link
              className="rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/bounties/apply"
            >
              {t("howApplying")}
            </Link>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          {t("intro")}
        </p>
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

      <p className="mt-8 text-sm text-ink-muted">
        {t("payoutNote")}
      </p>
    </div>
  );
}
