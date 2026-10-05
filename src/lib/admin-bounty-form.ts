import type { AdminBounty } from "./admin";

/** 어드민 바운티 폼의 입력 상태 (모든 값은 input/select가 다루는 문자열 형태) */
export type BountyFormValues = {
  title: string;
  sponsor: string;
  deadline: string;
  amount: string;
  currency: "INJ" | "USDC";
  intake: "OFF" | "ON";
  submissionMode: "Direct" | "Agent";
  coverImage: string | null;
  tags: AdminBounty["tags"];
  description: string;
  submissionGuide: string;
  deliverables: string;
  reviewProcess: string;
};

export const emptyBountyForm = (): BountyFormValues => ({
  title: "",
  sponsor: "",
  deadline: "",
  amount: "",
  currency: "INJ",
  intake: "OFF",
  submissionMode: "Direct",
  coverImage: null,
  tags: ["Dev"],
  description: "",
  submissionGuide: "",
  deliverables: "",
  reviewProcess: "",
});

/** 기존 바운티 → 수정 폼 초기값 */
export function bountyToForm(bounty: AdminBounty): BountyFormValues {
  return {
    title: bounty.title,
    sponsor: bounty.sponsor,
    deadline: bounty.deadline.slice(0, 16),
    amount: String(bounty.reward.amount),
    currency: bounty.reward.currency,
    intake: bounty.intakeEnabled ? "ON" : "OFF",
    submissionMode: bounty.submissionMode === "agent" ? "Agent" : "Direct",
    coverImage: bounty.coverImage,
    tags: bounty.tags,
    description: bounty.description,
    submissionGuide: bounty.submissionGuide,
    deliverables: bounty.deliverables.join("\n"),
    reviewProcess: bounty.reviewProcess,
  };
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
  return {
    slug: target.slug,
    title: form.title.trim(),
    sponsor: form.sponsor.trim(),
    reward: { amount, currency: form.currency },
    intakeEnabled: form.intake === "ON",
    submissionMode: form.submissionMode === "Agent" ? "agent" : "direct",
    coverImage: target.coverImage,
    deadline: new Date(form.deadline).toISOString(),
    tags: form.tags,
    description: form.description.trim(),
    submissionGuide: form.submissionGuide.trim(),
    deliverables: form.deliverables.split("\n").map((line) => line.trim()).filter(Boolean),
    reviewProcess: form.reviewProcess.trim(),
    status: target.existingStatus ?? (amount > 0 ? "funding" : "draft"),
  };
}

/** 검증 실패 사유. 화면 문구는 messages `admin.bounties.form.errors.<사유>`에 있다. */
export type BountyFormError = "required" | "deadlineInvalid" | "deadlinePast" | "amountInvalid" | "deliverablesRequired";
export type BountyFormErrors = Partial<Record<keyof BountyFormValues, BountyFormError>>;

/**
 * 저장 전 폼 검증. 필수 항목은 BE `CreateBountyDto`의 @IsNotEmpty 필드와 맞춘다
 * (title, sponsorName, description, requirements, evaluationCriteria, submissionDeadline).
 * BE 필수 필드가 바뀌면 여기와 `src/test/admin-bounty-form.test.ts`를 함께 고칠 것.
 * 마감일은 신규 생성이거나 기존 값에서 바뀐 경우에만 미래 시각이어야 한다.
 */
export function validateBountyForm(
  form: BountyFormValues,
  options: { originalDeadline?: string; now?: Date } = {},
): BountyFormErrors {
  const errors: BountyFormErrors = {};
  const blank = (value: string) => value.trim().length === 0;

  if (blank(form.title)) errors.title = "required";
  if (blank(form.sponsor)) errors.sponsor = "required";
  if (blank(form.description)) errors.description = "required";
  if (blank(form.reviewProcess)) errors.reviewProcess = "required";
  if (blank(form.deliverables) && blank(form.submissionGuide)) errors.deliverables = "deliverablesRequired";

  if (blank(form.deadline)) {
    errors.deadline = "required";
  } else {
    const deadline = new Date(form.deadline);
    const changed = form.deadline !== options.originalDeadline;
    if (Number.isNaN(deadline.getTime())) errors.deadline = "deadlineInvalid";
    else if (changed && deadline.getTime() <= (options.now ?? new Date()).getTime()) errors.deadline = "deadlinePast";
  }

  if (!blank(form.amount)) {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) errors.amount = "amountInvalid";
  }

  return errors;
}
