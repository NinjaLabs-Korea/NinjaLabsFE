import { useTranslations } from "next-intl";

import { BountyCard } from "@/components/cards/BountyCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import type { Bounty } from "@/lib/types";

/**
 * The hub's door to the secondary service, the bounty marketplace: a short explanation plus the open bounties as a preview,
 * or one call-to-action card to `/bounties` when none is open. Always renders, so the way into bounties never disappears.
 */
export function BountiesEntrySection({ bounties }: { bounties: Bounty[] }) {
  const t = useTranslations("landing.bounties");
  return (
    <section className="mx-auto max-w-content px-6 pb-16">
      <SectionHeader
        eyebrow={t("eyebrow")}
        heading={t("heading")}
        level={2}
        size="lg"
        action={bounties.length > 0 ? { label: t("viewAll"), href: "/bounties" } : undefined}
      />
      <p className="mt-3 max-w-[640px] text-base text-ink-muted">{t("description")}</p>
      {bounties.length > 0 ? (
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {bounties.map((bounty) => (
            <BountyCard key={bounty.slug} bounty={bounty} showSummary={false} />
          ))}
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-4 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
          </div>
          <Link
            className="shrink-0 rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/bounties"
          >
            {t("cta")}
          </Link>
        </div>
      )}
    </section>
  );
}
