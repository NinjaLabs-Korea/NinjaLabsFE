import type { ApiHttp } from "@/lib/api/http";
import type { AdminApi } from "@/lib/contracts/api";
import { deliverablesFromRequirements, type AdminBounty, type AdminHighlight, type AdminPost, type AdminUser } from "@/lib/admin-helpers";
import type { AdminAuditLogPage } from "@/lib/admin-audit";
import type { AdminNftJobPage, AdminOperations, OpsActor } from "@/lib/admin-operations";
import { markdownToPlainSummary } from "@/lib/markdown-summary";
import { formatIsoDate, rewardFromBaseUnits, rewardToBaseUnits, toCategoryCode, toCategoryLabel, toMemberRoleCode, toMemberRoleLabel, toNoticeCategoryCode, toNoticeCategoryLabel, type CategoryCode, type MemberRoleCode } from "@/lib/api/codecs";

type UserRow = { id: string; email: string; nickname: string; is_member: boolean; member_role: MemberRoleCode | null; member_display_order: number | null; created_at: string; wallet_address: string | null };
type BountyRow = { id: string; title: string; sponsor_name: string; summary: string; description: string; requirements: string; evaluation_criteria: string; category: CategoryCode; status: string; application_required: boolean; submission_mode: "DIRECT" | "AGENT"; cover_image_url: string | null; submission_deadline: string; application_deadline: string | null; max_winners: number; rewards: Array<{ symbol: string; amount: string; tokenContractAddress?: string | null; evmChainId?: number | null }> };
type NoticeRow = { id: string; title: string; body: string; category: string; status: string; published_at: string | null; thumbnail_url: string | null; external_url: string | null; event_date?: string | null };
type ActorColumns = { actor_kind: "USER" | "AGENT"; user_id: string | null; nickname: string | null; agent_id: string | null; agent_name: string | null };
type OperationsResponse = {
  bounty: { id: string; title: string; status: string; submission_deadline: string | null; max_winners: number; application_required: boolean };
  lifecycle: { blockerDetails?: Record<string, Array<{ code: string; count?: number }>>; allowedTransitions?: string[] };
  applications: Array<ActorColumns & { id: string; status: string; message: string; portfolio_url: string | null; review_note: string | null; applied_at: string; reviewed_at: string | null }>;
  submissions: Array<ActorColumns & {
    id: string; status: string; current_revision_no: number; submitted_at: string; reviewed_at: string | null; recipient_wallet_address: string | null; review_comment: string | null;
    revisions: Array<{ revision_no: number; submission_url: string; description: string; repository_url: string | null; commit_sha: string | null; created_at: string }>;
    reviews: Array<{ revision_no: number | null; decision: string; comment: string | null; created_at: string }>;
  }>;
  rewards: Array<{ id: string; status: string; display_symbol: string; amount: string; deposited_amount: string | null; deposited_at: string | null; deposit_tx_hash: string | null; custody_address: string | null; cap: string | null; allocated_amount: string | null }>;
  payouts: Array<{ id: string; bounty_reward_id: string; submission_id: string; status: string; amount: string; display_symbol: string; payout_tx_hash: string | null; recipient_address: string; requested_by: string; requested_by_nickname: string | null; requested_at: string; approved_by_nickname: string | null; approved_at: string | null; paid_at: string | null; requested_by_me: boolean }>;
  policy?: { payoutSelfApprovalAllowed?: boolean };
};
type AuditRow = { id: string; actor_user_id: string | null; actor_agent_id: string | null; actor_nickname?: string | null; action: string; entity_type: string; entity_id: string | null; created_at: string };
type NftJobRow = { id: string; nft_id: string; job_type: string; status: string; retry_count: number; last_error: string | null; scheduled_at: string | null; updated_at: string | null; nft_type: string; nft_status: string; bounty_title: string | null; owner_nickname: string | null; owner_wallet_address: string | null };

const actorFrom = (row: ActorColumns): OpsActor => ({ kind: row.actor_kind === "AGENT" ? "AGENT" : "USER", userId: row.user_id, nickname: row.nickname, agentId: row.agent_id, agentName: row.agent_name });

/** BE operations payload → console model. Amounts stay base-unit strings; statuses stay BE codes. */
export function toAdminOperations(body: OperationsResponse): AdminOperations {
  return {
    bounty: {
      id: body.bounty.id, title: body.bounty.title, status: body.bounty.status, submissionDeadline: body.bounty.submission_deadline,
      maxWinners: Number(body.bounty.max_winners) || 1, applicationRequired: Boolean(body.bounty.application_required),
    },
    lifecycle: { blockers: body.lifecycle.blockerDetails ?? {}, allowedTransitions: body.lifecycle.allowedTransitions ?? [] },
    applications: body.applications.map((row) => ({
      ...actorFrom(row), id: row.id, status: row.status, message: row.message, portfolioUrl: row.portfolio_url,
      reviewNote: row.review_note, appliedAt: row.applied_at, reviewedAt: row.reviewed_at,
    })),
    submissions: body.submissions.map((row) => ({
      ...actorFrom(row), id: row.id, status: row.status, currentRevisionNo: Number(row.current_revision_no) || 1,
      submittedAt: row.submitted_at, reviewedAt: row.reviewed_at, recipientWalletAddress: row.recipient_wallet_address, reviewComment: row.review_comment,
      revisions: row.revisions.map((rev) => ({ revisionNo: rev.revision_no, submissionUrl: rev.submission_url, description: rev.description, repositoryUrl: rev.repository_url, commitSha: rev.commit_sha, createdAt: rev.created_at })),
      reviews: row.reviews.map((review) => ({ revisionNo: review.revision_no, decision: review.decision, comment: review.comment, createdAt: review.created_at })),
    })),
    rewards: body.rewards.map((row) => ({
      id: row.id, status: row.status, symbol: row.display_symbol, amount: row.amount, depositedAmount: row.deposited_amount,
      depositedAt: row.deposited_at, depositTxHash: row.deposit_tx_hash, custodyAddress: row.custody_address, cap: row.cap, allocated: row.allocated_amount ?? "0",
    })),
    payouts: body.payouts.map((row) => ({
      id: row.id, rewardId: row.bounty_reward_id, submissionId: row.submission_id, status: row.status, amount: row.amount, symbol: row.display_symbol,
      txHash: row.payout_tx_hash, recipientAddress: row.recipient_address, requestedBy: row.requested_by, requestedByNickname: row.requested_by_nickname,
      requestedAt: row.requested_at, approvedByNickname: row.approved_by_nickname, approvedAt: row.approved_at, paidAt: row.paid_at, requestedByMe: row.requested_by_me === true,
    })),
    policy: { payoutSelfApprovalAllowed: body.policy?.payoutSelfApprovalAllowed === true },
  };
}

type HighlightRow = { id: string; type: string; title: string; description: string; image_url: string | null; link_url: string | null; display_order: number; is_published: boolean };

const bountyStatus = (status: string): AdminBounty["status"] => {
  if (status === "DRAFT") return "draft";
  if (status === "FUNDING_PENDING") return "funding";
  if (status === "OPEN") return "active";
  if (status === "SUBMISSION_CLOSED") return "submissionClosed";
  if (status === "IN_REVIEW") return "reviewing";
  if (status === "CANCELLED") return "cancelled";
  // COMPLETED, and any status a newer BE adds: shown as finished rather than guessed.
  return "completed";
};

/** 운영자 콘솔 API - BE 행(snake_case, 코드값)을 FE 어드민 타입으로 변환한다 */
export function createAdminApi(http: ApiHttp): AdminApi {
  return {
    uploadAdminMedia: async (file: File): Promise<{ id: string; url: string }> => {
      const form = new FormData();
      form.set("file", file);
      return http.fetchForm("/admin/media", form);
    },
    getAdminUsers: async (query = "", page = 1): Promise<AdminUser[]> => {
      const rows = await http.fetchJson<UserRow[]>(`/admin/users?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ""}`);
      return rows.map((row) => ({
        slug: row.id, nickname: row.nickname, email: row.email,
        joinedAt: formatIsoDate(row.created_at),
        walletAddress: row.wallet_address, walletStatus: row.wallet_address ? "linked" : null,
        isMember: row.is_member,
        memberRole: row.member_role ? toMemberRoleLabel(row.member_role) ?? null : null,
        memberDisplayOrder: row.member_display_order,
      }));
    },
    setAdminMember: async (userId: string, input: { isMember: boolean; role?: string; displayOrder?: number }) => {
      await http.fetchJson(`/admin/users/${encodeURIComponent(userId)}/member`, {
        method: "POST",
        body: { ...input, ...(input.role ? { role: toMemberRoleCode(input.role) } : {}) },
      });
    },
    getAdminBounties: async (): Promise<AdminBounty[]> => {
      const rows = await http.fetchJson<BountyRow[]>("/admin/bounties");
      return rows.map((row) => ({
        slug: row.id, title: row.title, sponsor: row.sponsor_name,
        reward: rewardFromBaseUnits(row.rewards[0]),
        ...(row.rewards[0]?.tokenContractAddress ? { rewardContractAddress: row.rewards[0].tokenContractAddress } : {}),
        ...(row.rewards[0]?.evmChainId ? { rewardChainId: row.rewards[0].evmChainId } : {}),
        intakeEnabled: row.application_required, status: bountyStatus(row.status),
        submissionMode: row.submission_mode === "AGENT" ? "agent" : "direct",
        coverImage: row.cover_image_url,
        deadline: row.submission_deadline, applicationDeadline: row.application_deadline ?? null,
        maxWinners: Number(row.max_winners) || 1,
        tags: [toCategoryLabel(row.category) ?? "Other"],
        description: row.description || row.summary, submissionGuide: row.requirements,
        // `requirements` is the BE string verbatim; `deliverables` is display-only (see AdminBounty).
        requirements: row.requirements, deliverables: deliverablesFromRequirements(row.requirements), reviewProcess: row.evaluation_criteria,
      }));
    },
    saveAdminBounty: async (bounty: AdminBounty, create: boolean): Promise<{ id: string }> => {
      const body = {
        title: bounty.title, sponsorName: bounty.sponsor,
        // The public BountyCard and the apply page render `summary` as text: strip the markdown like notice summaries do.
        // The BE refuses an empty summary, so a description with no text at all (an image only) falls back to the title.
        summary: markdownToPlainSummary(bounty.description) || bounty.title, description: bounty.description,
        // Raw string from the form mapping: unchanged bytes unless the admin edited the deliverables / submission guide.
        requirements: bounty.requirements,
        evaluationCriteria: bounty.reviewProcess,
        category: toCategoryCode(bounty.tags[0] ?? "Other"),
        applicationRequired: bounty.intakeEnabled, maxWinners: bounty.maxWinners,
        submissionMode: bounty.submissionMode === "agent" ? "AGENT" : "DIRECT",
        coverImageUrl: bounty.coverImage,
        submissionDeadline: bounty.deadline,
        ...(create && bounty.reward.amount > 0 ? { reward: {
          tokenType: bounty.reward.currency === "USDC" ? "ERC20" : "NATIVE",
          ...(bounty.reward.currency === "INJ" ? { tokenDenom: "inj" } : {}),
          displaySymbol: bounty.reward.currency,
          amount: rewardToBaseUnits(bounty.reward),
        } } : {}),
      };
      return http.fetchJson(create ? "/admin/bounties" : `/admin/bounties/${encodeURIComponent(bounty.slug)}`, { method: create ? "POST" : "PATCH", body });
    },
    transitionAdminBounty: async (bountyId: string, to: string) => { await http.fetchJson(`/admin/bounties/${encodeURIComponent(bountyId)}/transition`, { method: "POST", body: { to } }); },
    deleteAdminBounty: async (bountyId: string) => { await http.fetchJson(`/admin/bounties/${encodeURIComponent(bountyId)}`, { method: "DELETE" }); },
    getAdminPosts: async (): Promise<AdminPost[]> => {
      const rows = await http.fetchJson<NoticeRow[]>("/admin/notices");
      return rows.map((row) => ({ slug: row.id, title: row.title, category: toNoticeCategoryLabel(row.category) ?? "Other", status: row.status === "PUBLISHED" ? "published" : "draft", publishedAt: formatIsoDate(row.published_at) || null, bodyMarkdown: row.body, thumbnail: row.thumbnail_url, externalUrl: row.external_url, eventDate: row.event_date ?? null }));
    },
    saveAdminPost: (post: AdminPost, create: boolean, options?: { publish?: boolean }): Promise<{ id: string }> => {
      // BE resets published_at whenever `publish` is present, so edits send it only when the status was toggled.
      const publish = create ? post.status === "published" : options?.publish;
      // Cleared optional URLs go as null: the BE's `?? null` on create and its `!== undefined` filter on PATCH both write null, an omitted key would keep the old value.
      return http.fetchJson(create ? "/admin/notices" : `/admin/notices/${encodeURIComponent(post.slug)}`, { method: create ? "POST" : "PATCH", body: { title: post.title, summary: markdownToPlainSummary(post.bodyMarkdown), body: post.bodyMarkdown, category: toNoticeCategoryCode(post.category), thumbnailUrl: post.thumbnail ?? null, externalUrl: post.externalUrl ?? null, eventDate: post.eventDate ?? null, ...(publish === undefined ? {} : { publish }) } });
    },
    deleteAdminPost: async (id: string) => { await http.fetchJson(`/admin/notices/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    getAdminHighlights: async (): Promise<AdminHighlight[]> => {
      const rows = await http.fetchJson<HighlightRow[]>("/admin/highlights");
      // `type` is the BE code verbatim - an unknown code is kept (and shown raw), never mapped onto another type.
      return rows.map((row) => ({ id: row.id, type: row.type, title: row.title, description: row.description, order: row.display_order, link: row.link_url ?? undefined, image: row.image_url, published: row.is_published }));
    },
    saveAdminHighlight: (item: AdminHighlight, create: boolean, options?: { publish?: boolean; typeChanged?: boolean }): Promise<{ id: string }> => {
      // Like notices: `publish` always on create (from the chosen state), on edit only when it toggled; `type` only when the admin changed it.
      const publish = create ? item.published ?? false : options?.publish;
      return http.fetchJson(create ? "/admin/highlights" : `/admin/highlights/${encodeURIComponent(item.id)}`, {
        method: create ? "POST" : "PATCH",
        body: {
          ...(create || options?.typeChanged ? { type: item.type } : {}),
          title: item.title, description: item.description ?? item.title,
          imageUrl: item.image ?? null, linkUrl: item.link ?? null, displayOrder: item.order,
          ...(publish === undefined ? {} : { publish }),
        },
      });
    },
    deleteAdminHighlight: async (id: string) => { await http.fetchJson(`/admin/highlights/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    getAdminOperations: async (bountyId) => toAdminOperations(await http.fetchJson<OperationsResponse>(`/admin/bounties/${encodeURIComponent(bountyId)}/operations`)),
    reviewAdminApplication: async (applicationId, { decision, note }) => {
      const trimmed = note?.trim();
      await http.fetchJson(`/admin/applications/${encodeURIComponent(applicationId)}/review`, { method: "POST", body: { decision, ...(trimmed ? { note: trimmed } : {}) } });
    },
    reviewAdminSubmission: async (submissionId, { decision, revisionNo, comment }) => {
      const trimmed = comment?.trim();
      await http.fetchJson(`/admin/submissions/${encodeURIComponent(submissionId)}/review`, { method: "POST", body: { decision, revisionNo, ...(trimmed ? { comment: trimmed } : {}) } });
    },
    confirmAdminDeposit: async (rewardId, { txHash, depositedAmount }) => {
      await http.fetchJson(`/admin/rewards/${encodeURIComponent(rewardId)}/confirm-deposit`, { method: "POST", body: { txHash: txHash.trim(), depositedAmount } });
    },
    requestAdminPayout: async (input) => { await http.fetchJson("/admin/payouts", { method: "POST", body: input }); },
    approveAdminPayout: async (payoutId) => { await http.fetchJson(`/admin/payouts/${encodeURIComponent(payoutId)}/approve`, { method: "POST" }); },
    markAdminPayoutPaid: async (payoutId, txHash) => { await http.fetchJson(`/admin/payouts/${encodeURIComponent(payoutId)}/paid`, { method: "POST", body: { txHash: txHash.trim() } }); },
    getAdminNftJobs: async (status, page): Promise<AdminNftJobPage> => {
      const body = await http.fetchJson<{ items: NftJobRow[]; page: number; pageSize: number; total: number }>(`/admin/nft-jobs?status=${encodeURIComponent(status)}&page=${page}`);
      return {
        page: body.page, pageSize: body.pageSize, total: body.total,
        items: body.items.map((row) => ({
          id: row.id, nftId: row.nft_id, jobType: row.job_type, status: row.status, retryCount: Number(row.retry_count) || 0, lastError: row.last_error,
          scheduledAt: row.scheduled_at, updatedAt: row.updated_at, nftType: row.nft_type, nftStatus: row.nft_status,
          bountyTitle: row.bounty_title, ownerNickname: row.owner_nickname, ownerWalletAddress: row.owner_wallet_address,
        })),
      };
    },
    retryAdminNftJob: async (jobId) => { await http.fetchJson(`/admin/nft-jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" }); },
    getAdminAuditLogs: async (filter, page): Promise<AdminAuditLogPage> => {
      const params = new URLSearchParams();
      if (filter.entityType) params.set("entityType", filter.entityType);
      if (filter.entityId) params.set("entityId", filter.entityId);
      params.set("page", String(page));
      const body = await http.fetchJson<{ items: AuditRow[]; page: number; pageSize: number; total: number }>(`/admin/audit-logs?${params.toString()}`);
      return {
        page: body.page, pageSize: body.pageSize, total: body.total,
        items: body.items.map((row) => ({
          id: row.id, actorUserId: row.actor_user_id, actorAgentId: row.actor_agent_id, actorNickname: row.actor_nickname ?? null, action: row.action,
          entityType: row.entity_type, entityId: row.entity_id, createdAt: row.created_at,
        })),
      };
    },
  };
}
