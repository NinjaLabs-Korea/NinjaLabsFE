import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import type { Bounty } from "@/lib/types";

type BountyCardProps = {
  bounty: Bounty;
  /** Landing (19:3) cards omit the summary line; list (19:1480) cards show it. */
  showSummary?: boolean;
  /** Heading level for the card title; /bounties (h1 masthead) uses "h2" to keep heading order. */
  titleAs?: "h2" | "h3";
};

export function BountyCard({ bounty, showSummary = true, titleAs: TitleTag = "h3" }: BountyCardProps) {
  const isClosed = bounty.status === "closed";

  return (
    <Link
      className={`block overflow-hidden rounded-card border border-border bg-surface shadow-card transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${isClosed ? " opacity-70" : ""}`}
      href={`/bounties/${bounty.slug}`}
    >
      <div className="relative aspect-[368.67/207.37]">
        {bounty.coverImage ? (
          <Image
            src={bounty.coverImage}
            alt={bounty.title}
            fill
            sizes="(max-width: 768px) 100vw, 370px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-soft-border to-surface-subtle" />
        )}
      </div>
      <div className="p-5">
        <Badge variant={isClosed ? "danger" : "primary-soft"}>{isClosed ? "Closed" : bounty.category}</Badge>
        <TitleTag className="mt-3 font-display text-base font-bold -tracking-[0.16px] text-ink">{bounty.title}</TitleTag>
        {showSummary && bounty.summary ? (
          <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{bounty.summary}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <RewardPill reward={bounty.reward} />
          <span className="text-right text-xs text-ink-muted">
            {isClosed ? "Closed" : bounty.deadline} · {bounty.sponsor}
          </span>
        </div>
      </div>
    </Link>
  );
}
