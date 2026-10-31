import { useTranslations } from "next-intl";

import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import type { HighlightTypeLabel } from "@/lib/api/codecs";
import { COMMUNITY_HIGHLIGHT_LIMIT } from "@/lib/community";
import { formatStatValue, visibleStats, type RuntimeHallOfFame } from "@/lib/hall-of-fame";

// Same label keys and badge colors as the Hall of Fame page (messages `hallOfFame.highlights.categories`).
const highlightVariants = {
  Milestone: "success",
  "Featured bounty": "primary-soft",
  Project: "primary-soft",
  Partnership: "warning",
  Award: "success",
  Other: "neutral",
} as const satisfies Record<HighlightTypeLabel, string>;

const highlightLabelKeys = {
  Milestone: "milestone",
  "Featured bounty": "featuredBounty",
  Project: "project",
  Partnership: "partnership",
  Award: "award",
  Other: "other",
} as const satisfies Record<HighlightTypeLabel, string>;

const highlightCardClass = "min-w-0 break-words rounded-card border border-border bg-surface p-5 shadow-card";

/** A highlight without a usable link is a plain article: no hover/press affordance and no navigation. */
function HighlightCard({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <article className={highlightCardClass}>{children}</article>;
  return <Link className={`${highlightCardClass} hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`} href={href}>{children}</Link>;
}

/** "최근 성과": the Hall of Fame stats (hidden while every value is zero) and the first highlights. */
export function AchievementsSection({ hall, locale, unavailable }: { hall: RuntimeHallOfFame; locale: string; unavailable: boolean }) {
  const t = useTranslations("community.achievements");
  const tHall = useTranslations("hallOfFame");
  const tRetry = useTranslations("community");
  const stats = visibleStats(hall.stats);
  const highlights = hall.highlights.slice(0, COMMUNITY_HIGHLIGHT_LIMIT);
  return (
    <section className="mx-auto max-w-content px-gutter pb-16">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/hall-of-fame" }} />
      {unavailable ? (
        <CommunitySectionState title={t("unavailable")} body={t("unavailableBody")} retryLabel={tRetry("retry")} />
      ) : stats.length === 0 && highlights.length === 0 ? (
        <CommunitySectionState body={t("empty")} action={{ label: t("emptyAction"), href: "/hall-of-fame" }} />
      ) : (
        <>
          {stats.length > 0 ? (
            <dl className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.labelKey} className="rounded-card border border-border bg-surface p-5 text-center shadow-card">
                  <dd className={`font-display font-bold text-ink ${stat.labelKey === "rewardsPaid" ? "break-words text-2xl" : "text-4xl"}`}>{formatStatValue(stat.value, locale)}</dd>
                  <dt className="mt-2 text-sm text-ink-muted">{tHall(`stats.${stat.labelKey}`)}</dt>
                </div>
              ))}
            </dl>
          ) : null}
          {highlights.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
              {highlights.map((highlight, index) => (
                // Admin-entered titles are not unique: the index keeps React keys distinct.
                <HighlightCard href={highlight.href} key={`${index}:${highlight.title}`}>
                  <Badge variant={highlightVariants[highlight.category]}>{tHall(`highlights.categories.${highlightLabelKeys[highlight.category]}`)}</Badge>
                  <h3 className="mt-3 line-clamp-2 font-display text-lg font-bold text-ink">{highlight.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{highlight.body}</p>
                </HighlightCard>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
