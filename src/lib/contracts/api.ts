import type { Account, AccountAgent, AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { AdminBounty, AdminHighlight, AdminPost, AdminUser } from "@/lib/admin";
import type { AdminNftJobPage, AdminOperations, NftJobStatus, SubmissionDecision } from "@/lib/admin-operations";

export type ApiAvailable<T> = {
  status: "available";
  data: T;
};

export type ApiUnavailable = {
  status: "unavailable";
  /** `unauthorized`: 401/403 after the refresh attempt (session gone) - views show a sign-in prompt; `server-error`: the BE answered with an error; `network-error`: no answer. */
  reason: "unauthorized" | "server-error" | "network-error";
};

export type AgentRegistration = {
  agentId: string;
  status: "PENDING_VERIFICATION";
  verificationMessage: string;
};

export type AgentVerification = {
  agentId: string;
  status: "ACTIVE";
  apiKey: string;
  expiresAt: string;
};

/** POST /agents/:id/keys/rotate — 새 원문 키는 이 응답에서 한 번만 노출된다 */
export type AgentKeyRotation = {
  agentId: string;
  apiKey: string;
  expiresAt: string;
};

/** POST /agents/:id/revoke */
export type AgentRevocation = {
  agentId: string;
  status: "REVOKED";
};

export type ApiResult<T> = ApiAvailable<T> | ApiUnavailable;

/**
 * FE ↔ BE 계약. 도메인별 인터페이스로 나눠, 컴포넌트는 필요한 조각만 의존한다
 * (예: 지갑 버튼은 WalletApi만). 구현체(api / mock)는 모든 조각을 구현한다.
 */

/** 로그인 사용자의 읽기 전용 계정 데이터 */
export type AccountApi = {
  getAccount: (auth: AuthSnapshot) => Promise<ApiResult<Account | null>>;
  getApplications: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountApplication[]>>;
  getSubmissions: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountSubmission[]>>;
  getAgents: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountAgent[]>>;
};

/** 바운티 참여 (지원 / 제출) */
export type BountyApi = {
  applyToBounty: (bountyId: string, input: { message: string; portfolioUrl?: string }) => Promise<{ id: string; status: string }>;
  submitBounty: (bountyId: string, input: {
    submissionUrl: string;
    description: string;
    repositoryUrl?: string;
    commitSha?: string;
  }) => Promise<{ id: string; revisionNo: number; status: string }>;
};

/** AI 에이전트 등록과 지갑 서명 검증 */
export type AgentApi = {
  registerAgent: (input: {
    name: string;
    description?: string;
    walletAddress: string;
  }) => Promise<AgentRegistration>;
  verifyAgent: (agentId: string, signature: string) => Promise<AgentVerification>;
  /** 404 AGENT_NOT_FOUND / 409 AGENT_NOT_ACTIVE */
  rotateAgentKey: (agentId: string) => Promise<AgentKeyRotation>;
  revokeAgent: (agentId: string) => Promise<AgentRevocation>;
};

/** 지갑 소유권 인증 (challenge → 서명 → verify) */
export type WalletApi = {
  createWalletChallenge: (address: string) => Promise<{ message: string }>;
  verifyWallet: (address: string, signature: string, publicKey?: string) => Promise<void>;
};

/** 가입 온보딩 (프로필 저장 / 완료 처리) */
export type OnboardingApi = {
  /** 공개 `GET /users/check-nickname?nickname=` — 예약어도 `available: false`. mock은 항상 available. */
  checkNickname: (nickname: string) => Promise<{ available: boolean }>;
  completeProfile: (input: {
    nickname: string;
    bio: string;
    tags: readonly string[];
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

/** 계정 설정 (본인 전용) */
export type AccountSettingsApi = {
  /**
   * `DELETE /users/me` `{confirmNickname}` — 회원 탈퇴. 성공하면 BE가 refresh 세션을 전부 폐기하므로 호출자는 이어서 signOut()한다.
   * 400 `CONFIRM_NICKNAME_MISMATCH` / 409 `WITHDRAWAL_BLOCKED_OPEN_PAYOUTS`(지급 진행 중) / 409 `WITHDRAWAL_BLOCKED_PENDING_REWARDS`(승인됐지만 지급 요청 전인 보상) / 404 `USER_NOT_FOUND` / 503 `DATABASE_UNAVAILABLE`.
   */
  withdrawAccount: (confirmNickname: string) => Promise<void>;
};

/** 운영자 콘솔 (AdminGuard 보호 엔드포인트) */
export type AdminApi = {
  uploadAdminMedia: (file: File) => Promise<{ id: string; url: string }>;
  getAdminUsers: (query?: string) => Promise<AdminUser[]>;
  setAdminMember: (userId: string, input: { isMember: boolean; role?: string; displayOrder?: number }) => Promise<void>;
  getAdminBounties: () => Promise<AdminBounty[]>;
  saveAdminBounty: (bounty: AdminBounty, create: boolean) => Promise<{ id: string }>;
  transitionAdminBounty: (bountyId: string, to: string) => Promise<void>;
  deleteAdminBounty: (bountyId: string) => Promise<void>;
  getAdminPosts: () => Promise<AdminPost[]>;
  /** On edits, `options.publish` is sent only when the publish state was toggled (the BE stamps published_at whenever it is present). Cleared `thumbnail`/`externalUrl` are sent as `null`. */
  saveAdminPost: (post: AdminPost, create: boolean, options?: { publish?: boolean }) => Promise<{ id: string }>;
  deleteAdminPost: (noticeId: string) => Promise<void>;
  getAdminHighlights: () => Promise<AdminHighlight[]>;
  /**
   * On edits, `options.publish` is sent only when the published state toggled (the BE re-stamps published_at whenever it
   * is present) and `type` only when `options.typeChanged` (an unknown BE code is kept as loaded, never re-sent).
   * Cleared optional URLs (`link`, `image`) are sent as `null` so the BE writes null instead of keeping the old value.
   */
  saveAdminHighlight: (highlight: AdminHighlight, create: boolean, options?: { publish?: boolean; typeChanged?: boolean }) => Promise<{ id: string }>;
  deleteAdminHighlight: (highlightId: string) => Promise<void>;
  /** GET /admin/bounties/:id/operations — amounts stay BE base-unit strings (see `lib/admin-operations.ts`). */
  getAdminOperations: (bountyId: string) => Promise<AdminOperations>;
  /** POST /admin/applications/:id/review — an empty note is omitted. */
  reviewAdminApplication: (applicationId: string, input: { decision: "APPROVED" | "REJECTED"; note?: string }) => Promise<void>;
  /** POST /admin/submissions/:id/review — `revisionNo` is the revision the admin looked at (SUBMISSION_REVISION_CHANGED otherwise). */
  reviewAdminSubmission: (submissionId: string, input: { decision: SubmissionDecision; revisionNo: number; comment?: string }) => Promise<void>;
  /** POST /admin/rewards/:id/confirm-deposit — `depositedAmount` in base units (`lib/api/codecs.ts humanToBaseUnits`). */
  confirmAdminDeposit: (rewardId: string, input: { txHash: string; depositedAmount: string }) => Promise<void>;
  /** POST /admin/payouts — `amount` in base units. */
  requestAdminPayout: (input: { rewardId: string; submissionId: string; amount: string }) => Promise<void>;
  /** POST /admin/payouts/:id/approve — 403 PAYOUT_SELF_APPROVAL when the requesting admin approves (two-person rule). */
  approveAdminPayout: (payoutId: string) => Promise<void>;
  /** POST /admin/payouts/:id/paid */
  markAdminPayoutPaid: (payoutId: string, txHash: string) => Promise<void>;
  /** GET /admin/nft-jobs?status=&page= (30/page) */
  getAdminNftJobs: (status: NftJobStatus, page: number) => Promise<AdminNftJobPage>;
  /** POST /admin/nft-jobs/:id/retry — 404 NFT_JOB_NOT_FOUND_OR_NOT_FAILED */
  retryAdminNftJob: (jobId: string) => Promise<void>;
};

export type ApiClient = AccountApi & AccountSettingsApi & BountyApi & AgentApi & WalletApi & OnboardingApi & AdminApi;
