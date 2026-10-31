import { describe, expect, it } from "vitest";
import { MINTED_OR_LATER, NFT_STATUSES, ownerNftBadgeKey, publicNftStatusKey } from "@/lib/nft-status";

// A copy of NinjaLabsBE `src/nfts/nft-status.ts`. Changing a set here must be a deliberate edit that follows the BE.
describe("nft status mirror", () => {
  it("snapshots the BE sets", () => {
    expect(NFT_STATUSES).toEqual(["PENDING", "MINTING", "MINTED", "ATTACHING", "ATTACHED", "FAILED"]);
    expect(MINTED_OR_LATER).toEqual(["MINTED", "ATTACHING", "ATTACHED"]);
  });

  // Every BE status plus a value the BE might add later. FAILED never shows as an error: it is handled in /admin/nft-jobs.
  it.each([
    ["PENDING", "minting", "pending"],
    ["MINTING", "minting", "pending"],
    ["MINTED", "minted", "minted"],
    ["ATTACHING", "minting", "minted"],
    ["ATTACHED", null, "minted"],
    ["FAILED", "minting", "pending"],
    ["SOMETHING_NEW", "minting", "pending"],
  ])("%s -> public %s, owner %s", (status, publicKey, ownerKey) => {
    expect(publicNftStatusKey(status)).toBe(publicKey);
    expect(ownerNftBadgeKey(status)).toBe(ownerKey);
  });

  it("covers every BE status in the table above", () => {
    const covered = ["PENDING", "MINTING", "MINTED", "ATTACHING", "ATTACHED", "FAILED"];
    expect([...NFT_STATUSES].sort()).toEqual(covered.sort());
  });
});
