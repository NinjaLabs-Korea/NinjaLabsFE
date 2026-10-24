// Shared Tailwind class strings and small pure formatters for the operations console islands (Ops* components).
import { baseUnitsToHuman } from "@/lib/api/codecs";

export const opsButton = "rounded-control border border-primary-outline px-3 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
export const opsPrimaryButton = "rounded-control bg-primary px-3 py-2 text-sm font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
export const opsDangerButton = "rounded-control border border-danger px-3 py-2 text-sm font-semibold text-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
export const opsInput = "mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm font-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const opsTextarea = "mt-2 min-h-[96px] w-full rounded-control border border-border px-[17px] py-3 text-sm font-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const opsCell = "px-5 py-4 align-top text-sm text-ink-secondary";
export const opsPanel = "mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card";
export const opsPanelEyebrow = "text-xs font-bold uppercase tracking-[0.96px] text-primary";
export const opsPanelTitle = "mt-2 font-display text-2xl -tracking-[0.24px] text-ink";

/** Exact token amount (`formatUnits`, never rounded — operators copy these into multisig tools) + symbol; unknown tokens show base units. */
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
