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
    title: form.title,
    sponsor: form.sponsor,
    reward: { amount, currency: form.currency },
    intakeEnabled: form.intake === "ON",
    submissionMode: form.submissionMode === "Agent" ? "agent" : "direct",
    coverImage: target.coverImage,
    deadline: new Date(form.deadline).toISOString(),
    tags: form.tags,
    description: form.description,
    submissionGuide: form.submissionGuide,
    deliverables: form.deliverables.split("\n").map((line) => line.trim()).filter(Boolean),
    reviewProcess: form.reviewProcess,
    status: target.existingStatus ?? (amount > 0 ? "funding" : "draft"),
  };
}
