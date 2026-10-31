"use client";

import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

import { NoticeRow } from "@/components/cards/NoticeRow";
import { Badge } from "@/components/ui/Badge";
import { noticeCategoryFromQuery, noticeCategoryKeys } from "@/lib/notice-categories";
import type { Notice } from "@/lib/types";

type NoticeFiltersProps = { notices: Notice[] };
type CategoryFilter = "All" | Notice["category"];
// Canonical chip order; only categories present in the feed are offered (08 draws All / Ninja Labs / Injective ecosystem / Events).
const categoryOrder: Notice["category"][] = ["Ninja Labs", "Injective ecosystem", "Events", "Recruitment", "Other"];

export function NoticeFilters({ notices }: NoticeFiltersProps) {
  const t = useTranslations("notices");
  const [category, setCategory] = useState<CategoryFilter>("All");
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
  // The page is static (ISR), so the server always renders "All"; the chip from `?category=` (the community pages' "past activities"
  // links, Back from a notice) is applied here. A layout effect runs before the browser paints, so a client navigation never shows the
  // unfiltered list first; on a hard load it applies at hydration.
  useLayoutEffect(() => {
    const syncFromUrl = () => {
      const fromUrl = noticeCategoryFromQuery(new URLSearchParams(window.location.search).get("category") ?? undefined);
      setCategory(fromUrl && notices.some((notice) => notice.category === fromUrl) ? fromUrl : "All");
    };
    // The URL is the source of truth: read it once on mount, then again on every popstate.
    syncFromUrl();
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
        <button aria-pressed={category === "All"} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-11 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => select("All")} type="button"><Badge variant={category === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge></button>
        {categories.map((item) => <button aria-pressed={category === item} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-11 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => select(item)} type="button"><Badge variant={category === item ? "selected" : "primary-soft"}>{t(`categories.${noticeCategoryKeys[item]}`)}</Badge></button>)}
      </div>
      {visibleNotices.length > 0 ? (
        <>
        <p className="mt-6 text-sm text-ink-muted" role="status">{t("filters.resultCount", { count: visibleNotices.length })}</p>
        <section className="mt-3 space-y-4 animate-fade-in motion-reduce:animate-none" aria-label={t("filters.listAriaLabel")} key={category}>
          {visibleNotices.map((notice) => <NoticeRow key={notice.slug} notice={notice} />)}
        </section>
        </>
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
