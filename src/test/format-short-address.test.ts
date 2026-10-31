import { describe, expect, it } from "vitest";
import { maskWalletAddress } from "@/lib/onboarding-log";
import { shortAddress } from "@/lib/format";
import { opsShort } from "@/components/admin/ops-ui";

const evm = "0x1234567890abcdef1234567890abcdef12345678";
const inj = "inj1vgh38xdeuze3htr927rrnhxlk6ffwku2ve5qam";

describe("shortAddress keeps every previous call site's output", () => {
  it("UserMenu shape: 6 + 4, short values untouched", () => {
    expect(shortAddress(evm)).toBe("0x1234…5678");
    expect(shortAddress(inj)).toBe("inj1vg…5qam");
    expect(shortAddress("0x1234567890ab")).toBe("0x1234…90ab");
    expect(shortAddress("0x12345678ab")).toBe("0x12345678ab");
  });

  it("wallet hook shape: always shortened", () => {
    expect(shortAddress(evm, { keepWhole: 0 })).toBe("0x1234…5678");
  });

  it("ops console shape: 8 + 4 above 14 characters", () => {
    expect(opsShort(evm)).toBe("0x123456…5678");
    expect(opsShort("0x1234567890abcd")).toBe("0x123456…abcd");
    expect(opsShort("0x1234567890ab")).toBe("0x1234567890ab");
    expect(opsShort(null)).toBe("–");
  });

  it("onboarding log mask: invalid when 12 characters or fewer", () => {
    expect(maskWalletAddress(evm)).toBe("0x1234…5678");
    expect(maskWalletAddress("0x12345678ab")).toBe("invalid");
    expect(maskWalletAddress(undefined)).toBeUndefined();
  });
});
