// Shared Tailwind class strings and small pure formatters for the operations console islands (Ops* components).
import type { useFormatter } from "next-intl";
import { isIsoDateTime } from "@/lib/admin-bounty-form";
import { baseUnitsToHuman } from "@/lib/api/codecs";

export const opsButton = "rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-control motion-press";
export const opsPrimaryButton = "rounded-control bg-primary px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-control motion-press";
export const opsDangerButton = "rounded-control border border-danger px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
// One input recipe for every admin form field (text, textarea, datetime): focus ring, placeholder, and the red border while `aria-invalid`.
const opsField = "mt-2 w-full rounded-control border border-border px-[17px] text-sm font-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
export const opsInput = `h-[46px] ${opsField}`;
export const opsTextarea = `min-h-[96px] py-3 ${opsField}`;
/** The long-form body field (notice markdown). */
export const opsTextareaTall = `min-h-[144px] py-3 ${opsField}`;
export const opsCell = "px-5 py-4 align-top text-sm text-ink-secondary";
export const opsPanel = "mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card";
export const opsPanelEyebrow = "text-xs font-bold uppercase tracking-[0.96px] text-primary";
export const opsPanelTitle = "mt-2 font-display text-2xl -tracking-[0.24px] text-ink";

/** Exact token amount (`formatUnits`, never rounded - operators copy these into multisig tools) + symbol; unknown tokens show base units. */
export function opsAmount(base: string | null | undefined, symbol: string): string {
  if (!base) return "–";
  const human = baseUnitsToHuman(base, symbol);
  return human === null ? `${base} (base units, ${symbol})` : `${human} ${symbol}`;
}

/** `0x1234…abcd` for long hashes/addresses (the full value goes in `title`). */
export function opsShort(value: string | null | undefined): string {
  if (!value) return "–";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

/**
 * BE timestamp -> browser-zone date/time with the zone name, or a dash. Same ISO gate as the Bounty Mgmt deadline cell
 * (`isIsoDateTime`): V8 would read a stray non-ISO value such as "07.14" as a real (guessed) date.
 */
export function opsDateTime(format: ReturnType<typeof useFormatter>, value: string | null | undefined, timeZone: string): string {
  if (!value || !isIsoDateTime(value)) return "–";
  return format.dateTime(new Date(value), { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" });
}
