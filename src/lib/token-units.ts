/**
 * 토큰 최소 단위(bigint) <-> 사람 단위 10진 문자열 변환의 단일 출처 (viem `formatUnits`/`parseUnits` 대체).
 *
 * - `formatUnits`: 지수 표기·반올림 없이 정확한 10진 문자열. 끝자리 0과 불필요한 소수점은 없앤다 (viem과 같은 출력).
 * - `parseUnits`: 일반 10진 표기(`12`, `12.5`, `.5`, `5.`, 앞에 `-`)만 받는다. viem은 토큰 자릿수보다 긴 소수를 오류 없이
 *   **반올림**했지만(입력과 다른 금액이 BE로 나간다) 여기서는 **던진다**. 끝자리 0(`1.500`)은 자릿수에 세지 않는다.
 *   자릿수 안의 입력은 viem과 결과가 같다 (`src/test/token-units.test.ts`).
 */

const DECIMAL_PATTERN = /^(-?)([0-9]*)\.?([0-9]*)$/;

export function formatUnits(value: bigint, decimals: number): string {
  let display = value.toString();
  const negative = display.startsWith("-");
  if (negative) display = display.slice(1);

  display = display.padStart(decimals, "0");
  const integer = display.slice(0, display.length - decimals);
  const fraction = display.slice(display.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer || "0"}${fraction ? `.${fraction}` : ""}`;
}

export function parseUnits(value: string, decimals: number): bigint {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw new Error(`Value \`${value}\` is not a valid decimal number.`);
  const [, sign, integer, rawFraction] = match;
  if (integer === "" && rawFraction === "") throw new Error(`Value \`${value}\` has no digits.`);
  const fraction = rawFraction.replace(/0+$/, "");
  if (fraction.length > decimals) {
    throw new Error(`Value \`${value}\` has more than ${decimals} decimal places.`);
  }
  return BigInt(`${sign}${integer}${fraction.padEnd(decimals, "0")}`);
}
