// Fixture-free admin types and pure helpers. Client islands (`components/admin/*`) import from here, never from
// `lib/admin.ts`, whose mock registries (bounties/members/notices/hall-of-fame fixtures) would otherwise be bundled
// into the shared client chunk. `lib/admin.ts` re-exports everything for server code and tests.
import { isHighlightTypeCode, type HighlightTypeCode } from "./api/codecs";
import { ERROR_COPY, knownCode } from "./api/error-copy";
import { ApiHttpError } from "./api/http";
import { noticeCategoryKeys } from "./notice-categories";
import type { Notice } from "./types";

/**
 * BE codes an admin write can return that deserve their own copy (`admin.common.errors.<code>`).
 * 코드 목록은 `lib/api/error-copy.ts`의 `ERROR_COPY.adminWrite`가 소유한다 — 추가/삭제는 거기서.
 */
export const ADMIN_API_ERROR_CODES = ERROR_COPY.adminWrite.codes;
export type AdminApiErrorCode = (typeof ADMIN_API_ERROR_CODES)[number];

export function adminApiErrorCode(error: unknown): AdminApiErrorCode | null {
  // Same status normalization as `opsErrorCode`: the throttler's 429 and a refused session carry no catalog code of their own.
  if (error instanceof ApiHttpError) {
    if (error.status === 429) return "TOO_MANY_REQUESTS";
    if (error.status === 401) return "UNAUTHORIZED";
  }
  return knownCode(error, ADMIN_API_ERROR_CODES);
}

/** Toast description for a failed admin write: the mapped BE code's copy, else the action's generic `fallback`. */
export function adminErrorDescription(error: unknown, translate: (key: `errors.${AdminApiErrorCode}`) => string, fallback: string): string {
  const code = adminApiErrorCode(error);
  return code ? translate(`errors.${code}`) : fallback;
}

/** Postgres INTEGER ceiling: BE `MaxPgInt` on `displayOrder` (member and highlight ordering). Above it the BE answers 400. */
export const DISPLAY_ORDER_MAX = 2_147_483_647;

export type AdminUser = {
  slug: string;
  nickname: string;
  email: string;
  joinedAt: string;
  walletAddress: string | null;
  walletStatus: "linked" | null;
  isMember: boolean;
  memberRole: "Core" | "Dev" | "Design" | "Ops" | null;
  memberDisplayOrder: number | null;
};

export type AdminBounty = {
  slug: string;
  title: string;
  sponsor: string;
  reward: { amount: number; currency: "INJ" | "USDC" };
  rewardContractAddress?: string;
  rewardChainId?: number;
  intakeEnabled: boolean;
  submissionMode: "direct" | "agent";
  coverImage: string | null;
  /** One value per BE status (`DRAFT` ... `CANCELLED`) so the list can tell a finished bounty from a cancelled one and a closed intake from a review in progress. */
  status: "draft" | "funding" | "active" | "submissionClosed" | "reviewing" | "completed" | "cancelled";
  /** BE `submission_deadline` ISO 원문. mock fixture도 ISO — `bountyToForm`은 ISO가 아닌 값을 조용히 받지 않는다. */
  deadline: string;
  /** BE `application_deadline` — 폼에 입력란이 없으므로 수정 시 그대로 되돌려 준다 */
  applicationDeadline: string | null;
  /** BE `max_winners` — PATCH는 불러온 값을 유지하고, 신규는 1을 보낸다 (폼에 입력란 없음) */
  maxWinners: number;
  tags: Array<"Dev" | "Design" | "Content" | "Other">;
  description: string;
  submissionGuide: string;
  /**
   * BE `requirements` 원문(markdown). `deliverables`는 이 값에서 표시용으로만 파생한다 — PATCH는 어드민이 산출물/제출 가이드
   * 입력란을 고치지 않은 한 이 문자열을 바이트 그대로 되돌려 보낸다 (줄바꿈/들여쓰기를 잃는 join/split 왕복 금지).
   */
  requirements: string;
  /** 표시용: `requirements`의 비어 있지 않은 줄 (trim). 저장은 `requirements`가 기준이다. */
  deliverables: string[];
  reviewProcess: string;
};

/**
 * `type`은 BE 코드 그대로 (`MILESTONE` … `OTHER`, `lib/api/codecs.ts HIGHLIGHT_TYPE_LABELS`). 모르는 코드도 원문을 유지한다:
 * 화면은 코드를 그대로 보여 주고, PATCH는 어드민이 유형을 바꾼 경우에만 `type`을 보낸다.
 */
export type AdminHighlight = {
  id: string;
  type: HighlightTypeCode | (string & {});
  title: string;
  order: number;
  link?: string;
  image: string | null;
  description?: string;
  published?: boolean;
};

export type AdminPost = {
  slug: string;
  title: string;
  /** 공지 카테고리와 같은 값 집합 — 정의는 `lib/types.ts Notice["category"]` 하나뿐이다. */
  category: Notice["category"];
  status: "draft" | "published";
  publishedAt: string | null;
  bodyMarkdown: string;
  thumbnail: string | null;
  externalUrl: string | null;
};

/**
 * `publish` option for `saveAdminPost`: always sent on create (derived from the chosen status); on edit only when the
 * status toggled. A plain edit omits it so the BE keeps the existing `published_at` - omission is the contract.
 */
export function publishOptionFor(
  previousStatus: AdminPost["status"] | undefined,
  nextStatus: AdminPost["status"],
  mode: "create" | "edit",
): { publish: boolean } | undefined {
  if (mode === "edit" && previousStatus === nextStatus) return undefined;
  return { publish: nextStatus === "published" };
}

/** Same contract for highlights (`is_published` boolean): `publish` only on create or when the published state toggled. */
export function highlightPublishOptionFor(
  previousPublished: boolean | undefined,
  nextPublished: boolean,
  mode: "create" | "edit",
): { publish: boolean } | undefined {
  const toStatus = (published: boolean | undefined): AdminPost["status"] | undefined =>
    published === undefined ? undefined : published ? "published" : "draft";
  return publishOptionFor(toStatus(previousPublished), toStatus(nextPublished) ?? "draft", mode);
}

// Message keys (admin namespace `hallOfFame.highlights.types`) for displayed enum labels; the codes themselves stay API-facing.
export const highlightTypeLabelKeys: Record<HighlightTypeCode, string> = {
  MILESTONE: "milestone",
  FEATURED_BOUNTY: "featuredBounty",
  PROJECT: "project",
  PARTNERSHIP: "partnership",
  AWARD: "award",
  OTHER: "other",
};

/** Message key for a highlight type code, or null for a code this FE does not know (render the raw code instead). */
export function highlightTypeLabelKey(type: string): string | null {
  return isHighlightTypeCode(type) ? highlightTypeLabelKeys[type] : null;
}

/** Deliverables shown for a BE `requirements` string: its non-empty lines, trimmed. Display only - never re-joined for saving. */
export function deliverablesFromRequirements(requirements: string): string[] {
  return requirements.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** 어드민 공지 카테고리 라벨 키 = 공개 공지와 같은 표. 카테고리를 추가/개명할 때는 `lib/notice-categories.ts`만 고친다. */
export const postCategoryLabelKeys: Record<AdminPost["category"], string> = noticeCategoryKeys;
