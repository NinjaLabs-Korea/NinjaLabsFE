import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { StartLink } from "@/components/auth/StartLink";
import { Badge } from "@/components/ui/Badge";
import { HeroSurface } from "@/components/ui/HeroSurface";
import { HeroTitle } from "@/components/ui/HeroTitle";
import { Link } from "@/i18n/navigation";
import { formatStatValue } from "@/lib/hall-of-fame";
import type { BountyHero as BountyHeroData } from "@/lib/landing";

/**
 * The marketing hero at the top of `/bounties` (it used to be the Intro's): headline, "Get started" (follows the auth state:
 * a finished user gets "My profile"), the how-applying link, the Hall of Fame stats (only once one is above zero) and the
 * NFT portfolio showcase card. Its `<h1>` is the page's.
 */
export async function BountyHero({ hero, locale }: { hero: BountyHeroData; locale: string }) {
  const t = await getTranslations("bounties.hero");
  const tList = await getTranslations("bounties.list");
  const tUser = await getTranslations("common.userMenu");
  const tStats = await getTranslations("hallOfFame.stats");
  const showSummary = !hero.statsUnavailable && hero.portfolio.totalCompleted > 0;
  return (
    <HeroSurface
      size="masthead"
      aside={
        <div className="rounded-card border border-on-inverse/12 bg-on-inverse/6 p-[21px] shadow-card backdrop-blur-[4px]">
          <div className="flex items-center gap-3">
            <Image src="/figma/ninja-labs-mascot.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-tile" />
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-on-inverse">{hero.portfolio.handle}</p>
              <p className="text-sm text-on-inverse/75">{t("portfolioMeta", { year: String(hero.portfolio.memberSince) })}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {hero.portfolio.completed.map((title, index) => (
              <div
                // Closed bounties may share a title: the index keeps React keys distinct.
                key={`${index}:${title}`}
                className="relative aspect-square overflow-hidden rounded-tile bg-[linear-gradient(135deg,var(--color-nft-deep)_0%,var(--color-hero-to)_55%,var(--color-accent-soft)_100%)] shadow-nft"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-on-inverse)_0%,transparent_60%)] opacity-35" />
                <span className="absolute inset-x-2 bottom-2 line-clamp-2 break-words text-xs font-semibold text-on-inverse [text-shadow:var(--shadow-tile-text)]">
                  {title}
                </span>
              </div>
            ))}
            <div className="grid aspect-square place-items-center rounded-tile border border-dashed border-on-inverse/25 text-center text-sm text-on-inverse/75">
              {t("next")}
            </div>
          </div>
          {showSummary ? (
            <p className="mt-4 text-center text-sm text-on-inverse/75">{t("portfolioSummary", { count: hero.portfolio.totalCompleted })}</p>
          ) : null}
        </div>
      }
    >
      <div className="self-start">
        <Badge variant="inverse">
          <Image src="/figma/injective-icon-white.svg" alt="" width={13} height={13} className="mr-1.5" />
          {t("eyebrow")}
        </Badge>
      </div>
      <HeroTitle highlight={t("titleHighlight")}>{t("title")}</HeroTitle>
      <p className="mt-6 max-w-[524px] text-lg text-on-inverse/75">{t("description")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <StartLink
          className="rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          memberLabel={tUser("myProfile")}
          resumeLabel={t("continueSignup")}
          signUpLabel={t("getStarted")}
        />
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
