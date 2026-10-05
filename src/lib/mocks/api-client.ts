import type { AdminApi, ApiClient } from "@/lib/contracts/api";
import type { AccountApplication } from "@/lib/contracts/account";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { getBounty } from "@/lib/bounties";
import { createMockFixtures, getMockFixtureSnapshot, type MockAccountFixtures } from "@/lib/mocks/fixtures";
import { getAdminBounties, getAdminHighlights, getAdminPosts, getAdminUsers } from "@/lib/admin";

function isFixtureOwner(auth: AuthSnapshot, fixtures: MockAccountFixtures): boolean {
  return auth.status === "signed-in" && auth.user.id === fixtures.account.user.id;
}

export function createMockApiClient(seed = "default"): ApiClient {
  const fixtureSnapshot = createMockFixtures(seed);
  // 이 탭에서 낸 지원서를 My applications에 바로 보여주기 위한 메모리 목록 (새로고침하면 fixture로 돌아간다).
  let applications: AccountApplication[] = [...fixtureSnapshot.applications];
  return {
    getAccount: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: null };
      }

      return { status: "available", data: getMockFixtureSnapshot(fixtureSnapshot).account };
    },
    getApplications: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: applications.map((application) => ({ ...application })) };
    },
    getAgents: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: getMockFixtureSnapshot(fixtureSnapshot).agents };
    },
    applyToBounty: async (bountyId, input) => {
      applications = [toPreviewApplication(bountyId, input.message), ...applications.filter((item) => item.bountySlug !== bountyId)];
      return { id: "preview-application", status: "PENDING" };
    },
    submitBounty: async () => ({ id: "preview-submission", revisionNo: 1, status: "SUBMITTED" }),
    registerAgent: async ({ walletAddress }) => ({
      agentId: "00000000-0000-4000-8000-000000000001",
      status: "PENDING_VERIFICATION",
      verificationMessage: `Preview agent registration for ${walletAddress}`,
    }),
    verifyAgent: async (agentId) => ({
      agentId,
      status: "ACTIVE",
      apiKey: "nj_preview_key_not_for_production",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    createWalletChallenge: async (address) => ({ message: `Preview challenge for ${address}` }),
    verifyWallet: async () => undefined,
    completeProfile: async () => undefined,
    completeOnboarding: async () => undefined,
    ...createMockAdminApi(),
  };
}

/** 운영자 콘솔 mock — 고정 fixture를 돌려주고 저장은 반영하지 않는다 */
function createMockAdminApi(): AdminApi {
  return {
    uploadAdminMedia: async (file) => ({ id: `preview-${file.name}`, url: URL.createObjectURL(file) }),
    getAdminUsers: async () => getAdminUsers(),
    setAdminMember: async () => undefined,
    getAdminBounties: async () => getAdminBounties(),
    saveAdminBounty: async (bounty) => ({ id: bounty.slug }),
    transitionAdminBounty: async () => undefined,
    deleteAdminBounty: async () => undefined,
    getAdminPosts: async () => getAdminPosts(),
    saveAdminPost: async (post) => ({ id: post.slug }),
    deleteAdminPost: async () => undefined,
    getAdminHighlights: async () => getAdminHighlights(),
    saveAdminHighlight: async (highlight) => ({ id: highlight.id }),
    deleteAdminHighlight: async () => undefined,
  };
}

/** mock 모드에서 bountyId는 slug다. 지원형 바운티는 상세 화면과 같은 applicationTitle을 쓴다. */
function toPreviewApplication(bountyId: string, message: string): AccountApplication {
  const bounty = getBounty(bountyId);
  const now = new Date();
  return {
    bountySlug: bountyId,
    bountyTitle: bounty?.applicationTitle ?? bounty?.title ?? bountyId,
    category: bounty?.category ?? "Other",
    appliedAt: `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`,
    note: message,
    status: "under_review",
  };
}
