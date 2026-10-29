import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import type { HighlightTypeLabel } from "@/lib/api/codecs";
import { formatStatValue, loadRuntimeHallOfFame, visibleStats } from "@/lib/hall-of-fame";
import { imageProps } from "@/lib/image";
import { localeMetadata } from "@/i18n/alternates";

// One entry per BE highlight type (`lib/api/codecs.ts HIGHLIGHT_TYPE_LABELS`).
const highlightVariants = {
  Milestone: "success",
  "Featured bounty": "primary-soft",
  Project: "primary-soft",
  Partnership: "warning",
  Award: "success",
  Other: "neutral",
} as const satisfies Record<HighlightTypeLabel, string>;

// Display-label keys (messages `hallOfFame.highlights.categories`).
const highlightLabelKeys = {
  Milestone: "milestone",
  "Featured bounty": "featuredBounty",
  Project: "project",
  Partnership: "partnership",
  Award: "award",
  Other: "other",
} as const satisfies Record<HighlightTypeLabel, string>;

export async function generateMetadata({ params }: PageProps<"/[locale]/hall-of-fame">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hallOfFame.metadata" });
  return localeMetadata(locale, "/hall-of-fame", { title: t("title"), description: t("description") });
}

export default async function HallOfFamePage({ params }: PageProps<"/[locale]/hall-of-fame">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hallOfFame");
  const { hallOfFame, unavailable } = await loadRuntimeHallOfFame(locale);
  // A brand-new platform has all-zero stats: hide the block until one value is above zero.
  const stats = visibleStats(hallOfFame.stats);
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader eyebrow={t("header.eyebrow")} heading={t("header.heading")} level={1} size="xl" />
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("header.description")}</p>
        </div>
        <Badge variant="success">{t("header.public")}</Badge>
      </div>

      {unavailable ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center" role="status">
          <p className="font-display text-lg font-bold text-ink">{t("unavailable.title")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("unavailable.body")}</p>
        </div>
      ) : null}

      {stats.length > 0 ? (
        <section className="mt-10 rounded-panel bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] p-6 shadow-frame sm:p-10">
          <div className={`grid gap-5 ${stats.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}>
            {stats.map((stat) => (
              <div key={stat.labelKey} className="rounded-card border border-on-inverse/15 bg-on-inverse/5 p-5 text-center">
                {/* The paid total is a multi-token string ("12,500 USDC · 300 INJ"), so it steps down a size and may wrap. */}
                <p className={`font-display font-bold text-on-inverse ${stat.labelKey === "rewardsPaid" ? "break-words text-2xl" : "text-4xl"}`}>{formatStatValue(stat.value, locale)}</p>
                <p className="mt-2 text-sm text-on-inverse/70">{t(`stats.${stat.labelKey}`)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hallOfFame.highlights.length > 0 ? (
        <section className="py-14">
          <SectionHeader eyebrow={t("highlights.eyebrow")} heading={t("highlights.heading")} action={{ label: t("highlights.readNotices"), href: "/notices" }} />
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {hallOfFame.highlights.map((highlight, index) => (
              // Admin-entered titles are not unique: the index keeps React keys distinct.
              <Link href={highlight.href} key={`${index}:${highlight.title}`} className="min-w-0 overflow-hidden rounded-card border border-border bg-surface shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-primary-soft-border to-surface-subtle">
                  {highlight.image ? <Image {...imageProps(highlight.image)} alt="" className="object-cover" fill sizes="(max-width: 768px) 100vw, 370px" /> : null}
                </div>
                <div className="min-w-0 p-5 [overflow-wrap:anywhere]">
                  <Badge variant={highlightVariants[highlight.category]}>{t(`highlights.categories.${highlightLabelKeys[highlight.category]}`)}</Badge>
                  <h3 className="mt-3 font-display text-lg font-bold text-ink">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{highlight.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {hallOfFame.milestones.length > 0 ? (
        <section>
          <SectionHeader eyebrow={t("timeline.eyebrow")} heading={t("timeline.heading")} />
          <ol className="relative mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:before:absolute md:before:top-[17px] md:before:right-0 md:before:left-0 md:before:h-px md:before:bg-border">
            {hallOfFame.milestones.map((milestone, index) => (
              <li key={`${index}:${milestone.title}`} className="relative min-w-0 [overflow-wrap:anywhere]">
                <span aria-hidden className="block size-9 rounded-full border-4 border-primary-soft-border bg-primary" />
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{milestone.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{milestone.date ? t("timeline.entry", { date: milestone.date, description: milestone.description }) : milestone.description}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {hallOfFame.partners.length > 0 ? (
        <section className="mt-16">
          <SectionHeader eyebrow={t("partners.eyebrow")} heading={t("partners.heading")} />
          <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {hallOfFame.partners.map((partner, index) => {
              const logo = <span className="relative block h-12 w-full"><Image {...imageProps(partner.logo)} alt={partner.name} className="object-contain" fill sizes="(max-width: 640px) 50vw, 240px" /></span>;
              const tileClass = "flex h-28 items-center justify-center rounded-card border border-border bg-surface p-5 shadow-card";
              return (
                <li key={`${index}:${partner.name}`}>
                  {partner.href ? (
                    partner.href.startsWith("/") ? (
                      // A same-site path goes through the locale-aware Link; a raw <a> would drop the locale prefix.
                      <Link className={`${tileClass} transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`} href={partner.href}>{logo}</Link>
                    ) : (
                      <a className={`${tileClass} transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`} href={partner.href} rel="noreferrer" target="_blank">{logo}</a>
                    )
                  ) : (
                    <div className={tileClass}>{logo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
