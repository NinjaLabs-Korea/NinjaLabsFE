import Image from "next/image";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import { Link } from "@/i18n/navigation";
import { safeHttpUrl } from "@/lib/api/codecs";
import { imageProps } from "@/lib/image";
import type { Bounty } from "@/lib/types";

type BountyCardProps = {
  bounty: Bounty;
  /** Landing (19:3) cards omit the summary line; list (19:1480) cards show it. */
  showSummary?: boolean;
  /** Heading level for the card title; /bounties (h1 masthead) uses "h2" to keep heading order. */
  titleAs?: "h2" | "h3";
};

export function BountyCard({ bounty, showSummary = true, titleAs: TitleTag = "h3" }: BountyCardProps) {
  const t = useTranslations("bounties");
  const isClosed = bounty.status === "closed";
  // reviewing (BE SUBMISSION_CLOSED/IN_REVIEW) keeps full opacity: a requested revision can still be resubmitted.
  const statusLabel = bounty.status === "active" ? null : t(`status.${bounty.status}`);
  const coverImage = safeHttpUrl(bounty.coverImage);
  // Compact label (ko keeps "D-7") plus the full phrase for assistive technology; en/zh already read as a full phrase.
  const daysLeft = bounty.daysLeft !== undefined ? t("card.daysLeft", { days: bounty.daysLeft }) : null;
  const daysLeftLabel = bounty.daysLeft !== undefined ? t("card.daysLeftLabel", { days: bounty.daysLeft }) : null;

  return (
    <Link
      className={`block overflow-hidden rounded-card border border-border bg-surface shadow-card transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${isClosed ? " opacity-70" : ""}`}
      href={`/bounties/${bounty.slug}`}
    >
      <div className="relative aspect-[368.67/207.37]">
        {coverImage ? (
          <Image
            {...imageProps(coverImage)}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 370px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-soft-border to-surface-subtle" />
        )}
      </div>
      <div className="p-5">
        <Badge variant={isClosed ? "danger" : bounty.status === "reviewing" ? "warning" : "primary-soft"}>{statusLabel ?? t(`categories.${bounty.category}`)}</Badge>
        <TitleTag className="mt-3 [overflow-wrap:anywhere] font-display text-base font-bold -tracking-[0.16px] text-ink">{bounty.title}</TitleTag>
        {showSummary && bounty.summary ? (
          <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{bounty.summary}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <RewardPill reward={bounty.reward} />
            {bounty.rewards && bounty.rewards.length > 1 ? (
              <span className="shrink-0 text-xs font-semibold text-ink-muted">+{bounty.rewards.length - 1}</span>
            ) : null}
          </span>
          <span className="min-w-0 text-right text-xs text-ink-muted [overflow-wrap:anywhere]">
            {statusLabel ?? (daysLeft && daysLeftLabel ? (
              daysLeft === daysLeftLabel ? daysLeft : <><span aria-hidden="true" className="whitespace-nowrap">{daysLeft}</span><span className="sr-only">{daysLeftLabel}</span></>
            ) : t("status.active"))} · {bounty.sponsor}
          </span>
        </div>
      </div>
    </Link>
  );
}
