import { formatUnits, parseUnits } from "viem";
import type { Reward } from "./types";

/**
 * Reward tokens the marketplace pays in. NinjaLabsBE stores `amount` in the token's smallest
 * unit (DECIMAL(78,0)) with only a display symbol, so decimals are fixed here per symbol.
 */
export const REWARD_TOKEN_DECIMALS: Record<Reward["currency"], number> = {
  INJ: 18,
  USDC: 6,
};

export type RewardRow = { symbol: string; amount: string };

function isRewardCurrency(symbol: string): symbol is Reward["currency"] {
  return symbol in REWARD_TOKEN_DECIMALS;
}

/** Converts a BE reward row to display units; unknown symbols or malformed amounts return null. */
export function toReward(row: RewardRow): Reward | null {
  const symbol = row.symbol.toUpperCase();
  if (!isRewardCurrency(symbol)) return null;
  try {
    return { amount: Number(formatUnits(BigInt(row.amount), REWARD_TOKEN_DECIMALS[symbol])), currency: symbol };
  } catch {
    return null;
  }
}

export function toRewards(rows: readonly RewardRow[]): Reward[] {
  return rows.flatMap((row) => {
    const reward = toReward(row);
    return reward ? [reward] : [];
  });
}

/** Display units → BE smallest-unit integer string. */
export function toBaseUnits(reward: Reward): string {
  return parseUnits(String(reward.amount), REWARD_TOKEN_DECIMALS[reward.currency]).toString();
}
