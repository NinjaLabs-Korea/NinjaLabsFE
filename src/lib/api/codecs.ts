/**
 * BE 코드값 ↔ FE 표시값 변환의 단일 출처.
 *
 * BE는 대문자 enum 코드(DEV, CORE …)와 온체인 최소 단위 금액(문자열)을 주고,
 * FE 도메인 타입(lib/types.ts)은 표시용 라벨과 사람 단위 금액을 쓴다.
 * 새 카테고리·역할·토큰을 추가할 때는 이 파일만 고친다.
 */
import { formatUnits, parseUnits } from "viem";
import type { BountyCategory, Member, Notice, PayoutStatus, Reward } from "@/lib/types";

// ── 지급 상태 ─────────────────────────────────────────────
const PAYOUT_STATUSES: readonly PayoutStatus[] = ["PAID", "PARTIALLY_PAID", "PENDING", "NONE"];

/**
 * BE `payoutStatus` / `payment_status` → FE value. Missing (an older BE) → undefined so the caller can derive it; any value
 * this FE does not know yet → PENDING, the safe reading (never claims a payout that may not have happened).
 */
export function toPayoutStatus(value: unknown): PayoutStatus | undefined {
  if (value === undefined || value === null) return undefined;
  return PAYOUT_STATUSES.find((status) => status === value) ?? "PENDING";
}

// ── 날짜 ──────────────────────────────────────────────────
/**
 * The community's home zone. Date-only labels (notice "published" day, milestone dates) are cut in KST rather than UTC:
 * lists and details are server rendered, so the viewer's zone is unknown at render time, and a notice published at
 * 2026-10-31 01:30 KST must read the 31st, not the 30th. Bounty deadlines keep their own LocalDateTime handling.
 */
export const HOME_TIME_ZONE = "Asia/Seoul";
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const homeZoneIsoFormat = new Intl.DateTimeFormat("en-CA", { timeZone: HOME_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Locale-independent `YYYY-MM-DD` of the day in the home zone (KST) for machine-stable date strings; display dates use
 * the active locale instead. A value that is already a plain `YYYY-MM-DD` (DATE columns such as `event_date`) is
 * returned unchanged, never shifted. Missing or unparseable input yields `""` so one bad row never fails a whole list.
 */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  if (PLAIN_DATE.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : homeZoneIsoFormat.format(date);
}

/** Locale-aware display date for the home-zone (KST) day; same input rules as `formatIsoDate`. */
export function formatHomeZoneDate(value: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  // Plain dates are anchored at UTC noon so no zone can move the day.
  const date = new Date(PLAIN_DATE.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { ...options, timeZone: PLAIN_DATE.test(value) ? "UTC" : HOME_TIME_ZONE }).format(date);
}

/**
 * Locale-aware display date pinned to UTC, like the `timeZone: "UTC"` in `src/i18n/request.ts`, so a server in
 * another zone never shifts the day (`lib/{members,hall-of-fame}.ts` cannot use `getFormatter`: they are also
 * bundled into the client). Missing or unparseable input yields `""`.
 */
export function formatUtcDate(value: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

// ── URL ───────────────────────────────────────────────────
/**
 * 관리자가 입력한 URL(externalUrl, linkUrl, imageUrl, thumbnailUrl, coverImageUrl)을 href/src로 그리기
 * 전에 거른다. 허용: `http:`/`https:` 절대 URL, 또는 `/`로 시작하는 같은 출처 경로(`//`·`/\\`는 제외:
 * 프로토콜 상대 URL이 된다). 그 밖(`javascript:`, `data:`, 빈 값, 파싱 불가)은 null → 링크 없음/placeholder.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  // ASCII whitespace/control characters and backslashes are stripped or re-interpreted by URL parsers
  // ("/\t/evil.com" → "//evil.com", "\\" → "/"): reject them outright instead of trusting normalization.
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return null;
  if (value.startsWith("/")) {
    // "//host" is protocol-relative; a "." or ".." segment ("/.//evil.com") normalizes into one.
    return value[1] === "/" || /\/\.{1,2}(\/|$)/.test(value) ? null : value;
  }
  try {
    // `https:evil.com` parses as a valid absolute URL, but a browser resolves it as a relative path in href/src
    // (the BE `IsHttpUrl` rejects it too): require the `//` authority marker.
    if (!/^https?:\/\//i.test(value)) return null;
    const { protocol, username, password } = new URL(value);
    // Userinfo (`https://ninjalabs.xyz@evil.com`) disguises the real host; the BE refuses it under every URL rule.
    if (username || password) return null;
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

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

/** 알 수 없는 코드는 undefined - 호출부에서 기본값(보통 "Other")을 정한다 */
export function toCategoryLabel(code: string): BountyCategory | undefined {
  return Object.hasOwn(CATEGORY_LABELS, code) ? CATEGORY_LABELS[code as CategoryCode] : undefined;
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
  return Object.hasOwn(MEMBER_ROLE_LABELS, code) ? MEMBER_ROLE_LABELS[code as MemberRoleCode] : undefined;
}

export function toMemberRoleCode(label: string): MemberRoleCode | undefined {
  return Object.hasOwn(MEMBER_ROLE_CODES, label) ? MEMBER_ROLE_CODES[label as Member["role"]] : undefined;
}

// ── 공지 카테고리 ──────────────────────────────────────────
export const NOTICE_CATEGORY_LABELS = {
  NINJALABS: "Ninja Labs",
  INJECTIVE_ECOSYSTEM: "Injective ecosystem",
  EVENT: "Events",
  RECRUITMENT: "Recruitment",
  OTHER: "Other",
} as const satisfies Record<string, Notice["category"]>;

export type NoticeCategoryCode = keyof typeof NOTICE_CATEGORY_LABELS;

const NOTICE_CATEGORY_CODES = Object.fromEntries(
  Object.entries(NOTICE_CATEGORY_LABELS).map(([code, label]) => [label, code]),
) as Record<Notice["category"], NoticeCategoryCode>;

/** 알 수 없는 코드는 undefined - 호출부에서 기본값(보통 "Other")을 정한다 */
export function toNoticeCategoryLabel(code: string): Notice["category"] | undefined {
  return Object.hasOwn(NOTICE_CATEGORY_LABELS, code) ? NOTICE_CATEGORY_LABELS[code as NoticeCategoryCode] : undefined;
}

export function toNoticeCategoryCode(label: Notice["category"]): NoticeCategoryCode {
  return NOTICE_CATEGORY_CODES[label];
}

// ── 하이라이트 유형 ────────────────────────────────────────
/** BE `HIGHLIGHT_TYPES` (highlight-admin.controller.ts) 전부. 어드민 셀렉트와 공개 Hall of Fame 라벨이 여기서 나온다. */
export const HIGHLIGHT_TYPE_LABELS = {
  MILESTONE: "Milestone",
  FEATURED_BOUNTY: "Featured bounty",
  PROJECT: "Project",
  PARTNERSHIP: "Partnership",
  AWARD: "Award",
  OTHER: "Other",
} as const;

export type HighlightTypeCode = keyof typeof HIGHLIGHT_TYPE_LABELS;
export type HighlightTypeLabel = (typeof HIGHLIGHT_TYPE_LABELS)[HighlightTypeCode];

export const HIGHLIGHT_TYPE_CODES = Object.keys(HIGHLIGHT_TYPE_LABELS) as HighlightTypeCode[];

const HIGHLIGHT_TYPE_CODE_BY_LABEL = Object.fromEntries(
  Object.entries(HIGHLIGHT_TYPE_LABELS).map(([code, label]) => [label, code]),
) as Record<HighlightTypeLabel, HighlightTypeCode>;

export function isHighlightTypeCode(code: string): code is HighlightTypeCode {
  return Object.hasOwn(HIGHLIGHT_TYPE_LABELS, code);
}

/** 알 수 없는 코드는 undefined - 공개 화면은 "Other"로 표시하고, 어드민은 원문 코드를 그대로 보여 주며 다른 유형으로 바꿔 보내지 않는다 */
export function toHighlightTypeLabel(code: string): HighlightTypeLabel | undefined {
  return isHighlightTypeCode(code) ? HIGHLIGHT_TYPE_LABELS[code] : undefined;
}

export function toHighlightTypeCode(label: HighlightTypeLabel): HighlightTypeCode {
  return HIGHLIGHT_TYPE_CODE_BY_LABEL[label];
}

// ── 보상 토큰 ──────────────────────────────────────────────
/** 토큰별 온체인 소수 자릿수. BE 금액은 이 자릿수의 최소 단위 정수 문자열이다. */
export const TOKEN_DECIMALS: Record<Reward["currency"], number> = {
  INJ: 18,
  USDC: 6,
};

export type RewardRow = { symbol: string; amount: string };

function isRewardCurrency(symbol: string): symbol is Reward["currency"] {
  return Object.hasOwn(TOKEN_DECIMALS, symbol);
}

/** BE 보상 행(최소 단위) → 표시용 Reward. 모르는 토큰이나 정수가 아닌 금액은 null (다른 토큰으로 잘못 표시하지 않는다). */
export function toReward(row: RewardRow): Reward | null {
  const symbol = row.symbol.toUpperCase();
  if (!isRewardCurrency(symbol)) return null;
  try {
    return { amount: Number(formatUnits(BigInt(row.amount), TOKEN_DECIMALS[symbol])), currency: symbol };
  } catch {
    return null;
  }
}

/** 여러 보상 행 중 표시 가능한 것만 남긴다. */
export function toRewards(rows: readonly RewardRow[]): Reward[] {
  return rows.flatMap((row) => {
    const reward = toReward(row);
    return reward ? [reward] : [];
  });
}

/** 대표 보상 하나. 보상이 없거나 표시할 수 없으면 0 INJ. */
export function rewardFromBaseUnits(row: RewardRow | undefined): Reward {
  return (row ? toReward(row) : null) ?? { amount: 0, currency: "INJ" };
}

/** 표시용 Reward → BE에 보낼 최소 단위 정수 문자열 */
export function rewardToBaseUnits(reward: Reward): string {
  const decimals = TOKEN_DECIMALS[reward.currency];
  return parseUnits(toDecimalString(reward.amount, decimals), decimals).toString();
}

/**
 * `String(n)` switches to exponent notation below 1e-6 and from 1e21 (`"1e-7"`, `"1e+21"`), which `parseUnits` refuses.
 * Those two ranges are spelled out instead: integers through BigInt, tiny fractions with the token's decimals.
 */
function toDecimalString(amount: number, decimals: number): string {
  const text = String(amount);
  if (!/e/i.test(text)) return text;
  return Number.isInteger(amount) ? BigInt(amount).toString() : amount.toFixed(decimals);
}

/** 심볼의 소수 자릿수 (대소문자 무시). 모르는 토큰은 null - 금액을 다른 자릿수로 잘못 환산하지 않는다. */
export function tokenDecimalsFor(symbol: string): number | null {
  const upper = symbol.toUpperCase();
  return isRewardCurrency(upper) ? TOKEN_DECIMALS[upper] : null;
}

/**
 * BE 최소 단위 정수 문자열 → 사람 단위 10진 문자열 (`formatUnits`, 지수 표기 없음 - 표시는 `lib/format.ts formatTokenAmount`).
 * 모르는 토큰·정수가 아닌 값·null은 null.
 */
export function baseUnitsToHuman(base: string | null | undefined, symbol: string): string | null {
  const decimals = tokenDecimalsFor(symbol);
  if (decimals === null || !base || !/^\d+$/.test(base)) return null;
  return formatUnits(BigInt(base), decimals);
}

/**
 * The amount an operator types in the operations console. A token this UI knows (INJ, USDC) is entered in token units (`12.5`,
 * `humanToBaseUnits`). A token it does not know (any other ERC20 symbol the BE accepts, e.g. USDT) has no decimals here, and the
 * console already shows its amounts as base units, so the operator enters whole base units: a positive integer without leading
 * zeros (the BE `TOKEN_AMOUNT` rule). Null when the input is not acceptable.
 */
export function operatorAmountToBaseUnits(value: string, symbol: string): string | null {
  if (tokenDecimalsFor(symbol) !== null) return humanToBaseUnits(value, symbol);
  const trimmed = value.trim();
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : null;
}

/** What to prefill an amount input with: token units for a known token, the base-unit integer itself for an unknown one. */
export function operatorAmountFromBaseUnits(base: string | null | undefined, symbol: string): string {
  if (tokenDecimalsFor(symbol) !== null) return baseUnitsToHuman(base, symbol) ?? "";
  return base && /^\d+$/.test(base) ? base : "";
}

/**
 * 운영자가 입력한 사람 단위 금액(`12.5`) → BE에 보낼 최소 단위 정수 문자열. BE `TOKEN_AMOUNT`(양의 정수, 선행 0 없음)를
 * 만족하지 못하는 값 - 빈 값, 음수, 지수 표기, 토큰 자릿수보다 긴 소수, 0 - 과 모르는 토큰은 null.
 */
export function humanToBaseUnits(value: string, symbol: string): string | null {
  const decimals = tokenDecimalsFor(symbol);
  const trimmed = value.trim();
  if (decimals === null || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > decimals) return null;
  const base = parseUnits(trimmed, decimals);
  return base > BigInt(0) ? base.toString() : null;
}
