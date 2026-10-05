"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { BountyCard } from "@/components/cards/BountyCard";
import { Badge } from "@/components/ui/Badge";
import type { Bounty, BountyCategory } from "@/lib/types";

type CategoryFilter = "All" | BountyCategory;
type StatusFilter = "All" | "Active" | "Closed";

type BountyFiltersProps = {
  bounties: Bounty[];
};

const categoryFilters: CategoryFilter[] = ["Dev", "Design", "Content", "Other"];
const statusFilters: Exclude<StatusFilter, "All">[] = ["Active", "Closed"];
// Filter values stay in English (matched against data); only the displayed labels are localized.
const statusLabelKeys = { Active: "status.active", Closed: "status.closed" } as const;

export function BountyFilters({ bounties }: BountyFiltersProps) {
  const t = useTranslations("bounties");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [query, setQuery] = useState("");
  const resetFilters = () => {
    setCategory("All");
    setStatus("All");
    setQuery("");
  };

  const visibleBounties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return bounties.filter((bounty) => {
      const matchesCategory = category === "All" || bounty.category === category;
      const matchesStatus =
        status === "All" ||
        (status === "Active" && bounty.status === "active") ||
        (status === "Closed" && bounty.status === "closed");
      const matchesQuery =
        !normalizedQuery ||
        [bounty.title, bounty.summary]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [bounties, category, query, status]);

  return (
    <>
      <div className="rounded-card border border-border bg-surface px-5 py-7 shadow-card sm:flex sm:items-start sm:justify-between sm:gap-8">
        <div className="space-y-4">
          <div aria-label={t("filters.category")} className="flex flex-col gap-2 sm:flex-row sm:items-center" role="group">
            <span className="shrink-0 text-xs font-bold uppercase tracking-[0.72px] text-ink-muted sm:w-20">
              {t("filters.category")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                aria-pressed={category === "All"}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => setCategory("All")}
                type="button"
              >
                <Badge variant={category === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge>
              </button>
              {categoryFilters.map((item) => (
                <button
                  aria-pressed={category === item}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  key={item}
                  onClick={() => setCategory(item)}
                  type="button"
                >
                  <Badge variant={category === item ? "selected" : "primary-soft"}>{t(`categories.${item}`)}</Badge>
                </button>
              ))}
            </div>
          </div>
          <div aria-label={t("filters.status")} className="flex flex-col gap-2 sm:flex-row sm:items-center" role="group">
            <span className="shrink-0 text-xs font-bold uppercase tracking-[0.72px] text-ink-muted sm:w-20">
              {t("filters.status")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                aria-pressed={status === "All"}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => setStatus("All")}
                type="button"
              >
                <Badge variant={status === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge>
              </button>
              {statusFilters.map((item) => (
                <button
                  aria-pressed={status === item}
                  className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  key={item}
                  onClick={() => setStatus(item)}
                  type="button"
                >
                  <Badge variant={status === item ? "selected" : item === "Active" ? "success" : "danger"}>{t(statusLabelKeys[item])}</Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="mt-5 block sm:mt-0 sm:w-80">
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
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleBounties.map((bounty) => (
            <BountyCard bounty={bounty} key={bounty.slug} showSummary titleAs="h2" />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">{t("filters.emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("filters.emptyBody")}</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
