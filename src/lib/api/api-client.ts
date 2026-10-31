import { newestFirst } from "@/lib/account-order";
import type { Account, AccountAgent, AccountAgentRef, AccountApplication, AccountSubmission, ApplicationStatus, BountyStatusCode, SubmissionStatus } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { ApiHttp } from "@/lib/api/http";
import { unavailableReason } from "@/lib/api/unavailable";
import { fetchMe, toClientUser } from "@/lib/api/me";
import { createAdminApi } from "@/lib/api/admin";
import { createAdminCohortApi, createCohortApi } from "@/lib/api/cohorts";
import { toCategoryLabel, toPayoutStatus, type CategoryCode } from "@/lib/api/codecs";

/** Agent that acted on the owner's behalf (null = the owner acted directly). Rows for agent-made entries are included in /me lists. */
type AgentRef = { id: string; name: string } | null;

/** BE GET /applications/me 행 */
type ApplicationRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  message: string;
  applied_at: string;
  reviewed_at: string | null;
  /** Operator note from approving/rejecting the application; shown to the applicant. */
  review_note?: string | null;
  bounty_id: string;
  bounty_title: string;
  category: CategoryCode;
  agent?: AgentRef;
  /** Added by the BE after the first release; older BEs omit all three. */
  bounty_status?: BountyStatusCode;
  submission_deadline?: string;
  application_deadline?: string | null;
};

/** BE GET /agents/me 행 (one row per agent; no duplicates) */
type AgentRow = {
  id: string;
  name: string;
  description: string | null;
  status: AccountAgent["status"];
  wallet_address: string;
  verified_at: string | null;
  created_at: string;
  completed_bounties: number;
  key_prefix: string | null;
  key_status: AccountAgent["keyStatus"];
  key_expires_at: string | null;
};

type SubmissionRow = {
  id?: string;
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
  agent?: AgentRef;
  /** 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'NONE' (unknown → PENDING); older BE omits it */
  payment_status?: string;
  /** latest `submission_review.comment`; older BE omits it */
  review_comment?: string | null;
  /** Added with BE-2 (`GET /submissions/me`); older BEs omit all three. */
  bounty_status?: BountyStatusCode;
  submission_deadline?: string;
  has_review?: boolean;
};

/** A REJECTED submission that no reviewer ever looked at because the sponsor cancelled the bounty. Unknown (fields absent) = false. */
function closedByCancellation(row: SubmissionRow): boolean {
  return row.status === "REJECTED" && row.has_review === false && row.bounty_status === "CANCELLED";
}

function toAgentRef(agent: AgentRef | undefined): AccountAgentRef | null {
  return agent ? { id: agent.id, name: agent.name } : null;
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
    agent: toAgentRef(row.agent),
    paymentStatus: toPayoutStatus(row.payment_status) ?? "NONE",
    reviewComment: row.review_comment?.trim() || null,
    ...(closedByCancellation(row) ? { closedByCancellation: true } : {}),
    ...(row.submission_url ? { submissionUrl: row.submission_url } : {}),
    ...(row.repository_url ? { repositoryUrl: row.repository_url } : {}),
    ...(row.commit_sha ? { commitSha: row.commit_sha } : {}),
    ...(row.description ? { description: row.description } : {}),
  };
}

/** A submission with no application behind it (direct or agent-mode bounty) as a /applications row. */
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
    id: `submission:${row.id ?? `${row.bounty_id}:${row.agent?.id ?? "self"}`}`,
    source: "submission",
    bountySlug: row.bounty_id,
    bountyTitle: row.bounty_title ?? row.bounty_id,
    category: toCategoryLabel(row.category ?? "") ?? "Other",
    appliedAt: row.submitted_at ?? new Date(0).toISOString(),
    note: row.description ?? "",
    status: SUBMISSION_AS_APPLICATION[row.status] ?? "submitted",
    agent: submission.agent,
    reviewComment: submission.reviewComment,
    reviewNote: null,
    paymentStatus: submission.paymentStatus,
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
    agent: toAgentRef(row.agent),
    reviewComment: null,
    reviewNote: row.review_note?.trim() || null,
    paymentStatus: "NONE",
    ...(row.bounty_status ? { bountyStatus: row.bounty_status } : {}),
    ...(row.submission_deadline ? { submissionDeadline: row.submission_deadline } : {}),
    ...(row.application_deadline !== undefined ? { applicationDeadline: row.application_deadline } : {}),
  };
}

function toAgent(row: AgentRow): AccountAgent {
  return {
    id: row.id,
    name: row.name,
    walletAddress: row.wallet_address,
    status: row.status,
    verified: row.status === "ACTIVE",
    completedBounties: row.completed_bounties ?? 0,
    // 원문 키는 발급/회전 응답 1회만 노출, 목록에서는 prefix 마스킹만 제공된다
    apiKeyMasked: row.key_prefix ? `${row.key_prefix}••••••••` : "-",
    keyExpiresAt: row.key_expires_at ?? null,
    keyStatus: row.key_status ?? null,
    registeredAt: row.created_at,
  };
}

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
        const [rows, submissions] = await Promise.all([
          sharedGet<ApplicationRow[]>("/applications/me"),
          sharedGet<SubmissionRow[]>("/submissions/me"),
        ]);
        // Owner and agent rows can coexist on one bounty: match each application to its own submission.
        const submissionKey = (bountyId: string, agent: AgentRef | undefined) => `${bountyId}:${agent?.id ?? "self"}`;
        const submissionsByRow = new Map(submissions.map((submission) => [submissionKey(submission.bounty_id, submission.agent), submission]));
        // Submissions that belong to an application row are joined below; the rest (direct and agent-mode bounties) are listed on their own.
        const applicationKeys = new Set(rows.filter((row) => row.status !== "WITHDRAWN").map((row) => submissionKey(row.bounty_id, row.agent)));
        const standalone = submissions.filter((submission) => !applicationKeys.has(submissionKey(submission.bounty_id, submission.agent))).map(submissionToRow);
        return {
          status: "available",
          // 철회 건은 FE 진행 단계 모델에 없으므로 제외. 반려 건은 상세/목록에서 상태를 보여주기 위해 유지
          data: newestFirst([...rows
            .filter((row) => row.status !== "WITHDRAWN")
            .map((row) => {
              const application = toApplication(row);
              const submission = submissionsByRow.get(submissionKey(row.bounty_id, row.agent));
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
                return { ...application, status: "completed" as const, paymentStatus: toSubmission(submission).paymentStatus };
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
        return { status: "available", data: rows.map(toSubmission) };
      } catch (error) {
        return unavailable<readonly AccountSubmission[]>(error);
      }
    },

    getAgents: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await http.fetchJson<AgentRow[]>("/agents/me");
        return { status: "available", data: rows.map(toAgent) };
      } catch (error) {
        return unavailable<readonly AccountAgent[]>(error);
      }
    },

    applyToBounty: (bountyId, input) =>
      http.fetchJson(`/bounties/${encodeURIComponent(bountyId)}/applications`, {
        method: "POST",
        body: input,
      }),

    withdrawApplication: (applicationId) =>
      http.fetchJson(`/applications/${encodeURIComponent(applicationId)}/withdraw`, { method: "POST" }),

    submitBounty: (bountyId, input) =>
      http.fetchJson(`/bounties/${encodeURIComponent(bountyId)}/submissions`, {
        method: "POST",
        body: input,
      }),

    registerAgent: ({ name, description, walletAddress }) =>
      http.fetchJson("/agents", {
        method: "POST",
        body: { name, ...(description ? { description } : {}), walletAddress },
      }),

    verifyAgent: (agentId, signature) =>
      http.fetchJson(`/agents/${encodeURIComponent(agentId)}/verify`, {
        method: "POST",
        body: { signature },
      }),

    rotateAgentKey: (agentId) =>
      http.fetchJson(`/agents/${encodeURIComponent(agentId)}/keys/rotate`, { method: "POST" }),

    revokeAgent: (agentId) =>
      http.fetchJson(`/agents/${encodeURIComponent(agentId)}/revoke`, { method: "POST" }),

    createWalletChallenge: (address) =>
      http.fetchJson<{ message: string }>("/wallets/challenge", {
        method: "POST",
        body: { address },
      }),

    verifyWallet: async (address, signature, publicKey) => {
      await http.fetchJson("/wallets/verify", {
        method: "POST",
        body: { address, signature, ...(publicKey ? { publicKey } : {}) },
      });
    },

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
    ...createCohortApi(http),
    ...createAdminApi(http),
    ...createAdminCohortApi(http),
  };
}
