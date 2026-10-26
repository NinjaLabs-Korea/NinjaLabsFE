import { useTranslations } from "next-intl";

import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { NewsCard } from "@/components/cards/NewsCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Notice } from "@/lib/types";

/** "최근 소식": the latest published notices. */
export function NewsSection({ news, unavailable }: { news: Notice[]; unavailable: boolean }) {
  const t = useTranslations("community.news");
  return (
    <section className="mx-auto max-w-content px-4 pb-16 sm:px-6">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/notices" }} />
      {unavailable ? (
        <CommunitySectionState title={t("unavailable")} body={t("unavailableBody")} />
      ) : news.length === 0 ? (
        <CommunitySectionState body={t("empty")} />
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((notice) => (
            <NewsCard key={notice.slug} notice={notice} />
          ))}
        </div>
      )}
    </section>
  );
}
