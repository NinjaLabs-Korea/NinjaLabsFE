import type { Notice } from "@/lib/types";

// Display-label keys (messages `notices.categories`); the category value itself stays English for matching.
// Fixture-free on purpose: client islands (`notices/NoticeFilters`) import it from here, not from `lib/notices.ts`,
// whose fixture rows would otherwise be bundled into the client.
export const noticeCategoryKeys: Record<Notice["category"], string> = {
  "Ninja Labs": "ninjaLabs",
  "Injective ecosystem": "injectiveEcosystem",
  Events: "events",
  Recruitment: "recruitment",
  Other: "other",
};

/** The `?category=` query value of a community link (`events`, `ninjaLabs`, ...) -> the category it pre-selects; anything else is `undefined`. */
export function noticeCategoryFromQuery(value: string | string[] | undefined): Notice["category"] | undefined {
  const key = Array.isArray(value) ? value[0] : value;
  return (Object.entries(noticeCategoryKeys) as Array<[Notice["category"], string]>).find(([, queryKey]) => queryKey.toLowerCase() === key?.toLowerCase())?.[0];
}
