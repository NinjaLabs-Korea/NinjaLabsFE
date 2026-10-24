import type { Account, AccountAgent, AccountAgentRef, AccountApplication, AccountSubmission, SubmissionStatus } from "@/lib/contracts/account";
import type { ApiClient, ApiResult, ApiUnavailable } from "@/lib/contracts/api";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { fetchMe, toClientUser } from "@/lib/api/me";
import { createAdminApi } from "@/lib/api/admin";
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
  bounty_id: string;
  bounty_title: string;
  category: CategoryCode;
  agent?: AgentRef;
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
  status: "SUBMITTED" | "RESUBMITTED" | "IN_REVIEW" | "REVISION_REQUESTED" | "APPROVED" | "REJECTED";
  bounty_id: string;
  agent?: AgentRef;
  /** 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'NONE' (unknown → PENDING); older BE omits it */
  payment_status?: string;
  /** latest `submission_review.comment`; older BE omits it */
  review_comment?: string | null;
};

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
  };
}

function toApplication(row: ApplicationRow): AccountApplication {
  return {
    id: row.id,
    bountySlug: row.bounty_id,
    bountyTitle: row.bounty_title,
    category: toCategoryLabel(row.category) ?? "Other",
    appliedAt: row.applied_at,
    note: row.message,
    // BE PENDING = 지원 완료(심사 대기) → FE 첫 단계 "open"(Applied)
    status: row.status === "APPROVED" ? "approved" : row.status === "REJECTED" ? "rejected" : "open",
    agent: toAgentRef(row.agent),
    reviewComment: null,
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

/**
 * Why an account read is unavailable: `unauthorized` when the BE still answers 401/403 after `ApiHttp` tried the
 * refresh (the session is gone - views show a sign-in prompt), `server-error` for any other BE answer (5xx, 429,
 * a 4xx the FE did not expect), `network-error` when nothing answered (fetch failure, or `REFRESH_UNAVAILABLE`
 * carrying status 0 from a refresh that never reached the BE).
 */
export function unavailableReason(error: unknown): ApiUnavailable["reason"] {
  if (!(error instanceof ApiHttpError)) return "network-error";
  if (error.status === 401 || error.status === 403) return "unauthorized";
  return error.status === 0 ? "network-error" : "server-error";
}

const unavailable = <T>(error: unknown): ApiResult<T> => ({ status: "unavailable", reason: unavailableReason(error) });

/** api 모드 실제 클라이언트: BE 계약(docs/api-contract.md)에 연결 */
export function createApiApiClient(http: ApiHttp): ApiClient {
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
          http.fetchJson<ApplicationRow[]>("/applications/me"),
          http.fetchJson<SubmissionRow[]>("/submissions/me"),
        ]);
        // Owner and agent rows can coexist on one bounty: match each application to its own submission.
        const submissionKey = (bountyId: string, agent: AgentRef | undefined) => `${bountyId}:${agent?.id ?? "self"}`;
        const submissionsByRow = new Map(submissions.map((submission) => [submissionKey(submission.bounty_id, submission.agent), submission]));
        return {
          status: "available",
          // 철회 건은 FE 진행 단계 모델에 없으므로 제외. 반려 건은 상세/목록에서 상태를 보여주기 위해 유지
          data: rows
            .filter((row) => row.status !== "WITHDRAWN")
            .map((row) => {
              const application = toApplication(row);
              const submission = submissionsByRow.get(submissionKey(row.bounty_id, row.agent));
              if (!submission || application.status !== "approved") return application;
              // REJECTED is final (also a forfeited award: approved work, no payout) — not another "Submitted" step.
              if (submission.status === "REJECTED") {
                return { ...application, status: "notAccepted" as const, reviewComment: submission.review_comment?.trim() || null };
              }
              if (submission.status === "REVISION_REQUESTED") {
                return { ...application, status: "revisionRequested" as const, reviewComment: submission.review_comment?.trim() || null };
              }
              return {
                ...application,
                status: submission.status === "APPROVED" ? "completed" as const : "submitted" as const,
              };
            }),
        };
      } catch (error) {
        return unavailable<readonly AccountApplication[]>(error);
      }
    },

    getSubmissions: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await http.fetchJson<SubmissionRow[]>("/submissions/me");
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
    ...createAdminApi(http),
  };
}
