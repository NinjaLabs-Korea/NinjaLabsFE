// Single source for the bounty categories. The order is the display order (list filter chips, admin tag chips), and each
// label is also its message key (`bounties.categories.<Label>`, `admin.bounties.tags.<Label>`; `members.profile.categories`
// uses the lower-cased label). The BE codes (DEV, DESIGN ...) and their mapping live in `api/codecs.ts CATEGORY_LABELS`.

export const BOUNTY_CATEGORIES = ["Dev", "Design", "Content", "Other"] as const;

export type BountyCategory = (typeof BOUNTY_CATEGORIES)[number];

export function isBountyCategory(value: unknown): value is BountyCategory {
  return BOUNTY_CATEGORIES.some((category) => category === value);
}
