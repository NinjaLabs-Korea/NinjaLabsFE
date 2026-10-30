import { useTranslations } from "next-intl";

import { NewsCard } from "@/components/cards/NewsCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Notice } from "@/lib/types";

/**
 * "진행 중·예정 행사": EVENT notices dated today or later, soonest first (`lib/community.ts isUpcomingEvent`), as cards that
 * show the event date. Renders nothing when there are none (no empty box: the hub reads straight on to the next section).
 */
export function UpcomingEventsSection({ events }: { events: Notice[] }) {
  const t = useTranslations("community.upcoming");
  if (events.length === 0) return null;
  return (
    <section className="mx-auto max-w-content px-6 pb-16">
      <SectionHeader heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/notices?category=events" }} />
      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {events.map((notice) => (
          <NewsCard key={notice.slug} notice={notice} dateKind="event" />
        ))}
      </div>
    </section>
  );
}
