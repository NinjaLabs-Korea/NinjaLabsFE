import { newestFirst } from "@/lib/account-order";
import type { Account, AccountApplication, AccountSubmission, ApplicationStatus, BountyStatusCode, PayoutAddressFields, SubmissionStatus } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { ApiHttp } from "@/lib/api/http";
import { unavailableReason } from "@/lib/api/unavailable";
import { fetchMe, toClientUser } from "@/lib/api/me";
import { createAdminApi } from "@/lib/api/admin";
import { createAdminCohortApi, createCohortApi } from "@/lib/api/cohorts";
import { toCategoryLabel, toPayoutStatus, type CategoryCode } from "@/lib/api/codecs";

/** BE GET /applications/me 행 */
type ApplicationRow = {
  id: string;
  /** Legacy agent-created rows carry a non-null `agent`. Read only to exclude them (agents are removed). */
  readonly agent?: unknown;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  message: string;
  applied_at: string;
  reviewed_at: string | null;
  /** Operator note from approving/rejecting the application; shown to the applicant. */
  review_note?: string | null;
  bounty_id: string;
  bounty_title: string;
  category: CategoryCode;
  /** Added by the BE after the first release; older BEs omit all three. */
  bounty_status?: BountyStatusCode;
  submission_deadline?: string;
  application_deadline?: string | null;
};

type SubmissionRow = {
  id?: string;
  /** Legacy agent-created rows carry a non-null `agent`. Read only to exclude them (agents are removed). */
  readonly agent?: unknown;
  bounty_title?: string;
  category?: string;
  submitted_at?: string;
  description?: string;
  /** Added with BE-1 (`GET /submissions/me`); older BEs omit all three. */
  submission_url?: string | null;
  repository_url?: string | null;
  commit_sha?: string | null;
  status: "SUBMITTED" | "RESUBMITTED" | "IN_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "REJECTED";
  bounty_id: string;
  /** 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'NONE' (unknown → PENDING); older BE omits it */
  payment_status?: string;
  /** latest `submission_review.comment`; older BE omits it */
  review_comment?: string | null;
  /** Added with BE-2 (`GET /submissions/me`); older BEs omit all three. */
  bounty_status?: BountyStatusCode;
  submission_deadline?: string;
  has_review?: boolean;
  /** BE #69 payout address (`inj1` lowercase / EIP-55 `0x`); an older BE omits all four. */
  payout_address?: string | null;
  payout_address_evm?: string | null;
  payout_address_updated_at?: string | null;
  payout_address_editable?: boolean;
};

/** The payout address fields of a submission row; every key is left out when the BE predates them (then no form is offered). */
function payoutFields(row: SubmissionRow): PayoutAddressFields {
  return {
    ...(row.id ? { submissionId: row.id } : {}),
    ...(row.payout_address !== undefined ? { payoutAddress: row.payout_address } : {}),
    ...(row.payout_address_evm !== undefined ? { payoutAddressEvm: row.payout_address_evm } : {}),
    ...(row.payout_address_updated_at !== undefined ? { payoutAddressUpdatedAt: row.payout_address_updated_at } : {}),
    ...(typeof row.payout_address_editable === "boolean" ? { payoutAddressEditable: row.payout_address_editable } : {}),
  };
}

/** A REJECTED submission that no reviewer ever looked at because the sponsor cancelled the bounty. Unknown (fields absent) = false. */
function closedByCancellation(row: SubmissionRow): boolean {
  return row.status === "REJECTED" && row.has_review === false && row.bounty_status === "CANCELLED";
}

const SUBMISSION_STATUS: Record<SubmissionRow["status"], SubmissionStatus> = {
  SUBMITTED: "submitted",
  RESUBMITTED: "resubmitted",
  IN_REVIEW: "in_review",
  REVISION_REQUESTED: "revision_requested",
  APPROVED: "approved",
  REJECTED: "rejected",
};

function toSubmission(row: SubmissionRow): AccountSubmission {
  return {
    bountySlug: row.bounty_id,
    status: SUBMISSION_STATUS[row.status] ?? "submitted",
    paymentStatus: toPayoutStatus(row.payment_status) ?? "NONE",
    reviewComment: row.review_comment?.trim() || null,
    ...payoutFields(row),
    ...(closedByCancellation(row) ? { closedByCancellation: true } : {}),
    ...(row.submission_url ? { submissionUrl: row.submission_url } : {}),
    ...(row.repository_url ? { repositoryUrl: row.repository_url } : {}),
    ...(row.commit_sha ? { commitSha: row.commit_sha } : {}),
    ...(row.description ? { description: row.description } : {}),
  };
}

/** A submission with no application behind it  as a /applications row. */
const SUBMISSION_AS_APPLICATION: Record<SubmissionRow["status"], ApplicationStatus> = {
  SUBMITTED: "submitted",
  RESUBMITTED: "submitted",
  IN_REVIEW: "submitted",
  REVISION_REQUESTED: "revisionRequested",
  APPROVED: "completed",
  REJECTED: "notAccepted",
};

function submissionToRow(row: SubmissionRow): AccountApplication {
  const submission = toSubmission(row);
  return {
    id: `submission:${row.id ?? `${row.bounty_id}:self`}`,
    source: "submission",
    bountySlug: row.bounty_id,
    bountyTitle: row.bounty_title ?? row.bounty_id,
    category: toCategoryLabel(row.category ?? "") ?? "Other",
    appliedAt: row.submitted_at ?? new Date(0).toISOString(),
    note: row.description ?? "",
    status: SUBMISSION_AS_APPLICATION[row.status] ?? "submitted",
    reviewComment: submission.reviewComment,
    reviewNote: null,
    paymentStatus: submission.paymentStatus,
    ...payoutFields(row),
    ...(submission.closedByCancellation ? { closedByCancellation: true } : {}),
    ...(row.bounty_status ? { bountyStatus: row.bounty_status } : {}),
    ...(row.submission_deadline ? { submissionDeadline: row.submission_deadline } : {}),
  };
}

function toApplication(row: ApplicationRow): AccountApplication {
  return {
    id: row.id,
    source: "application",
    bountySlug: row.bounty_id,
    bountyTitle: row.bounty_title,
    category: toCategoryLabel(row.category) ?? "Other",
    appliedAt: row.applied_at,
    note: row.message,
    // BE PENDING = 지원 완료(심사 대기) → FE 첫 단계 "open"(Applied)
    status: row.status === "APPROVED" ? "approved" : row.status === "REJECTED" ? "rejected" : "open",
    reviewComment: null,
    reviewNote: row.review_note?.trim() || null,
    paymentStatus: "NONE",
    ...(row.bounty_status ? { bountyStatus: row.bounty_status } : {}),
    ...(row.submission_deadline ? { submissionDeadline: row.submission_deadline } : {}),
    ...(row.application_deadline !== undefined ? { applicationDeadline: row.application_deadline } : {}),
  };
}

/** Agent rows are excluded: they collide with the owner's row on bounty_id (agents are removed, legacy data only). */
const isOwnerRow = (row: { readonly agent?: unknown }): boolean => row.agent == null;

const unavailable = <T>(error: unknown): ApiResult<T> => ({ status: "unavailable", reason: unavailableReason(error) });

/** api 모드 실제 클라이언트: BE 계약(docs/api-contract.md)에 연결 */
export function createApiApiClient(http: ApiHttp): ApiClient {
  // The bounty detail asks for /applications/me (joined with /submissions/me) and /submissions/me side by side. Reads that are
  // already in flight are shared; the entry is dropped once the request settles, so a refresh after a mutation hits the network.
  const inFlight = new Map<string, Promise<unknown>>();
  const sharedGet = <T,>(path: string): Promise<T> => {
    const pending = inFlight.get(path);
    if (pending) return pending as Promise<T>;
    const request = http.fetchJson<T>(path).finally(() => {
      if (inFlight.get(path) === request) inFlight.delete(path);
    });
    inFlight.set(path, request);
    return request;
  };
  return {
    getAccount: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: null };
      try {
        const me = await fetchMe(http);
        return { status: "available", data: me ? { user: toClientUser(me) } : null };
      } catch (error) {
        return unavailable<Account | null>(error);
      }
    },

    getApplications: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const [allRows, allSubmissions] = await Promise.all([
          sharedGet<ApplicationRow[]>("/applications/me"),
          sharedGet<SubmissionRow[]>("/submissions/me"),
        ]);
        // 에이전트 행은 소유자 행과 bounty_id가 충돌하므로 제외
        const rows = allRows.filter(isOwnerRow);
        const submissions = allSubmissions.filter(isOwnerRow);
        // One participant row per bounty: match each application to its own submission.
        const submissionsByRow = new Map(submissions.map((submission) => [submission.bounty_id, submission]));
        // Submissions that belong to an application row are joined below; the rest (direct bounties) are listed on their own.
        const applicationKeys = new Set(rows.filter((row) => row.status !== "WITHDRAWN").map((row) => row.bounty_id));
        const standalone = submissions.filter((submission) => !applicationKeys.has(submission.bounty_id)).map(submissionToRow);
        return {
          status: "available",
          // 철회 건은 FE 진행 단계 모델에 없으므로 제외. 반려 건은 상세/목록에서 상태를 보여주기 위해 유지
          data: newestFirst([...rows
            .filter((row) => row.status !== "WITHDRAWN")
            .map((row) => {
              const application = toApplication(row);
              const submission = submissionsByRow.get(row.bounty_id);
              if (!submission || application.status !== "approved") return application;
              // REJECTED is final (also a reward-not-paid case: approved work, no payout) - not another "Submitted" step.
              if (submission.status === "REJECTED") {
                return {
                  ...application,
                  status: "notAccepted" as const,
                  reviewComment: submission.review_comment?.trim() || null,
                  ...(closedByCancellation(submission) ? { closedByCancellation: true } : {}),
                };
              }
              if (submission.status === "REVISION_REQUESTED") {
                return { ...application, status: "revisionRequested" as const, reviewComment: submission.review_comment?.trim() || null };
              }
              if (submission.status === "APPROVED") {
                return { ...application, status: "completed" as const, paymentStatus: toSubmission(submission).paymentStatus, ...payoutFields(submission) };
              }
              return { ...application, status: "submitted" as const };
            }), ...standalone]),
        };
      } catch (error) {
        return unavailable<readonly AccountApplication[]>(error);
      }
    },

    getSubmissions: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await sharedGet<SubmissionRow[]>("/submissions/me");
        // 에이전트 행은 소유자 행과 bounty_id가 충돌하므로 제외
        return { status: "available", data: rows.filter(isOwnerRow).map(toSubmission) };
      } catch (error) {
        return unavailable<readonly AccountSubmission[]>(error);
      }
    },

    applyToBounty: (bountyId, input) =>
      http.fetchJson(`/bounties/${encodeURIComponent(bountyId)}/applications`, {
        method: "POST",
        body: input,
      }),

    withdrawApplication: (applicationId) =>
      http.fetchJson(`/applications/${encodeURIComponent(applicationId)}/withdraw`, { method: "POST" }),

    setPayoutAddress: (submissionId, address) =>
      http.fetchJson(`/submissions/${encodeURIComponent(submissionId)}/payout-address`, { method: "PUT", body: { address: address.trim() } }),

    submitBounty: (bountyId, input) =>
      http.fetchJson(`/bounties/${encodeURIComponent(bountyId)}/submissions`, {
        method: "POST",
        body: input,
      }),

    checkNickname: (nickname) =>
      http.fetchJson<{ available: boolean }>(`/users/check-nickname?nickname=${encodeURIComponent(nickname)}`),

    completeProfile: async ({ nickname, bio, tags }) => {
      await http.fetchJson("/users/me/profile", {
        method: "POST",
        body: { nickname, bio, tags },
      });
    },

    completeOnboarding: async () => {
      await http.fetchJson("/users/me/complete-onboarding", { method: "POST" });
    },

    withdrawAccount: async (confirmNickname) => {
      await http.fetchJson("/users/me", { method: "DELETE", body: { confirmNickname } });
    },

    uploadAvatar: async (file) => {
      const form = new FormData();
      form.set("file", file);
      return http.fetchForm<{ avatarUrl: string }>("/users/me/avatar", form);
    },

    removeAvatar: async () => {
      await http.fetchJson("/users/me/avatar", { method: "DELETE" });
    },
    ...createCohortApi(http),
    ...createAdminApi(http),
    ...createAdminCohortApi(http),
  };
}
