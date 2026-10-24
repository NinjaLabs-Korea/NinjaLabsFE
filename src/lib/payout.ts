import type { PayoutStatus } from "@/lib/types";

/** Badge copy key; the same three keys exist in every namespace that renders a payout badge (`members.profile`, `bounties.action`, `account.applications`). */
export type PayoutBadge = { variant: "warning" | "success"; key: "payoutPending" | "payoutPartial" | "payoutPaid" };

/**
 * The single rule for "what does this payout status look like": an unfinished payout is flagged so a shown amount is
 * never read as fully paid. NONE shows nothing. PAID shows nothing on the public profile (the paid amount speaks for
 * itself) but reads "Paid" to the applicant, who passes `{ showPaid: true }`.
 */
export function payoutBadge(status: PayoutStatus, options: { showPaid?: boolean } = {}): PayoutBadge | null {
  if (status === "PENDING") return { variant: "warning", key: "payoutPending" };
  if (status === "PARTIALLY_PAID") return { variant: "warning", key: "payoutPartial" };
  if (status === "PAID" && options.showPaid) return { variant: "success", key: "payoutPaid" };
  return null;
}
