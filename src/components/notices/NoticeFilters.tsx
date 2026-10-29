"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { NoticeRow } from "@/components/cards/NoticeRow";
import { Badge } from "@/components/ui/Badge";
import { noticeCategoryKeys } from "@/lib/notice-categories";
import type { Notice } from "@/lib/types";

type NoticeFiltersProps = { notices: Notice[]; /** Pre-selected chip (the `?category=` link from the community pages); ignored when no notice has it. */ initialCategory?: Notice["category"] };
type CategoryFilter = "All" | Notice["category"];
// Canonical chip order; only categories present in the feed are offered (08 draws All / Ninja Labs / Injective ecosystem / Events).
const categoryOrder: Notice["category"][] = ["Ninja Labs", "Injective ecosystem", "Events", "Recruitment", "Other"];

export function NoticeFilters({ notices, initialCategory }: NoticeFiltersProps) {
  const t = useTranslations("notices");
  const [category, setCategory] = useState<CategoryFilter>(() => (initialCategory && notices.some((notice) => notice.category === initialCategory) ? initialCategory : "All"));
  const resetFilters = () => {
    setCategory("All");
  };
  const categories = useMemo(() => {
    const present = new Set(notices.map((notice) => notice.category));
    return categoryOrder.filter((item) => present.has(item));
  }, [notices]);
  const visibleNotices = useMemo(() => notices.filter((notice) => category === "All" || notice.category === category), [category, notices]);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label={t("filters.ariaLabel")} role="group">
        <button aria-pressed={category === "All"} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setCategory("All")} type="button"><Badge variant={category === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge></button>
        {categories.map((item) => <button aria-pressed={category === item} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => setCategory(item)} type="button"><Badge variant={category === item ? "selected" : "primary-soft"}>{t(`categories.${noticeCategoryKeys[item]}`)}</Badge></button>)}
      </div>
      {visibleNotices.length > 0 ? (
        <section className="mt-8 space-y-4 animate-fade-in motion-reduce:animate-none" aria-label={t("filters.listAriaLabel")} key={category}>
          {visibleNotices.map((notice) => <NoticeRow key={notice.slug} notice={notice} />)}
        </section>
      ) : notices.length === 0 ? (
        // The feed itself is empty (nothing published yet): there is no filter to reset.
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
          <p className="text-sm font-semibold text-ink">{t("filters.feedEmptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("filters.feedEmptyBody")}</p>
        </div>
      ) : (
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">{t("filters.emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("filters.emptyBody")}</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={resetFilters}
            type="button"
          >
            {t("filters.reset")}
          </button>
        </div>
      )}
    </>
  );
}
