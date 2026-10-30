import { describe, expect, it } from "vitest";
import { TOKEN_DECIMALS } from "@/lib/api/codecs";
import { OPEN_PAYOUT_STATUSES, PAYOUT_SUMMARY_STATUSES, PAYABLE_REWARD_STATUSES, UNSETTLED_PAYOUT_STATUSES } from "@/lib/payout-status";

// A copy of NinjaLabsBE `src/rewards/payout-status.ts`. Changing a set here must be a deliberate edit that follows the BE.
describe("payout status mirror", () => {
  it("snapshots the BE sets", () => {
    expect(OPEN_PAYOUT_STATUSES).toEqual(["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING"]);
    expect(UNSETTLED_PAYOUT_STATUSES).toEqual(["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING", "FAILED"]);
    expect(PAYABLE_REWARD_STATUSES).toEqual(["FUNDED", "PARTIALLY_PAID", "PAID"]);
  });

  it("pins TOKEN_DECIMALS to the BE table", () => {
    // NinjaLabsBE `src/rewards/reward-token-decimals.ts` @ origin/main 5d091a9: REWARD_TOKEN_DECIMALS = { INJ: 18, USDC: 6 }.
    expect(TOKEN_DECIMALS).toEqual({ INJ: 18, USDC: 6 });
  });

  it("keeps the FE payout summary statuses", () => {
    expect(PAYOUT_SUMMARY_STATUSES).toEqual(["PAID", "PARTIALLY_PAID", "PENDING", "NONE"]);
  });

  it("keeps UNSETTLED as everything that is neither PAID nor CANCELLED", () => {
    const all = ["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING", "PAID", "FAILED", "CANCELLED"];
    expect(all.filter((status) => UNSETTLED_PAYOUT_STATUSES.includes(status))).toEqual(all.filter((status) => status !== "PAID" && status !== "CANCELLED"));
  });
});
