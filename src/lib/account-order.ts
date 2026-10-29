import type { AccountApplication } from "@/lib/contracts/account";

/**
 * One list, newest first: application rows (`appliedAt` = when applied) and standalone submission rows (`appliedAt` = when
 * submitted) are interleaved by that time, so work submitted a minute ago is not buried under older applications.
 * Stable for equal times (the input order stays), and a row without a parseable time sorts last.
 */
export function newestFirst<T extends Pick<AccountApplication, "appliedAt">>(rows: readonly T[]): T[] {
  const time = (row: T) => {
    const parsed = Date.parse(row.appliedAt);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return rows
    .map((row, index) => ({ row, index, at: time(row) }))
    .sort((a, b) => (a.at === b.at ? a.index - b.index : a.at > b.at ? -1 : 1))
    .map(({ row }) => row);
}
