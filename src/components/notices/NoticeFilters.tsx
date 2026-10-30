"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NoticeRow } from "@/components/cards/NoticeRow";
import { Badge } from "@/components/ui/Badge";
import { noticeCategoryFromQuery, noticeCategoryKeys } from "@/lib/notice-categories";
import type { Notice } from "@/lib/types";

type NoticeFiltersProps = { notices: Notice[]; /** Pre-selected chip (the `?category=` link from the community pages); ignored when no notice has it. */ initialCategory?: Notice["category"] };
type CategoryFilter = "All" | Notice["category"];
// Canonical chip order; only categories present in the feed are offered (08 draws All / Ninja Labs / Injective ecosystem / Events).
const categoryOrder: Notice["category"][] = ["Ninja Labs", "Injective ecosystem", "Events", "Recruitment", "Other"];

export function NoticeFilters({ notices, initialCategory }: NoticeFiltersProps) {
  const t = useTranslations("notices");
  const [category, setCategory] = useState<CategoryFilter>(() => (initialCategory && notices.some((notice) => notice.category === initialCategory) ? initialCategory : "All"));
  // The chip lives in the URL (`?category=events`, same key as the community links) so Back from a notice lands on the same filter.
  // Native replaceState on purpose: Next syncs it with the router, and a filter click must not add a history entry.
  const select = useCallback((next: CategoryFilter) => {
    setCategory(next);
    try {
      const url = new URL(window.location.href);
      if (next === "All") url.searchParams.delete("category");
      else url.searchParams.set("category", noticeCategoryKeys[next]);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // History unavailable (sandboxed frame, Safari write limit): the in-memory filter still works.
    }
  }, []);
  useEffect(() => {
    const syncFromUrl = () => {
      const fromUrl = noticeCategoryFromQuery(new URLSearchParams(window.location.search).get("category") ?? undefined);
      setCategory(fromUrl && notices.some((notice) => notice.category === fromUrl) ? fromUrl : "All");
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [notices]);
  const resetFilters = () => select("All");
  const categories = useMemo(() => {
    const present = new Set(notices.map((notice) => notice.category));
    return categoryOrder.filter((item) => present.has(item));
  }, [notices]);
  const visibleNotices = useMemo(() => notices.filter((notice) => category === "All" || notice.category === category), [category, notices]);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label={t("filters.ariaLabel")} role="group">
        <button aria-pressed={category === "All"} className="max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => select("All")} type="button"><Badge variant={category === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge></button>
        {categories.map((item) => <button aria-pressed={category === item} className="max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => select(item)} type="button"><Badge variant={category === item ? "selected" : "primary-soft"}>{t(`categories.${noticeCategoryKeys[item]}`)}</Badge></button>)}
      </div>
      {visibleNotices.length > 0 ? (
        <section className="mt-8 space-y-4" aria-label={t("filters.listAriaLabel")}>
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
