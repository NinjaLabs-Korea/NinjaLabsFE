import type { useFormatter } from "next-intl";

const MAX_FRACTION_DIGITS = 6;

/** Integer part that `Number` can hold exactly (15 digits stays well below 2^53). */
const SAFE_INTEGER_DIGITS = 15;

/**
 * Locale number formatting for token amounts without scientific notation.
 * Accepts the `formatUnits` decimal string (base units already scaled) or an already-converted number. A decimal
 * string whose integer part would not survive `Number` is split by hand: the integer part goes through
 * `Intl.NumberFormat` as a BigInt (grouping only) and the fraction is appended with the locale's decimal separator.
 */
export function formatTokenAmount(amount: number | string, locale: string, maximumFractionDigits = MAX_FRACTION_DIGITS): string {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits });
  if (typeof amount === "number") return formatter.format(amount);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return amount;
  const [, sign, integer, fraction = ""] = match;
  if (integer.replace(/^0+(?=\d)/, "").length <= SAFE_INTEGER_DIGITS) return formatter.format(Number(amount));
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(integer));
  const digits = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  if (!digits) return `${sign}${grouped}`;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  return `${sign}${grouped}${separator}${digits}`;
}

/**
 * Date and time pinned to UTC with the zone label (`Jan 25, 2027, 4:23 PM UTC`), for timestamps that must read the same on
 * every machine, such as an Agent API key's expiry. Explicit fields on purpose: `dateStyle`/`timeStyle` cannot be combined
 * with `timeZoneName` (Intl throws, next-intl's `onError` then falls back to `String(date)` and logs FORMATTING_ERROR).
 */
export function formatUtcDateTime(format: Pick<ReturnType<typeof useFormatter>, "dateTime">, value: string | Date): string {
  return format.dateTime(typeof value === "string" ? new Date(value) : value, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

/**
 * Same fields as `formatUtcDateTime` but in the viewer's own zone (`Nov 9, 2026, 6:36 AM GMT+9`). The zone is read from the
 * browser and passed explicitly because the next-intl provider's `timeZone` is a fixed site-wide value, not the viewer's.
 * Returns "" when the value or the browser zone cannot be used, so callers keep their UTC text.
 */
export function formatLocalDateTime(format: Pick<ReturnType<typeof useFormatter>, "dateTime">, value: string | Date, timeZone?: string): string {
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return format.dateTime(date, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, timeZoneName: "short",
    });
  } catch {
    return "";
  }
}
