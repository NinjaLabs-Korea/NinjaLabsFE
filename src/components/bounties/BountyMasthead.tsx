import { getTranslations } from "next-intl/server";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { formatStatValue } from "@/lib/hall-of-fame";
import type { BountyHero as BountyHeroData } from "@/lib/landing";

/**
 * The light list-page masthead at the top of `/bounties` (same family as `/members`, `/notices`, `/hall-of-fame`): the
 * "Marketplace" eyebrow, the page `<h1>`, a one-line pitch, the how-it-works link and, once one is above zero, the Hall of
 * Fame stats as small light tiles. The dark gradient hero belongs to the hub (`/`) only, so this page reads as a work list.
 */
export async function BountyMasthead({ hero, locale }: { hero: BountyHeroData; locale: string }) {
  const t = await getTranslations("bounties.list");
  const tStats = await getTranslations("hallOfFame.stats");
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={1} size="xl" />
        <p className="mt-4 max-w-[640px] text-lg text-ink-muted">{t("description")}</p>
        <Link
          className="mt-5 inline-flex w-fit rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/bounties/apply"
        >
          {t("howApplying")}
        </Link>
      </div>
      {hero.stats.length > 0 ? (
        <dl className="flex flex-wrap gap-3 lg:shrink-0 lg:flex-nowrap">
          {hero.stats.map((stat) => (
            // Label first in the DOM (term, then value); the value is drawn on top.
            <div className="flex min-w-[8.5rem] flex-col-reverse rounded-tile border border-border bg-surface px-4 py-3 shadow-card" key={stat.labelKey}>
              <dt className="mt-0.5 text-xs text-ink-muted">{tStats(stat.labelKey)}</dt>
              <dd className="break-words font-display text-xl font-bold text-ink">{formatStatValue(stat.value, locale)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
