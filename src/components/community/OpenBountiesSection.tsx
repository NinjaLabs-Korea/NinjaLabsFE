import { useTranslations } from "next-intl";

import { BountyCard } from "@/components/cards/BountyCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Bounty } from "@/lib/types";

/** "진행 중인 바운티" on the Intro: a preview that renders only when there are open bounties (nothing, not an empty box, otherwise). */
export function OpenBountiesSection({ bounties }: { bounties: Bounty[] }) {
  const t = useTranslations("landing.bounties");
  if (bounties.length === 0) return null;
  return (
    <section className="mx-auto max-w-content px-4 pb-16 sm:px-6">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/bounties" }} />
      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {bounties.map((bounty) => (
          <BountyCard key={bounty.slug} bounty={bounty} showSummary={false} />
        ))}
      </div>
    </section>
  );
}
