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
