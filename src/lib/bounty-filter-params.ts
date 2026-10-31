import { isBountyCategory, type BountyCategory } from "@/lib/bounty-categories";

export type BountyCategoryFilter = "All" | BountyCategory;
export type BountyStatusFilter = "All" | "Active" | "Closed";
export type BountyFilterState = { category: BountyCategoryFilter; status: BountyStatusFilter; query: string };

export const DEFAULT_BOUNTY_FILTERS: BountyFilterState = { category: "All", status: "All", query: "" };

const STATUSES = ["Active", "Closed"] as const;
const QUERY_MAX = 200;

/**
 * The bounty list keeps its filters in the URL (`?category=Design&status=Active&q=bulk`) so the browser Back button from a
 * card lands on the same filtered list. Unknown or malformed values fall back to the defaults.
 */
export function parseBountyFilters(search: string): BountyFilterState {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  const status = params.get("status");
  return {
    category: isBountyCategory(category) ? category : "All",
    status: STATUSES.find((item) => item === status) ?? "All",
    query: (params.get("q") ?? "").slice(0, QUERY_MAX),
  };
}

/** Query string for the non-default filters (empty string when nothing is filtered), without the leading `?`. */
export function serializeBountyFilters(filters: BountyFilterState): string {
  const params = new URLSearchParams();
  if (filters.category !== "All") params.set("category", filters.category);
  if (filters.status !== "All") params.set("status", filters.status);
  if (filters.query.trim()) params.set("q", filters.query.slice(0, QUERY_MAX));
  return params.toString();
}
