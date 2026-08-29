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

export type ApiClient = {
  getAccount: (auth: AuthSnapshot) => Promise<ApiResult<Account | null>>;
  getApplications: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountApplication[]>>;
  getAgents: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountAgent[]>>;
  applyToBounty: (bountyId: string, input: { message: string; portfolioUrl?: string }) => Promise<{ id: string; status: string }>;
  submitBounty: (bountyId: string, input: {
    submissionUrl: string;
    description: string;
    repositoryUrl?: string;
    commitSha?: string;
  }) => Promise<{ id: string; revisionNo: number; status: string }>;
  registerAgent: (input: {
    name: string;
    description?: string;
    walletAddress: string;
  }) => Promise<AgentRegistration>;
  verifyAgent: (agentId: string, signature: string) => Promise<AgentVerification>;
  createWalletChallenge: (address: string) => Promise<{ message: string }>;
  verifyWallet: (address: string, signature: string, publicKey?: string) => Promise<void>;
  completeProfile: (input: {
    nickname: string;
    bio: string;
    tags: readonly string[];
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
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
