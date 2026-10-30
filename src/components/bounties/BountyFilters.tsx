"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { BountyCard } from "@/components/cards/BountyCard";
import { Badge } from "@/components/ui/Badge";
import { parseBountyFilters, serializeBountyFilters, type BountyCategoryFilter as CategoryFilter, type BountyStatusFilter as StatusFilter } from "@/lib/bounty-filter-params";
import type { Bounty, BountyCategory } from "@/lib/types";

type BountyFiltersProps = {
  bounties: Bounty[];
};

// Canonical chip order; only categories present in the list are offered (14 draws Dev / Design / Content).
const categoryOrder: BountyCategory[] = ["Dev", "Design", "Content", "Other"];
const statusFilters: Exclude<StatusFilter, "All">[] = ["Active", "Closed"];
// Filter values stay in English (matched against data); only the displayed labels are localized.
const statusLabelKeys = { Active: "status.active", Closed: "filters.statusClosed" } as const;
/** Delay before filter changes are written to the URL (exported so tests advance by the constant, not a magic sleep). */
export const BOUNTY_FILTER_URL_DEBOUNCE_MS = 300;
const chipButtonClass = "motion-control motion-press max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function BountyFilters({ bounties }: BountyFiltersProps) {
  const t = useTranslations("bounties");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [query, setQuery] = useState("");
  // Filters live in the URL so Back from a card restores them. Server render and first client render use the defaults
  // (no hydration mismatch); the URL is applied right after mount (in a timer callback), and `restored` keeps the
  // write-back from clobbering it.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromUrl = parseBountyFilters(window.location.search);
      setCategory(fromUrl.category);
      setStatus(fromUrl.status);
      setQuery(fromUrl.query);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!restored) return;
    // Debounced: Safari throws SecurityError past ~100 history writes per 30 s, which fast typing would reach.
    const timer = window.setTimeout(() => {
      const search = serializeBountyFilters({ category, status, query });
      const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      try {
        window.history.replaceState(window.history.state, "", next);
      } catch {
        // History writes blocked: the filters still work, they just are not remembered.
      }
    }, BOUNTY_FILTER_URL_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [restored, category, status, query]);
  const resetFilters = () => {
    setCategory("All");
    setStatus("All");
    setQuery("");
  };
  const categoryFilters = useMemo(() => {
    const present = new Set(bounties.map((bounty) => bounty.category));
    return categoryOrder.filter((item) => present.has(item));
  }, [bounties]);

  const visibleBounties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return bounties.filter((bounty) => {
      const matchesCategory = category === "All" || bounty.category === category;
      // Figma 14 draws only Active/Closed chips: "Closed" also covers reviewing bounties (no new applications/submissions).
      const matchesStatus =
        status === "All" ||
        (status === "Active" && bounty.status === "active") ||
        (status === "Closed" && bounty.status !== "active");
      const matchesQuery =
        !normalizedQuery ||
        [bounty.title, bounty.summary]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [bounties, category, query, status]);

  // Nothing posted yet (the BE list is empty): filters and "reset" would only suggest the user's choices hid something.
  if (bounties.length === 0) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("filters.noneTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("filters.noneBody")}</p>
      </div>
    );
  }

  return (
    <>
      {/* 14: one chip row (All + categories + statuses) with the search field on the right. "All" clears both groups. */}
      <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-[21px] shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex flex-wrap gap-2" aria-label={t("filters.ariaLabel")} role="group">
          <button
            aria-pressed={category === "All" && status === "All"}
            className={chipButtonClass}
            onClick={() => { setCategory("All"); setStatus("All"); }}
            type="button"
          >
            <Badge variant={category === "All" && status === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge>
          </button>
          <span aria-label={t("filters.category")} className="contents" role="group">
            {categoryFilters.map((item) => (
              <button
                aria-pressed={category === item}
                className={chipButtonClass}
                key={item}
                onClick={() => setCategory((current) => (current === item ? "All" : item))}
                type="button"
              >
                <Badge variant={category === item ? "selected" : "primary-soft"}>{t(`categories.${item}`)}</Badge>
              </button>
            ))}
          </span>
          <span aria-label={t("filters.status")} className="contents" role="group">
            {statusFilters.map((item) => (
              <button
                aria-pressed={status === item}
                className={chipButtonClass}
                key={item}
                onClick={() => setStatus((current) => (current === item ? "All" : item))}
                type="button"
              >
                <Badge variant={status === item ? "selected" : item === "Active" ? "success" : "danger"}>{t(statusLabelKeys[item])}</Badge>
              </button>
            ))}
          </span>
        </div>
        <label className="block sm:w-80">
          <span className="sr-only">{t("filters.search")}</span>
          <input
            className="h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("filters.search")}
            type="search"
            value={query}
          />
        </label>
      </div>
      {visibleBounties.length > 0 ? (
        <>
        <p className="mt-6 text-sm text-ink-muted" role="status">{t("filters.resultCount", { count: visibleBounties.length })}</p>
        {/* Keyed by the chip selection (not the search text) so a chip click fades the new results in instead of swapping them in one frame. */}
        <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 animate-fade-in motion-reduce:animate-none" key={`${category}|${status}`}>
          {visibleBounties.map((bounty) => (
            <BountyCard bounty={bounty} key={bounty.slug} showSummary titleAs="h2" />
          ))}
        </div>
        </>
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
