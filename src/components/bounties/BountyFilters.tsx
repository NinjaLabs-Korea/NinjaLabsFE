"use client";

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
const statusFilters: StatusFilter[] = ["Active", "Closed"];

export function BountyFilters({ bounties }: BountyFiltersProps) {
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
      <div className="rounded-card border border-border bg-surface px-5 py-7 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={resetFilters}
            type="button"
          >
            <Badge variant={category === "All" && status === "All" ? "selected" : "primary-soft"}>All</Badge>
          </button>
          {categoryFilters.map((item) => (
            <button
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              <Badge variant={category === item ? "selected" : "primary-soft"}>{item}</Badge>
            </button>
          ))}
          {statusFilters.map((item) => (
            <button
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              key={item}
              onClick={() => setStatus(item)}
              type="button"
            >
              <Badge variant={status === item ? "selected" : item === "Active" ? "success" : "danger"}>{item}</Badge>
            </button>
          ))}
        </div>
        <label className="mt-4 block sm:mt-0 sm:w-80">
          <span className="sr-only">Search bounties</span>
          <input
            className="h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search bounties"
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
          <p className="text-sm font-semibold text-ink">No bounties match your filters</p>
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
