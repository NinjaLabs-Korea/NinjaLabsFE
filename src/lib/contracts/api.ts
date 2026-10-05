import type { Account, AccountAgent, AccountApplication } from "@/lib/contracts/account";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { AdminBounty, AdminHighlight, AdminPost, AdminUser } from "@/lib/admin";

export type ApiAvailable<T> = {
  status: "available";
  data: T;
};

export type ApiUnavailable = {
  status: "unavailable";
  reason: "api-mode-placeholder" | "network-error";
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

export type ApiResult<T> = ApiAvailable<T> | ApiUnavailable;

/**
 * FE ↔ BE 계약. 도메인별 인터페이스로 나눠, 컴포넌트는 필요한 조각만 의존한다
 * (예: 지갑 버튼은 WalletApi만). 구현체(api / mock / unavailable)는 모든 조각을 구현한다.
 */

/** 로그인 사용자의 읽기 전용 계정 데이터 */
export type AccountApi = {
  getAccount: (auth: AuthSnapshot) => Promise<ApiResult<Account | null>>;
  getApplications: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountApplication[]>>;
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
};

/** 지갑 소유권 인증 (challenge → 서명 → verify) */
export type WalletApi = {
  createWalletChallenge: (address: string) => Promise<{ message: string }>;
  verifyWallet: (address: string, signature: string, publicKey?: string) => Promise<void>;
};

/** 가입 온보딩 (프로필 저장 / 완료 처리) */
export type OnboardingApi = {
  completeProfile: (input: {
    nickname: string;
    bio: string;
    tags: readonly string[];
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
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
  saveAdminPost: (post: AdminPost, create: boolean) => Promise<{ id: string }>;
  deleteAdminPost: (noticeId: string) => Promise<void>;
  getAdminHighlights: () => Promise<AdminHighlight[]>;
  saveAdminHighlight: (highlight: AdminHighlight, create: boolean) => Promise<{ id: string }>;
  deleteAdminHighlight: (highlightId: string) => Promise<void>;
};

export type ApiClient = AccountApi & BountyApi & AgentApi & WalletApi & OnboardingApi & AdminApi;
