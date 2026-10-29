import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { HeroSurface } from "@/components/ui/HeroSurface";
import { HeroTitle } from "@/components/ui/HeroTitle";
import { Link } from "@/i18n/navigation";
import { formatStatValue } from "@/lib/hall-of-fame";
import type { BountyHero as BountyHeroData } from "@/lib/landing";

/**
 * The hero at the top of `/bounties`: headline, one-line pitch, the how-it-works link and the Hall of Fame stats (only once
 * one is above zero). The header already carries sign-up, so there is no "Get started" button here. Its `<h1>` is the page's.
 */
export async function BountyHero({ hero, locale }: { hero: BountyHeroData; locale: string }) {
  const t = await getTranslations("bounties.hero");
  const tList = await getTranslations("bounties.list");
  const tStats = await getTranslations("hallOfFame.stats");
  return (
    <HeroSurface aside={null} size="masthead">
      <div className="self-start">
        <Badge variant="inverse">
          <Image src="/figma/injective-icon-white.svg" alt="" width={13} height={13} className="mr-1.5" />
          {t("eyebrow")}
        </Badge>
      </div>
      <HeroTitle highlight={t("titleHighlight")}>{t("title")}</HeroTitle>
      <p className="mt-6 max-w-[524px] text-lg text-on-inverse/75">{t("description")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          className="rounded-control border border-on-inverse/20 bg-on-inverse/8 px-[29px] py-[15px] text-center text-base font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/bounties/apply"
        >
          {tList("howApplying")}
        </Link>
      </div>
      {hero.stats.length > 0 ? (
        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
          {hero.stats.map((stat) => (
            <div className="min-w-0" key={stat.labelKey}>
              <dt className="break-words font-display text-2xl font-bold text-on-inverse">{formatStatValue(stat.value, locale)}</dt>
              <dd className="text-sm text-on-inverse/75">{tStats(stat.labelKey)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </HeroSurface>
  );
}
