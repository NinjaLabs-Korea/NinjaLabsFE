"use client";

import { useMemo, useState } from "react";

import { NoticeRow } from "@/components/cards/NoticeRow";
import { Badge } from "@/components/ui/Badge";
import type { Notice } from "@/lib/types";

type NoticeFiltersProps = { notices: Notice[] };
type CategoryFilter = "All" | Notice["category"];
const categories: Notice["category"][] = ["Ninja Labs", "Injective ecosystem", "Events"];

export function NoticeFilters({ notices }: NoticeFiltersProps) {
  const [category, setCategory] = useState<CategoryFilter>("All");
  const resetFilters = () => {
    setCategory("All");
  };
  const visibleNotices = useMemo(() => notices.filter((notice) => category === "All" || notice.category === category), [category, notices]);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Notice categories">
        <button className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setCategory("All")} type="button"><Badge variant={category === "All" ? "selected" : "primary-soft"}>All</Badge></button>
        {categories.map((item) => <button className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => setCategory(item)} type="button"><Badge variant={category === item ? "selected" : "primary-soft"}>{item}</Badge></button>)}
      </div>
      {visibleNotices.length > 0 ? (
        <section className="mt-8 space-y-4" aria-label="Notices">
          {visibleNotices.map((notice) => <NoticeRow key={notice.slug} notice={notice} />)}
        </section>
      ) : (
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">No notices match your filters</p>
          <p className="mt-1 text-sm text-ink-muted">Try a different category or clear the search.</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={resetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>
      )}
    </>
  );
}
