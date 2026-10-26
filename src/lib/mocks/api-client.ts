import { newestFirst } from "@/lib/account-order";
import type { AdminApi, ApiClient } from "@/lib/contracts/api";
import type { AccountAgent, AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { AdminBounty, AdminHighlight, AdminPost, AdminUser } from "@/lib/admin";
import { MockApiError } from "@/lib/mocks/mock-error";
import { getBounty } from "@/lib/bounties";
import { createMockFixtures, getMockFixtureSnapshot, type MockAccountFixtures } from "@/lib/mocks/fixtures";
import { getAdminBounties, getAdminHighlights, getAdminPosts, getAdminUsers } from "@/lib/admin";
import { ADMIN_STATUS_FROM_CODE, createMockOperationsApi } from "@/lib/mocks/admin-operations";
import { createMockCohortApis } from "@/lib/mocks/cohorts";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

function isFixtureOwner(auth: AuthSnapshot, fixtures: MockAccountFixtures): boolean {
  return auth.status === "signed-in" && auth.user.id === fixtures.account.user.id;
}

/** Generated ids for records created in this tab (`preview-agent-1`, `preview-bounty-2`, ...). */
function createSequence() {
  let sequence = 0;
  return (prefix: string) => `${prefix}-${++sequence}`;
}

export { MockApiError };

/** mock 모드에서 bountyId는 slug다. 지원형 바운티는 상세 화면과 같은 applicationTitle을 쓴다. */
function toPreviewApplication(id: string, bountyId: string, message: string): AccountApplication {
  const bounty = getBounty(bountyId);
  return {
    id,
    source: "application",
    bountySlug: bountyId,
    bountyTitle: bounty?.applicationTitle ?? bounty?.title ?? bountyId,
    category: bounty?.category ?? "Other",
    appliedAt: new Date().toISOString(),
    note: message,
    // BE PENDING → FE "open" (Applied), the same first step the api client maps to.
    status: "open",
    agent: null,
    reviewComment: null,
    reviewNote: null,
    paymentStatus: "NONE",
  };
}

/** Fixture submissions mirror the api client's join: a submitted/completed application has a submission row. */
function fixtureSubmissions(applications: readonly AccountApplication[]): AccountSubmission[] {
  return applications
    .filter((application) => application.status === "submitted" || application.status === "revisionRequested" || application.status === "completed" || application.status === "notAccepted")
    .map((application) => ({
      bountySlug: application.bountySlug,
      status: application.status === "completed" ? "approved" as const : application.status === "notAccepted" ? "rejected" as const : application.status === "revisionRequested" ? "revision_requested" as const : "submitted" as const,
      agent: application.agent,
      paymentStatus: application.status === "completed" ? application.paymentStatus : "NONE" as const,
      reviewComment: application.reviewComment,
    }));
}

/**
 * 세션 미리보기용 in-memory 클라이언트. 이 탭에서 낸 지원서·제출·에이전트 등록과 운영자 저장은 아래 메모리
 * 목록에 반영되어 목록 화면이 바로 따라오고, 새로고침(새 클라이언트)하면 fixture로 돌아간다.
 */
export function createMockApiClient(seed = "default"): ApiClient {
  const fixtureSnapshot = createMockFixtures(seed);
  const nextId = createSequence();
  let applications: AccountApplication[] = [...fixtureSnapshot.applications];
  let submissions: AccountSubmission[] = fixtureSubmissions(fixtureSnapshot.applications);
  const revisions = new Map<string, number>();
  let agents: AccountAgent[] = [...fixtureSnapshot.agents];
  const updateAgent = (agentId: string, update: (agent: AccountAgent) => AccountAgent): AccountAgent => {
    const current = agents.find((agent) => agent.id === agentId);
    if (!current) throw new MockApiError(404, "AGENT_NOT_FOUND");
    const next = update(current);
    agents = agents.map((agent) => (agent.id === agentId ? next : agent));
    return next;
  };
  const cohorts = createMockCohortApis({ nextId, ownerId: fixtureSnapshot.account.user.id, isOwner: (auth) => isFixtureOwner(auth, fixtureSnapshot) });
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

      return { status: "available", data: newestFirst(applications.map((application) => ({ ...application }))) };
    },
    getSubmissions: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: submissions.map((submission) => ({ ...submission })) };
    },
    getAgents: async (auth) => {
      if (!isFixtureOwner(auth, fixtureSnapshot)) {
        return { status: "available", data: [] };
      }

      return { status: "available", data: agents.map((agent) => ({ ...agent })) };
    },
    applyToBounty: async (bountyId, input) => {
      const application = toPreviewApplication(nextId("preview-application"), bountyId, input.message);
      // Only the owner's own row on this bounty is replaced; agent-made rows (`agent !== null`) stay, like the BE lists them.
      applications = [application, ...applications.filter((item) => item.bountySlug !== bountyId || item.agent !== null)];
      return { id: application.id, status: "PENDING" };
    },
    withdrawApplication: async (applicationId) => {
      // Like the BE: only a PENDING ("open") row can be withdrawn; it then disappears from the list.
      if (!applications.some((application) => application.id === applicationId && application.status === "open")) {
        throw new MockApiError(404, "APPLICATION_NOT_FOUND_OR_NOT_PENDING");
      }
      applications = applications.filter((application) => application.id !== applicationId);
      return { id: applicationId, status: "WITHDRAWN" };
    },
    submitBounty: async (bountyId) => {
      const revisionNo = (revisions.get(bountyId) ?? 0) + 1;
      revisions.set(bountyId, revisionNo);
      const existing = submissions.find((submission) => submission.bountySlug === bountyId && submission.agent === null);
      submissions = existing
        ? submissions.map((submission) =>
            submission === existing
              ? { ...submission, status: submission.status === "revision_requested" ? ("resubmitted" as const) : ("submitted" as const) }
              : submission,
          )
        : [{ bountySlug: bountyId, status: "submitted", agent: null, paymentStatus: "NONE", reviewComment: null }, ...submissions];
      // Like the api client's /applications/me + /submissions/me join: an approved application - or one whose work came back
      // for revision (BE RESUBMITTED maps to `submitted`) - is now "submitted".
      applications = applications.map((application) =>
        application.bountySlug === bountyId &&
        application.agent === null &&
        (application.status === "approved" || application.status === "revisionRequested")
          ? { ...application, status: "submitted" as const }
          : application,
      );
      return { id: nextId("preview-submission"), revisionNo, status: revisionNo === 1 ? "SUBMITTED" : "RESUBMITTED" };
    },
    registerAgent: async ({ name, walletAddress }) => {
      const wallet = walletAddress.toLowerCase();
      const existing = agents.find((agent) => agent.status !== "REVOKED" && agent.walletAddress.toLowerCase() === wallet);
      // BE: an active wallet cannot be registered twice; a pending one is re-issued, a revoked one starts over.
      if (existing && existing.status !== "PENDING_VERIFICATION") throw new MockApiError(409, "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED");
      const agentId = nextId("preview-agent");
      agents = [
        ...agents.filter((agent) => agent !== existing),
        {
          id: agentId,
          name,
          walletAddress,
          status: "PENDING_VERIFICATION",
          verified: false,
          completedBounties: 0,
          apiKeyMasked: "-",
          keyExpiresAt: null,
          keyStatus: null,
          registeredAt: new Date().toISOString(),
        },
      ];
      return { agentId, status: "PENDING_VERIFICATION", verificationMessage: `Preview agent registration for ${walletAddress}` };
    },
    verifyAgent: async (agentId) => {
      const expiresAt = daysFromNow(90);
      // The raw key is revealed once in this response; the list only ever carries the masked form.
      const apiKey = `nl_preview_${agentId}_key_not_for_production`;
      updateAgent(agentId, (agent) => ({
        ...agent,
        status: "ACTIVE",
        verified: true,
        apiKeyMasked: `nl_live_····…${agentId.slice(-4).padStart(4, "0")}`,
        keyExpiresAt: expiresAt,
        keyStatus: "ACTIVE",
      }));
      return { agentId, status: "ACTIVE", apiKey, expiresAt };
    },
    rotateAgentKey: async (agentId) => {
      const expiresAt = daysFromNow(90);
      updateAgent(agentId, (agent) => {
        if (agent.status !== "ACTIVE") throw new MockApiError(409, "AGENT_NOT_ACTIVE");
        return { ...agent, apiKeyMasked: "nl_live_····…new1", keyExpiresAt: expiresAt, keyStatus: "ACTIVE" };
      });
      return { agentId, apiKey: "nl_preview_rotated_key_not_for_production", expiresAt };
    },
    revokeAgent: async (agentId) => {
      updateAgent(agentId, (agent) => ({ ...agent, status: "REVOKED", verified: false, keyStatus: agent.keyStatus ? "REVOKED" : null }));
      return { agentId, status: "REVOKED" };
    },
    createWalletChallenge: async (address) => ({ message: `Preview challenge for ${address}` }),
    verifyWallet: async () => undefined,
    checkNickname: async () => ({ available: true }),
    completeProfile: async () => undefined,
    completeOnboarding: async () => undefined,
    // BE compares trimmed, case-insensitive; the preview session's nickname is its handle.
    withdrawAccount: async (confirmNickname) => {
      if (confirmNickname.trim().toLowerCase() !== fixtureSnapshot.account.user.handle.toLowerCase()) {
        throw new MockApiError(400, "CONFIRM_NICKNAME_MISMATCH");
      }
    },
    ...cohorts.applicantApi,
    ...createMockAdminApi(nextId),
    ...cohorts.adminApi,
  };
}

/** 운영자 콘솔 mock - fixture로 시작해 이 탭 안의 생성·수정·전이·삭제를 메모리에 반영한다 (새로고침하면 초기화). */
function createMockAdminApi(nextId: (prefix: string) => string): AdminApi {
  let users: AdminUser[] = getAdminUsers();
  let bounties: AdminBounty[] = getAdminBounties();
  let posts: AdminPost[] = getAdminPosts();
  let highlights: AdminHighlight[] = getAdminHighlights();
  const requireOne = <T>(items: T[], matches: (item: T) => boolean, code: string): T => {
    const found = items.find(matches);
    if (!found) throw new MockApiError(404, code);
    return found;
  };
  // Operations console twin: per-bounty applications/submissions/rewards/payouts seeded on first open, with the BE's checks.
  const operations = createMockOperationsApi({ findBounty: (bountyId) => bounties.find((item) => item.slug === bountyId), nextId });
  const openedOperations = new Set<string>();
  const { transitionOperations, hasOpenFunds, getAdminOperations, ...operationWrites } = operations;
  return {
    ...operationWrites,
    getAdminOperations: async (bountyId) => {
      const result = await getAdminOperations(bountyId);
      openedOperations.add(bountyId);
      return result;
    },
    uploadAdminMedia: async (file) => ({ id: `preview-${file.name}`, url: URL.createObjectURL(file) }),
    getAdminUsers: async (query = "", page = 1) => {
      const needle = query.trim().toLowerCase();
      return users
        .filter((user) => !needle || user.nickname.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle))
        .slice((page - 1) * 30, page * 30)
        .map((user) => ({ ...user }));
    },
    setAdminMember: async (userId, input) => {
      const current = requireOne(users, (user) => user.slug === userId, "USER_NOT_FOUND");
      const next: AdminUser = input.isMember
        ? {
            ...current,
            isMember: true,
            memberRole: (input.role as AdminUser["memberRole"]) ?? current.memberRole,
            memberDisplayOrder: input.displayOrder ?? current.memberDisplayOrder,
          }
        : { ...current, isMember: false, memberRole: null, memberDisplayOrder: null };
      users = users.map((user) => (user.slug === userId ? next : user));
    },
    getAdminBounties: async () => bounties.map((bounty) => ({ ...bounty })),
    saveAdminBounty: async (bounty, create) => {
      if (create) {
        const id = nextId("preview-bounty");
        bounties = [{ ...bounty, slug: id }, ...bounties];
        return { id };
      }
      requireOne(bounties, (item) => item.slug === bounty.slug, "BOUNTY_NOT_FOUND");
      bounties = bounties.map((item) => (item.slug === bounty.slug ? { ...bounty } : item));
      return { id: bounty.slug };
    },
    transitionAdminBounty: async (bountyId, to) => {
      requireOne(bounties, (item) => item.slug === bountyId, "BOUNTY_NOT_FOUND");
      // A bounty opened in the operations console enforces the BE transition table + lifecycle blockers on its mock rows.
      if (openedOperations.has(bountyId)) transitionOperations(bountyId, to);
      const status = ADMIN_STATUS_FROM_CODE[to] ?? "completed";
      bounties = bounties.map((item) => (item.slug === bountyId ? { ...item, status } : item));
    },
    deleteAdminBounty: async (bountyId) => {
      requireOne(bounties, (item) => item.slug === bountyId, "BOUNTY_NOT_FOUND");
      // Like the transition above, the BE's money rule applies to a bounty whose operations rows exist (opened in the console).
      if (openedOperations.has(bountyId) && hasOpenFunds(bountyId)) throw new MockApiError(409, "BOUNTY_HAS_OPEN_FUNDS");
      bounties = bounties.filter((item) => item.slug !== bountyId);
    },
    getAdminPosts: async () => posts.map((post) => ({ ...post })),
    saveAdminPost: async (post, create, options) => {
      const today = new Date().toISOString().slice(0, 10);
      if (create) {
        const id = nextId("preview-post");
        posts = [{ ...post, slug: id, publishedAt: post.status === "published" ? today : null }, ...posts];
        return { id };
      }
      const current = requireOne(posts, (item) => item.slug === post.slug, "NOTICE_NOT_FOUND");
      // `publish` is only sent when the state toggled; a plain edit keeps the stored publishedAt (BE contract).
      const status = options?.publish === undefined ? current.status : options.publish ? "published" : "draft";
      const publishedAt = options?.publish === undefined ? current.publishedAt : options.publish ? today : null;
      posts = posts.map((item) => (item.slug === post.slug ? { ...post, status, publishedAt } : item));
      return { id: post.slug };
    },
    deleteAdminPost: async (noticeId) => {
      requireOne(posts, (item) => item.slug === noticeId, "NOTICE_NOT_FOUND");
      posts = posts.filter((item) => item.slug !== noticeId);
    },
    getAdminHighlights: async () => highlights.map((highlight) => ({ ...highlight })),
    saveAdminHighlight: async (highlight, create, options) => {
      if (create) {
        const id = nextId("preview-highlight");
        highlights = [...highlights, { ...highlight, id, published: highlight.published ?? false }];
        return { id };
      }
      const current = requireOne(highlights, (item) => item.id === highlight.id, "HIGHLIGHT_NOT_FOUND");
      // BE contract: `publish` only when toggled, `type` only when changed - everything else keeps the stored value.
      const published = options?.publish ?? current.published;
      const type = options?.typeChanged ? highlight.type : current.type;
      highlights = highlights.map((item) => (item.id === highlight.id ? { ...highlight, type, published } : item));
      return { id: highlight.id };
    },
    deleteAdminHighlight: async (highlightId) => {
      requireOne(highlights, (item) => item.id === highlightId, "HIGHLIGHT_NOT_FOUND");
      highlights = highlights.filter((item) => item.id !== highlightId);
    },
  };
}
