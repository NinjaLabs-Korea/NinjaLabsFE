import type { Account, AccountAgent, AccountApplication } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { ApiHttp } from "@/lib/api/http";
import { fetchMe, toClientUser } from "@/lib/api/me";

/** BE GET /applications/me 행 */
type ApplicationRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  message: string;
  applied_at: string;
  reviewed_at: string | null;
  bounty_id: string;
  bounty_title: string;
  category: "DEV" | "DESIGN" | "CONTENT" | "OTHER";
};

/** BE GET /agents/me 행 */
type AgentRow = {
  id: string;
  name: string;
  description: string | null;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  wallet_address: string;
  verified_at: string | null;
  created_at: string;
  completed_bounties: number;
  key_prefix: string | null;
  key_status: string | null;
  key_expires_at: string | null;
};

const CATEGORY_LABEL = {
  DEV: "Dev",
  DESIGN: "Design",
  CONTENT: "Content",
  OTHER: "Other",
} as const;

function toApplication(row: ApplicationRow): AccountApplication {
  return {
    bountySlug: row.bounty_id,
    bountyTitle: row.bounty_title,
    category: CATEGORY_LABEL[row.category] ?? "Other",
    appliedAt: row.applied_at,
    note: row.message,
    // BE PENDING = 지원 완료(심사 대기) → FE 첫 단계 "open"(Applied)
    status: row.status === "APPROVED" ? "approved" : "open",
  };
}

function toAgent(row: AgentRow): AccountAgent {
  return {
    name: row.name,
    walletAddress: row.wallet_address,
    verified: row.status === "ACTIVE",
    completedBounties: row.completed_bounties ?? 0,
    // 원문 키는 발급 응답 1회만 노출 — 목록에서는 prefix 마스킹만 제공된다
    apiKeyMasked: row.key_prefix ? `${row.key_prefix}••••••••` : "—",
    registeredAt: row.created_at,
  };
}

const networkUnavailable = <T>(): ApiResult<T> => ({
  status: "unavailable",
  reason: "network-error",
});

/** api 모드 실제 클라이언트 — BE 계약(docs/api-contract.md)에 연결 */
export function createApiApiClient(http: ApiHttp): ApiClient {
  return {
    getAccount: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: null };
      try {
        const me = await fetchMe(http);
        return { status: "available", data: me ? { user: toClientUser(me) } : null };
      } catch {
        return networkUnavailable<Account | null>();
      }
    },

    getApplications: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await http.fetchJson<ApplicationRow[]>("/applications/me");
        return {
          status: "available",
          // 철회·반려 건은 FE 진행 단계 모델에 없으므로 목록에서 제외
          data: rows
            .filter((row) => row.status === "PENDING" || row.status === "APPROVED")
            .map(toApplication),
        };
      } catch {
        return networkUnavailable<readonly AccountApplication[]>();
      }
    },

    getAgents: async (auth) => {
      if (auth.status !== "signed-in") return { status: "available", data: [] };
      try {
        const rows = await http.fetchJson<AgentRow[]>("/agents/me");
        return { status: "available", data: rows.map(toAgent) };
      } catch {
        return networkUnavailable<readonly AccountAgent[]>();
      }
    },

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

    completeProfile: async ({ nickname, bio, tags }) => {
      await http.fetchJson("/users/me/profile", {
        method: "POST",
        body: { nickname, bio, tags },
      });
    },

    completeOnboarding: async () => {
      await http.fetchJson("/users/me/complete-onboarding", { method: "POST" });
    },
  };
}
