import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { getRuntimeHallOfFame } from "@/lib/hall-of-fame";

const highlightVariants = {
  Milestone: "success",
  "Featured bounty": "primary-soft",
  Partnership: "warning",
} as const;

// Display-label keys (messages `hallOfFame.highlights.categories`).
const highlightLabelKeys = {
  Milestone: "milestone",
  "Featured bounty": "featuredBounty",
  Partnership: "partnership",
} as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/hall-of-fame">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hallOfFame.metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function HallOfFamePage({ params }: PageProps<"/[locale]/hall-of-fame">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hallOfFame");
  const hallOfFame = await getRuntimeHallOfFame();
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader eyebrow={t("header.eyebrow")} heading={t("header.heading")} level={1} size="xl" />
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("header.description")}</p>
        </div>
        <Badge variant="success">{t("header.public")}</Badge>
      </div>

      <section className="mt-10 rounded-panel bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] p-6 shadow-frame sm:p-10">
        <div className="grid gap-5 md:grid-cols-3">
          {hallOfFame.stats.map((stat) => <div key={stat.labelKey} className="rounded-card border border-on-inverse/15 bg-on-inverse/5 p-5"><p className="font-display text-4xl font-bold text-on-inverse">{stat.value}</p><p className="mt-2 text-sm text-on-inverse/70">{t(`stats.${stat.labelKey}`)}</p></div>)}
        </div>
        <p className="mt-5 text-sm text-on-inverse/70">{t("aggregateNote")}</p>
      </section>

      <section className="py-14">
        <SectionHeader eyebrow={t("highlights.eyebrow")} heading={t("highlights.heading")} action={{ label: t("highlights.readNotices"), href: "/notices" }} />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {hallOfFame.highlights.map((highlight) => <Link href={highlight.href} key={highlight.title} className="overflow-hidden rounded-card border border-border bg-surface shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><div className="relative aspect-[16/9] bg-gradient-to-br from-primary-soft-border to-surface-subtle">{highlight.image ? <Image alt="" className="object-cover" fill sizes="(max-width: 768px) 100vw, 370px" src={highlight.image} /> : null}</div><div className="p-5"><Badge variant={highlightVariants[highlight.category]}>{t(`highlights.categories.${highlightLabelKeys[highlight.category]}`)}</Badge><h3 className="mt-3 font-display text-lg font-bold text-ink">{highlight.title}</h3><p className="mt-2 text-sm text-ink-muted">{highlight.body}</p></div></Link>)}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow={t("timeline.eyebrow")} heading={t("timeline.heading")} />
        <div className="relative mt-8 grid gap-8 md:grid-cols-3 md:before:absolute md:before:top-5 md:before:right-0 md:before:left-0 md:before:h-px md:before:bg-border">
          {hallOfFame.milestones.map((milestone) => <article key={milestone.title} className="relative"><div className="flex size-10 items-center justify-center rounded-full border-4 border-primary-soft-border bg-primary text-xs font-bold text-on-inverse">N</div><h3 className="mt-5 font-display text-xl font-bold text-ink">{milestone.title}</h3><p className="mt-2 text-sm font-semibold text-primary">{milestone.date}</p><p className="mt-2 text-sm text-ink-muted">{milestone.description}</p></article>)}
        </div>
      </section>

      <section className="mt-16 overflow-hidden rounded-panel bg-gradient-to-br from-primary-soft-border to-surface-subtle">
        <div className="flex aspect-[1152/522] items-end p-6 sm:p-10"><p className="rounded-control bg-surface px-4 py-2 text-sm font-semibold text-ink">{t("partnerWall")}</p></div>
      </section>
    </div>
  );
}
