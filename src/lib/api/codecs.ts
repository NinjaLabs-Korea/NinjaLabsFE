/**
 * BE 코드값 ↔ FE 표시값 변환의 단일 출처.
 *
 * BE는 대문자 enum 코드(DEV, CORE …)와 온체인 최소 단위 금액(문자열)을 주고,
 * FE 도메인 타입(lib/types.ts)은 표시용 라벨과 사람 단위 금액을 쓴다.
 * 새 카테고리·역할·토큰을 추가할 때는 이 파일만 고친다.
 */
import { parseUnits } from "viem";
import type { BountyCategory, Member, Reward } from "@/lib/types";

// ── 바운티 카테고리 ────────────────────────────────────────
export const CATEGORY_LABELS = {
  DEV: "Dev",
  DESIGN: "Design",
  CONTENT: "Content",
  OTHER: "Other",
} as const satisfies Record<string, BountyCategory>;

export type CategoryCode = keyof typeof CATEGORY_LABELS;

const CATEGORY_CODES = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([code, label]) => [label, code]),
) as Record<BountyCategory, CategoryCode>;

/** 알 수 없는 코드는 undefined — 호출부에서 기본값(보통 "Other")을 정한다 */
export function toCategoryLabel(code: string): BountyCategory | undefined {
  return CATEGORY_LABELS[code as CategoryCode];
}

export function toCategoryCode(label: BountyCategory): CategoryCode {
  return CATEGORY_CODES[label];
}

// ── 멤버 역할 ──────────────────────────────────────────────
export const MEMBER_ROLE_LABELS = {
  CORE: "Core",
  DEV: "Dev",
  DESIGN: "Design",
  OPS: "Ops",
} as const satisfies Record<string, Member["role"]>;

export type MemberRoleCode = keyof typeof MEMBER_ROLE_LABELS;

const MEMBER_ROLE_CODES = Object.fromEntries(
  Object.entries(MEMBER_ROLE_LABELS).map(([code, label]) => [label, code]),
) as Record<Member["role"], MemberRoleCode>;

export function toMemberRoleLabel(code: string): Member["role"] | undefined {
  return MEMBER_ROLE_LABELS[code as MemberRoleCode];
}

export function toMemberRoleCode(label: string): MemberRoleCode | undefined {
  return MEMBER_ROLE_CODES[label as Member["role"]];
}

// ── 보상 토큰 ──────────────────────────────────────────────
/** 토큰별 온체인 소수 자릿수. BE 금액은 이 자릿수의 최소 단위 정수 문자열이다. */
export const TOKEN_DECIMALS: Record<Reward["currency"], number> = {
  INJ: 18,
  USDC: 6,
};

export function toRewardCurrency(symbol: string | undefined): Reward["currency"] {
  return symbol === "USDC" ? "USDC" : "INJ";
}

/** BE 보상 행(최소 단위) → 표시용 Reward. 보상이 없으면 0 INJ. */
export function rewardFromBaseUnits(row: { symbol: string; amount: string } | undefined): Reward {
  const currency = toRewardCurrency(row?.symbol);
  return {
    amount: row ? Number(row.amount) / 10 ** TOKEN_DECIMALS[currency] : 0,
    currency,
  };
}

/** 표시용 Reward → BE에 보낼 최소 단위 정수 문자열 */
export function rewardToBaseUnits(reward: Reward): string {
  return parseUnits(String(reward.amount), TOKEN_DECIMALS[reward.currency]).toString();
}
