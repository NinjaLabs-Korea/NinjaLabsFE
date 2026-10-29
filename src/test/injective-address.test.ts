import { describe, expect, it } from "vitest";
import { evmHexAddress, isSameWalletAddress } from "@/lib/injective-address";

// Known pair: the Injective docs example for the 0x <-> inj1 conversion.
const HEX = "0xc6fe5d33615a1c52c08018c47e8bc53646a0e101";
const INJ = "inj1cml96vmptgw99syqrrz8az79xer2pcgp0a885r";

describe("evmHexAddress", () => {
  it("maps inj1 to the 0x form of the same 20 bytes", () => {
    expect(evmHexAddress(INJ)).toBe(HEX);
  });
  it("lowercases 0x and rejects other shapes", () => {
    expect(evmHexAddress(HEX.toUpperCase().replace("0X", "0x"))).toBe(HEX);
    expect(evmHexAddress("inj1short")).toBeNull();
    expect(evmHexAddress("cosmos1abc")).toBeNull();
  });
  it("compares across the two encodings", () => {
    expect(isSameWalletAddress(INJ, HEX)).toBe(true);
    expect(isSameWalletAddress(INJ, "0x0000000000000000000000000000000000000001")).toBe(false);
  });
});
