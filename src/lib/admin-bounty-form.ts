import type { AdminBounty } from "./admin";
import { BOUNTY_SPONSOR_MAX, BOUNTY_TEXT_MAX, BOUNTY_TITLE_MAX, MAX_WINNERS_MAX } from "@/lib/input-limits";
import { deliverablesFromRequirements } from "./admin-helpers";
import { hasVisibleText } from "./visible-text";
import { humanToBaseUnits, rewardToBaseUnits, tokenDecimalsFor } from "./api/codecs";

/** 어드민 바운티 폼의 입력 상태 (모든 값은 input/select가 다루는 문자열 형태) */
export type BountyFormValues = {
  title: string;
  sponsor: string;
  deadline: string;
  /** 지원 마감(선택, datetime-local 문자열). 빈 문자열 = 지원 마감 없음. 지원형 바운티에서만 입력란이 보인다. */
  applicationDeadline: string;
  amount: string;
  currency: "INJ" | "USDC";
  intake: "OFF" | "ON";
  submissionMode: "Direct" | "Agent";
  coverImage: string | null;
  tags: AdminBounty["tags"];
  description: string;
  /**
   * The BE `requirements` text: ONE input for what used to be two ("Submission guide" and "Deliverables"), because the BE has a
   * single `requirements` column. The public bounty page shows its bullet lines as the deliverables list and the whole text as the
   * submission guide. Two inputs mapped onto one column dropped the guide at create and let a guide edit erase the deliverables.
   */
  deliverables: string;
  reviewProcess: string;
  /** 최대 당선자 수: 1 이상 정수 문자열(BE `maxWinners` `@Min(1)`). 신규 기본 "1". */
  maxWinners: string;
  /**
   * BE가 돌려준 원본 ISO 마감. `deadline`(datetime-local 문자열)이 이 값의 로컬 표시와 같으면 저장 시 원본을 그대로 보낸다
   * - 로컬 ↔ UTC 변환을 다시 거치면 초/밀리초가 잘리고, 같은 시각을 "변경"으로 재전송하게 된다.
   */
  originalSubmissionDeadline?: string;
  /** BE가 돌려준 원본 지원 마감 ISO. `applicationDeadline` 입력이 이 값의 로컬 표시와 같으면 원본을 그대로 보낸다. */
  originalApplicationDeadline?: string | null;
  /**
   * BE `requirements` 원문. `deliverables` 입력란이 불러온 값과 같으면 저장 시 이 문자열을 바이트 그대로 보낸다
   * - 끝 공백 정리도 하지 않는다(안 고친 바운티를 저장해도 바이트가 바뀌지 않게).
   */
  originalRequirements?: string;
};

/** BE `TOKEN_AMOUNT`: at most 30 digits in base units, so the integer part may have 30 minus the token decimals digits (INJ 18 -> 12). */
const TOKEN_AMOUNT_MAX_DIGITS = 30;

/** Most digits allowed before the decimal point for a token with `decimals` decimals (INJ 18 -> 12, USDC 6 -> 24). */
export const rewardIntegerDigitsMax = (decimals: number) => TOKEN_AMOUNT_MAX_DIGITS - decimals;

/** Characters in code points, like BE `MaxChars` (a UTF-16 `.length` counts one emoji as 2 and rejected titles the BE accepts). */
export const codePointLength = (value: string) => [...value].length;

/** BE `DisplayTitle` (title, sponsorName): `isPlainDisplayText`; `DisplayBody` (description, requirements, evaluationCriteria): `hasNoBidiOverride`. */
const PLAIN_FORBIDDEN = /[\p{Cc}\u2028\u2029\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;
const BIDI_REORDERING = /[\u202A-\u202E\u2066-\u2069]/u;

/** Required / hidden-character verdict for one text field (client mirror of the BE visible-text rules); `undefined` when fine. */
function textRuleError(value: string, kind: "plain" | "body"): "required" | "bidiChars" | undefined {
  const text = value.trim();
  if (!hasVisibleText(text)) return "required";
  if ((kind === "plain" ? PLAIN_FORBIDDEN : BIDI_REORDERING).test(text)) return "bidiChars";
  return undefined;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/**
 * BE 타임스탬프 모양: ISO 8601 날짜+시각(+초/소수 초)+오프셋(Z 또는 ±hh:mm). `new Date("07.14")`처럼 V8이 관대하게 읽는 값은 거부한다.
 * 소수 초는 9자리까지 받는다: 컬럼을 JS Date로 직렬화하면 밀리초 3자리지만, 운영 화면 응답의 `json_build_object`(제출 리비전·심사 이력)는
 * Postgres가 마이크로초(`2026-10-25T12:34:56.123456+00:00`)로 내보낸다.
 */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isIsoDateTime(value: string): boolean {
  return ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime());
}

/**
 * ISO(UTC) → `<input type="datetime-local">` 값. 브라우저는 이 값을 **로컬 시각**으로 해석하므로 로컬 컴포넌트로 만든다
 * (`iso.slice(0, 16)`은 UTC 자릿수를 로컬로 읽어 KST에서 9시간씩 밀렸다). ISO가 아니거나 해석할 수 없는 값은 빈 문자열
 * (`"07.14"`는 V8이 2001-07-14로 읽어 버리므로 모양부터 확인한다).
 */
export function toLocalDateTimeInput(iso: string): string {
  if (!isIsoDateTime(iso)) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** datetime-local 값(로컬 시각) → ISO(UTC). `new Date("yyyy-MM-ddTHH:mm")`은 사양상 로컬로 해석된다. */
export function fromLocalDateTimeInput(local: string): string {
  return new Date(local).toISOString();
}

/**
 * 저장할 ISO 마감: 입력값이 원본의 로컬 표시와 같으면 원본 ISO를 그대로(바이트 동일) 돌려주고, 바뀐 경우에만 변환한다.
 */
export function resolveDeadlineIso(local: string, originalIso: string | undefined): string {
  if (originalIso && toLocalDateTimeInput(originalIso) === local) return originalIso;
  return fromLocalDateTimeInput(local);
}

export const emptyBountyForm = (): BountyFormValues => ({
  title: "",
  sponsor: "",
  deadline: "",
  applicationDeadline: "",
  amount: "",
  currency: "INJ",
  intake: "OFF",
  submissionMode: "Direct",
  coverImage: null,
  tags: ["Dev"],
  description: "",
  deliverables: "",
  reviewProcess: "",
  maxWinners: "1",
});

/**
 * 기존 바운티 → 수정 폼 초기값. 마감이 ISO로 해석되지 않으면(`"07.14"` 같은 값) 입력란은 비우고 원문은
 * `originalSubmissionDeadline`에 남겨 `validateBountyForm`이 `deadlineInvalid`로 막는다 - 조용히 받아 저장하지 않는다.
 */
export function bountyToForm(bounty: AdminBounty): BountyFormValues {
  return {
    title: bounty.title,
    sponsor: bounty.sponsor,
    deadline: toLocalDateTimeInput(bounty.deadline),
    applicationDeadline: bounty.applicationDeadline ? toLocalDateTimeInput(bounty.applicationDeadline) : "",
    // A bounty without a reward row maps to `{ amount: 0 }`; prefilling "0" would trip `amountInvalid` and block every edit of it.
    amount: bounty.reward.amount > 0 ? String(bounty.reward.amount) : "",
    currency: bounty.reward.currency,
    intake: bounty.intakeEnabled ? "ON" : "OFF",
    submissionMode: bounty.submissionMode === "agent" ? "Agent" : "Direct",
    coverImage: bounty.coverImage,
    tags: bounty.tags,
    description: bounty.description,
    // The raw BE text, not the parsed list: the list drops every non-bullet line (the guide prose).
    deliverables: bounty.requirements,
    reviewProcess: bounty.reviewProcess,
    maxWinners: String(bounty.maxWinners),
    originalSubmissionDeadline: bounty.deadline,
    originalApplicationDeadline: bounty.applicationDeadline,
    originalRequirements: bounty.requirements,
  };
}

/**
 * 저장할 `requirements`: 입력란이 불러온 값 그대로면 BE 원문을 바이트 동일하게, 고쳤으면 입력한 텍스트(앞뒤 공백만 정리, 줄바꿈·들여쓰기 유지).
 */
export function resolveRequirements(form: BountyFormValues): string {
  if (form.originalRequirements !== undefined && form.deliverables === form.originalRequirements) return form.originalRequirements;
  return form.deliverables.trim();
}

/**
 * 폼 입력 → 저장할 바운티.
 * 수정이면 기존 상태를 유지하고, 신규면 보상 금액이 있을 때 선입금 대기(funding)로 시작한다.
 */
export function formToBounty(
  form: BountyFormValues,
  target: { slug: string; coverImage: string | null; existingStatus?: AdminBounty["status"] },
): AdminBounty {
  const amount = Number(form.amount) || 0;
  const requirements = resolveRequirements(form);
  return {
    slug: target.slug,
    title: form.title.trim(),
    sponsor: form.sponsor.trim(),
    reward: { amount, currency: form.currency },
    intakeEnabled: form.intake === "ON",
    submissionMode: form.submissionMode === "Agent" ? "agent" : "direct",
    coverImage: target.coverImage,
    deadline: resolveDeadlineIso(form.deadline, form.originalSubmissionDeadline),
    applicationDeadline: form.applicationDeadline.trim() ? resolveDeadlineIso(form.applicationDeadline, form.originalApplicationDeadline ?? undefined) : null,
    maxWinners: Number(form.maxWinners.trim()),
    tags: form.tags,
    description: form.description.trim(),
    // `submissionGuide` mirrors `requirements` (one BE column); see `BountyFormValues.deliverables`.
    submissionGuide: requirements,
    requirements,
    deliverables: deliverablesFromRequirements(requirements),
    reviewProcess: form.reviewProcess.trim(),
    status: target.existingStatus ?? (amount > 0 ? "funding" : "draft"),
  };
}

/** 검증 실패 사유. 화면 문구는 messages `admin.bounties.form.errors.<사유>`에 있다. */
export type BountyFormError =
  | "required"
  | "titleTooLong"
  | "sponsorTooLong"
  | "deadlineInvalid"
  | "deadlinePast"
  | "applicationDeadlineInvalid"
  | "applicationDeadlineAfterDeadline"
  | "amountInvalid"
  | "deliverablesRequired"
  | "maxWinnersInvalid"
  | "tooLong"
  | "bidiChars"
  | "amountTooLarge";

/** BE `DEADLINE_UNCHANGED_TOLERANCE_MS`: an application deadline less than this after the submission deadline counts as "not later" (the datetime-local input drops seconds). */
export const APPLICATION_DEADLINE_TOLERANCE_MS = 60_000;
export type BountyFormErrors = Partial<Record<keyof BountyFormValues, BountyFormError>>;

/**
 * 보상 금액 입력이 BE에 보낼 수 있는 값인가: 일반 십진 표기(`1,5`·`0x10` 같은 입력은 값이 달라지거나 비어 버리므로 거부)이고 양수이며, 토큰 자릿수보다 긴 소수가 아니며(viem `parseUnits`는 초과 자릿수를 오류 없이
 * 반올림해 입력과 다른 금액을 보낸다), 최소 단위로 환산해도 0이 아니다(BE `TOKEN_AMOUNT`는 양의 정수). 지수 표기(`1e3`)는 거부한다: 보상은 생성 뒤 수정할 수 없고, `5e`·`1e18` 같은 오타가 엉뚱한 금액으로 저장된다.
 */
function isRewardAmountValid(raw: string, currency: BountyFormValues["currency"]): boolean {
  const text = raw.trim();
  // `Number` also reads "0x10" (16), "0b11" (3) and "1e3" (1000); only a plain decimal is an amount.
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return false;
  const amount = Number(text);
  const decimals = tokenDecimalsFor(currency);
  if (!Number.isFinite(amount) || amount <= 0 || decimals === null) return false;
  if (/^\d*\.\d+$/.test(text) && text.split(".")[1].length > decimals) return false;
  try {
    const baseUnits = rewardToBaseUnits({ amount, currency });
    // The form carries the amount as a JS number: more significant digits than a double holds (2^53) would be rounded to a
    // different amount than the one typed. The exact text conversion (plain decimals only) must agree with it.
    if (humanToBaseUnits(text.replace(/^\./, "0.").replace(/\.$/, ""), currency) !== baseUnits) return false;
    return BigInt(baseUnits) > BigInt(0);
  } catch {
    return false;
  }
}

/** Integer part longer than the BE 30-digit base-unit limit allows for this token (plain decimals only; anything else is `amountInvalid`). */
function isRewardAmountTooLarge(raw: string, currency: BountyFormValues["currency"]): boolean {
  const text = raw.trim();
  const decimals = tokenDecimalsFor(currency);
  if (decimals === null || !/^(\d+\.?\d*|\.\d+)$/.test(text)) return false;
  const integerPart = text.split(".")[0].replace(/^0+/, "");
  return integerPart.length > rewardIntegerDigitsMax(decimals);
}

/**
 * 저장 전 폼 검증. 필수 항목은 BE `CreateBountyDto`의 @IsNotEmpty 필드와 맞춘다
 * (title, sponsorName, description, requirements, evaluationCriteria, submissionDeadline).
 * BE 필수 필드가 바뀌면 여기와 `src/test/admin-bounty-form.test.ts`를 함께 고칠 것.
 * 마감일은 신규 생성이거나 기존 값에서 바뀐 경우에만 미래 시각이어야 한다
 * (`options.originalDeadline`은 datetime-local 문자열; 없으면 폼의 `originalSubmissionDeadline`에서 만든다).
 * 보상은 생성 때만 BE로 가므로(`saveAdminBounty`) `options.editing`이면 금액 입력은 검증하지 않는다.
 */
export function validateBountyForm(
  form: BountyFormValues,
  options: { originalDeadline?: string; now?: Date; editing?: boolean } = {},
): BountyFormErrors {
  const errors: BountyFormErrors = {};
  const blank = (value: string) => value.trim().length === 0;

  const titleRule = textRuleError(form.title, "plain");
  if (titleRule) errors.title = titleRule;
  else if (codePointLength(form.title.trim()) > BOUNTY_TITLE_MAX) errors.title = "titleTooLong";
  const sponsorRule = textRuleError(form.sponsor, "plain");
  if (sponsorRule) errors.sponsor = sponsorRule;
  else if (codePointLength(form.sponsor.trim()) > BOUNTY_SPONSOR_MAX) errors.sponsor = "sponsorTooLong";
  const descriptionRule = textRuleError(form.description, "body");
  if (descriptionRule) errors.description = descriptionRule;
  const reviewRule = textRuleError(form.reviewProcess, "body");
  if (reviewRule) errors.reviewProcess = reviewRule;
  if (blank(form.deliverables) || !hasVisibleText(form.deliverables)) errors.deliverables = "deliverablesRequired";
  else if (BIDI_REORDERING.test(form.deliverables)) errors.deliverables = "bidiChars";

  // 상한을 넘기면 BE가 400 VALIDATION_FAILED(일반 문구)로 답한다 - 어느 칸이 문제인지 여기서 알려 준다. 길이는 BE `MaxChars`와 같은 Trim 뒤 코드 포인트 단위.
  // The BE caps these with @MaxLength (UTF-16 units), unlike the title/sponsor @MaxChars.
  if (!errors.description && form.description.trim().length > BOUNTY_TEXT_MAX.description) errors.description = "tooLong";
  if (!errors.reviewProcess && form.reviewProcess.trim().length > BOUNTY_TEXT_MAX.reviewProcess) errors.reviewProcess = "tooLong";
  if (!errors.deliverables && resolveRequirements(form).trim().length > BOUNTY_TEXT_MAX.deliverables) errors.deliverables = "tooLong";

  if (blank(form.deadline)) {
    // A loaded record whose stored deadline is not ISO (bountyToForm emptied the input) is flagged as invalid, not merely missing.
    const storedUnparseable = form.originalSubmissionDeadline !== undefined && toLocalDateTimeInput(form.originalSubmissionDeadline) === "";
    errors.deadline = storedUnparseable ? "deadlineInvalid" : "required";
  } else {
    const deadline = new Date(form.deadline);
    const original = options.originalDeadline
      ?? (form.originalSubmissionDeadline ? toLocalDateTimeInput(form.originalSubmissionDeadline) : undefined);
    const changed = form.deadline !== original;
    if (Number.isNaN(deadline.getTime())) errors.deadline = "deadlineInvalid";
    else if (changed && deadline.getTime() <= (options.now ?? new Date()).getTime()) errors.deadline = "deadlinePast";
  }

  const applicationLocal = form.applicationDeadline.trim();
  if (applicationLocal) {
    const application = new Date(applicationLocal);
    if (Number.isNaN(application.getTime())) errors.applicationDeadline = "applicationDeadlineInvalid";
    else if (!errors.deadline && !blank(form.deadline)) {
      // Compare like the BE (`assertApplicationDeadlineNotAfterSubmission`) on the ISO values that will actually be sent.
      const submissionIso = resolveDeadlineIso(form.deadline, form.originalSubmissionDeadline);
      const applicationIso = resolveDeadlineIso(applicationLocal, form.originalApplicationDeadline ?? undefined);
      if (new Date(applicationIso).getTime() - new Date(submissionIso).getTime() >= APPLICATION_DEADLINE_TOLERANCE_MS) errors.applicationDeadline = "applicationDeadlineAfterDeadline";
    }
  }

  const winners = form.maxWinners.trim();
  if (!/^\d+$/.test(winners) || Number(winners) < 1 || Number(winners) > MAX_WINNERS_MAX) errors.maxWinners = "maxWinnersInvalid";

  if (!options.editing && !blank(form.amount)) {
    if (isRewardAmountTooLarge(form.amount, form.currency)) errors.amount = "amountTooLarge";
    else if (!isRewardAmountValid(form.amount, form.currency)) errors.amount = "amountInvalid";
  }

  return errors;
}
