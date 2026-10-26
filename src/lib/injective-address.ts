const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/**
 * Comparable lowercase `0x` form of a wallet address. The BE stores a user's wallet as `inj1...` (bech32 of the same 20
 * bytes an injected wallet reports as `0x...`), so equality checks between the two must go through this. Returns null for
 * anything that is not a 20-byte `0x` or `inj1` address. The bech32 checksum is not verified: this is for comparing
 * addresses the BE already validated, not for validating input.
 */
export function evmHexAddress(address: string): string | null {
  const value = address.trim().toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(value)) return value;
  if (!value.startsWith("inj1")) return null;
  const data = value.slice(4, -6);
  let bits = 0;
  let acc = 0;
  const bytes: number[] = [];
  for (const char of data) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index < 0) return null;
    acc = (acc << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  if (bytes.length !== 20 || acc !== 0) return null;
  return `0x${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function isSameWalletAddress(a: string, b: string): boolean {
  const left = evmHexAddress(a);
  return left !== null && left === evmHexAddress(b);
}
