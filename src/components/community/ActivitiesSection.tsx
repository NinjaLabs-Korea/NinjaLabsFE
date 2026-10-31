import { useTranslations } from "next-intl";

import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { NewsCard } from "@/components/cards/NewsCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Notice } from "@/lib/types";

/** "지난 활동": EVENT notices, newest event date first, as cards that show the event date. Links to the notice list filtered to events. */
export function ActivitiesSection({ events, unavailable }: { events: Notice[]; unavailable: boolean }) {
  const t = useTranslations("community.activities");
  const tRetry = useTranslations("community");
  return (
    <section className="mx-auto max-w-content px-gutter pb-16">
      <SectionHeader
        heading={t("heading")}
        level={2}
        size="lg"
        action={{ label: t("viewAll"), href: "/notices?category=events" }}
      />
      {unavailable ? (
        <CommunitySectionState title={t("unavailable")} body={t("unavailableBody")} retryLabel={tRetry("retry")} />
      ) : events.length === 0 ? (
        <CommunitySectionState body={t("empty")} action={{ label: t("emptyAction"), href: "/notices" }} />
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {events.map((notice) => (
            <NewsCard key={notice.slug} notice={notice} dateKind="event" />
          ))}
        </div>
      )}
    </section>
  );
}
