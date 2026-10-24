import type { ApiHttp } from "@/lib/api/http";
import type { AdminApi } from "@/lib/contracts/api";
import { deliverablesFromRequirements, type AdminBounty, type AdminHighlight, type AdminPost, type AdminUser } from "@/lib/admin-helpers";
import { markdownToPlainSummary } from "@/lib/markdown-summary";
import { formatIsoDate, rewardFromBaseUnits, rewardToBaseUnits, toCategoryCode, toCategoryLabel, toMemberRoleCode, toMemberRoleLabel, toNoticeCategoryCode, toNoticeCategoryLabel, type CategoryCode, type MemberRoleCode } from "@/lib/api/codecs";

type UserRow = { id: string; email: string; nickname: string; is_member: boolean; member_role: MemberRoleCode | null; member_display_order: number | null; created_at: string; wallet_address: string | null };
type BountyRow = { id: string; title: string; sponsor_name: string; summary: string; description: string; requirements: string; evaluation_criteria: string; category: CategoryCode; status: string; application_required: boolean; submission_mode: "DIRECT" | "AGENT"; cover_image_url: string | null; submission_deadline: string; application_deadline: string | null; max_winners: number; rewards: Array<{ symbol: string; amount: string; tokenContractAddress?: string | null; evmChainId?: number | null }> };
type NoticeRow = { id: string; title: string; body: string; category: string; status: string; published_at: string | null; thumbnail_url: string | null; external_url: string | null };
type HighlightRow = { id: string; type: string; title: string; description: string; image_url: string | null; link_url: string | null; display_order: number; is_published: boolean };

const bountyStatus = (status: string): AdminBounty["status"] => {
  if (status === "DRAFT") return "draft";
  if (status === "FUNDING_PENDING") return "funding";
  if (status === "OPEN") return "active";
  if (status === "IN_REVIEW" || status === "SUBMISSION_CLOSED") return "reviewing";
  return "closed";
};

/** 운영자 콘솔 API — BE 행(snake_case, 코드값)을 FE 어드민 타입으로 변환한다 */
export function createAdminApi(http: ApiHttp): AdminApi {
  return {
    uploadAdminMedia: async (file: File): Promise<{ id: string; url: string }> => {
      const form = new FormData();
      form.set("file", file);
      return http.fetchForm("/admin/media", form);
    },
    getAdminUsers: async (query = ""): Promise<AdminUser[]> => {
      const rows = await http.fetchJson<UserRow[]>(`/admin/users?q=${encodeURIComponent(query)}`);
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
        // 폼에 maxWinners 입력란이 없다: 신규는 1, 수정은 불러온 레코드의 값을 그대로 보내 BE 값을 덮어쓰지 않는다.
        applicationRequired: bounty.intakeEnabled, maxWinners: create ? 1 : bounty.maxWinners,
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
      return rows.map((row) => ({ slug: row.id, title: row.title, category: toNoticeCategoryLabel(row.category) ?? "Other", status: row.status === "PUBLISHED" ? "published" : "draft", publishedAt: formatIsoDate(row.published_at) || null, bodyMarkdown: row.body, thumbnail: row.thumbnail_url, externalUrl: row.external_url }));
    },
    saveAdminPost: (post: AdminPost, create: boolean, options?: { publish?: boolean }): Promise<{ id: string }> => {
      // BE resets published_at whenever `publish` is present, so edits send it only when the status was toggled.
      const publish = create ? post.status === "published" : options?.publish;
      // Cleared optional URLs go as null: the BE's `?? null` on create and its `!== undefined` filter on PATCH both write null, an omitted key would keep the old value.
      return http.fetchJson(create ? "/admin/notices" : `/admin/notices/${encodeURIComponent(post.slug)}`, { method: create ? "POST" : "PATCH", body: { title: post.title, summary: markdownToPlainSummary(post.bodyMarkdown), body: post.bodyMarkdown, category: toNoticeCategoryCode(post.category), thumbnailUrl: post.thumbnail ?? null, externalUrl: post.externalUrl ?? null, ...(publish === undefined ? {} : { publish }) } });
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
  };
}
