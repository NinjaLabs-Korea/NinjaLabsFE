// Fixture-free admin types and pure helpers. Client islands (`components/admin/*`) import from here, never from
// `lib/admin.ts`, whose mock registries (bounties/members/notices/hall-of-fame fixtures) would otherwise be bundled
// into the shared client chunk. `lib/admin.ts` re-exports everything for server code and tests.
import { isHighlightTypeCode, type HighlightTypeCode } from "./api/codecs";
import { ERROR_COPY, listedCode, normalizedCode } from "./api/error-copy";
import { getAccessToken } from "./api/http";
import type { PublicListResource } from "./api/public";
import { validationFieldsFromError } from "./api/validation";
import { refreshPublicLists } from "./admin-revalidate";
import { noticeCategoryKeys } from "./notice-categories";
import type { Notice } from "./types";

/**
 * BE codes an admin write can return that deserve their own copy (`admin.common.errors.<code>`).
 * 코드 목록은 `lib/api/error-copy.ts`의 `ERROR_COPY.adminWrite`가 소유한다 - 추가/삭제는 거기서.
 */
export const ADMIN_API_ERROR_CODES = ERROR_COPY.adminWrite.codes;
export type AdminApiErrorCode = (typeof ADMIN_API_ERROR_CODES)[number];

export function adminApiErrorCode(error: unknown): AdminApiErrorCode | null {
  // `normalizedCode` maps the throttler's 429 and a refused session (401), which carry no catalog code of their own.
  return listedCode(normalizedCode(error), ADMIN_API_ERROR_CODES);
}

/** Toast description for a failed admin write: the mapped BE code's copy, else the action's generic `fallback`. */
export function adminErrorDescription(error: unknown, translate: (key: `errors.${AdminApiErrorCode}`) => string, fallback: string): string {
  const code = adminApiErrorCode(error);
  return code ? translate(`errors.${code}`) : fallback;
}

/**
 * A BE 400 `VALIDATION_FAILED` that names URL properties (`externalUrl`, `thumbnailUrl`, `imageUrl`, `linkUrl`, `coverImageUrl`) as inline
 * field errors instead of the generic save-failed toast. `publicUrl` when the BE message says the host must be public, else `urlInvalid`.
 * Keys are BE property names; callers map them to their own form fields. Empty when the error is something else.
 */
export const ADMIN_URL_PROPERTIES = ["externalUrl", "thumbnailUrl", "imageUrl", "linkUrl", "coverImageUrl"] as const;
export function adminUrlFieldErrors(error: unknown): Partial<Record<(typeof ADMIN_URL_PROPERTIES)[number], "publicUrl" | "urlInvalid">> {
  const fields = validationFieldsFromError(error);
  const result: Partial<Record<(typeof ADMIN_URL_PROPERTIES)[number], "publicUrl" | "urlInvalid">> = {};
  for (const property of ADMIN_URL_PROPERTIES) {
    if (Object.hasOwn(fields, property)) result[property] = fields[property].includes("public http(s)") ? "publicUrl" : "urlInvalid";
  }
  return result;
}

/**
 * A BE 400 `VALIDATION_FAILED` that says a text property has no visible characters or contains bidirectional/control formatting
 * characters (BE `visible-text.ts`), as inline field errors. `map` is BE property name -> the caller's form field key.
 * `required` for "must contain visible characters", `bidiChars` for the bidirectional/control messages. Empty for anything else.
 */
export function adminTextFieldErrors<Key extends string>(error: unknown, map: Readonly<Record<string, Key>>): Partial<Record<Key, "required" | "bidiChars">> {
  const fields = validationFieldsFromError(error);
  const result: Partial<Record<Key, "required" | "bidiChars">> = {};
  for (const [property, key] of Object.entries(map)) {
    if (!Object.hasOwn(fields, property)) continue;
    const message = fields[property];
    if (message.includes("bidirectional")) result[key] = "bidiChars";
    else if (message.includes("visible characters")) result[key] = "required";
  }
  return result;
}

/**
 * After a successful admin write, expire the cached public lists so `/notices`, `/bounties` and the hub reflect it on the next visit.
 * Fire and forget: the write already succeeded, so a failure here is only logged and never reaches the success toast.
 */
export function expirePublicLists(resources: readonly PublicListResource[]): void {
  const token = getAccessToken();
  if (!token) return;
  void refreshPublicLists(resources, token).catch((error: unknown) => console.error("expirePublicLists failed", error));
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
  /** BE `submission_deadline` ISO 원문. mock fixture도 ISO - `bountyToForm`은 ISO가 아닌 값을 조용히 받지 않는다. */
  deadline: string;
  /** BE `application_deadline` - 폼에 입력란이 없으므로 수정 시 그대로 되돌려 준다 */
  applicationDeadline: string | null;
  /** BE `max_winners` - PATCH는 불러온 값을 유지하고, 신규는 1을 보낸다 (폼에 입력란 없음) */
  maxWinners: number;
  tags: Array<"Dev" | "Design" | "Content" | "Other">;
  description: string;
  submissionGuide: string;
  /**
   * BE `requirements` 원문(markdown). `deliverables`는 이 값에서 표시용으로만 파생한다 - PATCH는 어드민이 산출물/제출 가이드
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
  /** 공지 카테고리와 같은 값 집합 - 정의는 `lib/types.ts Notice["category"]` 하나뿐이다. */
  category: Notice["category"];
  status: "draft" | "published";
  publishedAt: string | null;
  bodyMarkdown: string;
  thumbnail: string | null;
  externalUrl: string | null;
  /** BE `event_date` (`YYYY-MM-DD`): when the activity took place; null for a plain announcement. */
  eventDate?: string | null;
  /**
   * Notice summary. Loaded rows carry the stored BE `summary` (the form has no summary input). On save it means "the summary to
   * send": `undefined` on an edit = keep the stored one (omit the key); on create the API derives it from the body.
   */
  summary?: string;
};

/**
 * Summary to send when a notice is edited, or undefined to leave the stored one alone. The form has no summary input, so the
 * default is to keep it: a summary written through the API or the seed script must survive an edit or a publish toggle. Only a
 * summary the UI itself derived from the old body (a re-derivation reproduces it) follows the body when the body changes.
 */
export function summaryForPostUpdate(
  stored: Pick<AdminPost, "bodyMarkdown" | "summary"> | undefined,
  nextBody: string,
  derive: (markdown: string) => string,
): string | undefined {
  if (!stored || stored.summary === undefined) return undefined;
  if (stored.bodyMarkdown === nextBody) return undefined;
  return derive(stored.bodyMarkdown) === stored.summary ? derive(nextBody) : undefined;
}

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
