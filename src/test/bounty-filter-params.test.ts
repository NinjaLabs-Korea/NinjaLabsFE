import { describe, expect, it } from "vitest";
import { DEFAULT_BOUNTY_FILTERS, parseBountyFilters, serializeBountyFilters } from "@/lib/bounty-filter-params";

describe("bounty filter URL params", () => {
  it("round-trips non-default filters", () => {
    const filters = { category: "Design", status: "Active", query: "Bulk 1" } as const;
    expect(parseBountyFilters(`?${serializeBountyFilters(filters)}`)).toEqual(filters);
  });
  it("writes nothing for the defaults", () => {
    expect(serializeBountyFilters(DEFAULT_BOUNTY_FILTERS)).toBe("");
    expect(serializeBountyFilters({ ...DEFAULT_BOUNTY_FILTERS, query: "   " })).toBe("");
  });
  it("falls back to the defaults for unknown values", () => {
    expect(parseBountyFilters("?category=Hacking&status=Maybe&q=")).toEqual(DEFAULT_BOUNTY_FILTERS);
    expect(parseBountyFilters("")).toEqual(DEFAULT_BOUNTY_FILTERS);
  });
});
