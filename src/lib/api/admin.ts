import type { ApiHttp } from "@/lib/api/http";
import type { AdminBounty, AdminHighlight, AdminPost, AdminUser } from "@/lib/admin";
import { parseUnits } from "viem";

const categoryLabel = { DEV: "Dev", DESIGN: "Design", CONTENT: "Content", OTHER: "Other" } as const;
const categoryCode = { Dev: "DEV", Design: "DESIGN", Content: "CONTENT", Other: "OTHER" } as const;
const roleLabel = { CORE: "Core", DEV: "Dev", DESIGN: "Design", OPS: "Ops" } as const;
const roleCode = { Core: "CORE", Dev: "DEV", Design: "DESIGN", Ops: "OPS" } as const;
const noticeLabel = { NINJALABS: "Ninja Labs", INJECTIVE_ECOSYSTEM: "Injective ecosystem", EVENT: "Events", RECRUITMENT: "Recruitment", OTHER: "Other" } as const;
const noticeCode = { "Ninja Labs": "NINJALABS", "Injective ecosystem": "INJECTIVE_ECOSYSTEM", Events: "EVENT", Recruitment: "RECRUITMENT", Other: "OTHER" } as const;
const highlightLabel = { MILESTONE: "Milestone", FEATURED_BOUNTY: "Featured bounty", PARTNERSHIP: "Partnership" } as const;
const highlightCode = { Milestone: "MILESTONE", "Featured bounty": "FEATURED_BOUNTY", Partnership: "PARTNERSHIP" } as const;

type UserRow = { id: string; email: string; nickname: string; is_member: boolean; member_role: keyof typeof roleLabel | null; member_display_order: number | null; created_at: string; wallet_address: string | null };
type BountyRow = { id: string; title: string; sponsor_name: string; summary: string; description: string; requirements: string; evaluation_criteria: string; category: keyof typeof categoryLabel; status: string; application_required: boolean; submission_deadline: string; rewards: Array<{ symbol: string; amount: string }> };
type NoticeRow = { id: string; title: string; body: string; category: keyof typeof noticeLabel; status: string; published_at: string | null; thumbnail_url: string | null; external_url: string | null };
type HighlightRow = { id: string; type: string; title: string; description: string; image_url: string | null; link_url: string | null; display_order: number; is_published: boolean };

const bountyStatus = (status: string): AdminBounty["status"] => {
  if (status === "DRAFT") return "draft";
  if (status === "FUNDING_PENDING") return "funding";
  if (status === "OPEN") return "active";
  if (status === "IN_REVIEW" || status === "SUBMISSION_CLOSED") return "reviewing";
  return "closed";
};

export function createAdminApi(http: ApiHttp) {
  return {
    getAdminUsers: async (query = ""): Promise<AdminUser[]> => {
      const rows = await http.fetchJson<UserRow[]>(`/admin/users?q=${encodeURIComponent(query)}`);
      return rows.map((row) => ({
        slug: row.id, nickname: row.nickname, email: row.email,
        joinedAt: new Date(row.created_at).toLocaleDateString("en-US"),
        walletAddress: row.wallet_address, walletStatus: row.wallet_address ? "linked" : null,
        isMember: row.is_member,
        memberRole: row.member_role ? roleLabel[row.member_role] : null,
        memberDisplayOrder: row.member_display_order,
      }));
    },
    setAdminMember: async (userId: string, input: { isMember: boolean; role?: string; displayOrder?: number }) => {
      await http.fetchJson(`/admin/users/${encodeURIComponent(userId)}/member`, {
        method: "POST",
        body: { ...input, ...(input.role ? { role: roleCode[input.role as keyof typeof roleCode] } : {}) },
      });
    },
    getAdminBounties: async (): Promise<AdminBounty[]> => {
      const rows = await http.fetchJson<BountyRow[]>("/admin/bounties");
      return rows.map((row) => ({
        slug: row.id, title: row.title, sponsor: row.sponsor_name,
        reward: { amount: Number(row.rewards[0]?.amount ?? 0) / 10 ** (row.rewards[0]?.symbol === "USDC" ? 6 : 18), currency: row.rewards[0]?.symbol === "USDC" ? "USDC" : "INJ" },
        intakeEnabled: row.application_required, status: bountyStatus(row.status),
        deadline: row.submission_deadline, tags: [categoryLabel[row.category]],
        description: row.description || row.summary, submissionGuide: row.requirements,
        deliverables: row.requirements.split("\n").filter(Boolean), reviewProcess: row.evaluation_criteria,
      }));
    },
    saveAdminBounty: async (bounty: AdminBounty, create: boolean): Promise<{ id: string }> => {
      const body = {
        title: bounty.title, sponsorName: bounty.sponsor,
        summary: bounty.description.slice(0, 240), description: bounty.description,
        requirements: bounty.deliverables.join("\n") || bounty.submissionGuide,
        evaluationCriteria: bounty.reviewProcess,
        category: categoryCode[bounty.tags[0] ?? "Other"],
        applicationRequired: bounty.intakeEnabled, maxWinners: 1,
        submissionDeadline: bounty.deadline,
        ...(create && bounty.reward.amount > 0 ? { reward: {
          tokenType: "NATIVE",
          ...(bounty.reward.currency === "INJ" ? { tokenDenom: "inj" } : {}),
          displaySymbol: bounty.reward.currency,
          amount: parseUnits(String(bounty.reward.amount), bounty.reward.currency === "USDC" ? 6 : 18).toString(),
        } } : {}),
      };
      return http.fetchJson(create ? "/admin/bounties" : `/admin/bounties/${encodeURIComponent(bounty.slug)}`, { method: create ? "POST" : "PATCH", body });
    },
    transitionAdminBounty: async (bountyId: string, to: string) => { await http.fetchJson(`/admin/bounties/${encodeURIComponent(bountyId)}/transition`, { method: "POST", body: { to } }); },
    deleteAdminBounty: async (bountyId: string) => { await http.fetchJson(`/admin/bounties/${encodeURIComponent(bountyId)}`, { method: "DELETE" }); },
    getAdminPosts: async (): Promise<AdminPost[]> => {
      const rows = await http.fetchJson<NoticeRow[]>("/admin/notices");
      return rows.map((row) => ({ slug: row.id, title: row.title, category: noticeLabel[row.category], status: row.status === "PUBLISHED" ? "published" : "draft", publishedAt: row.published_at, bodyMarkdown: row.body, thumbnail: row.thumbnail_url, externalUrl: row.external_url }));
    },
    saveAdminPost: (post: AdminPost, create: boolean): Promise<{ id: string }> => http.fetchJson(create ? "/admin/notices" : `/admin/notices/${encodeURIComponent(post.slug)}`, { method: create ? "POST" : "PATCH", body: { title: post.title, summary: post.bodyMarkdown.slice(0, 240), body: post.bodyMarkdown, category: noticeCode[post.category], thumbnailUrl: post.thumbnail ?? undefined, externalUrl: post.externalUrl ?? undefined, publish: post.status === "published" } }),
    deleteAdminPost: async (id: string) => { await http.fetchJson(`/admin/notices/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    getAdminHighlights: async (): Promise<AdminHighlight[]> => {
      const rows = await http.fetchJson<HighlightRow[]>("/admin/highlights");
      return rows.map((row) => ({ id: row.id, type: highlightLabel[row.type as keyof typeof highlightLabel] ?? "Featured bounty", title: row.title, description: row.description, order: row.display_order, link: row.link_url ?? undefined, image: row.image_url, published: row.is_published }));
    },
    saveAdminHighlight: (item: AdminHighlight, create: boolean): Promise<{ id: string }> => http.fetchJson(create ? "/admin/highlights" : `/admin/highlights/${encodeURIComponent(item.id)}`, { method: create ? "POST" : "PATCH", body: { type: highlightCode[item.type], title: item.title, description: item.description ?? item.title, imageUrl: item.image ?? undefined, linkUrl: item.link, displayOrder: item.order, publish: item.published ?? true } }),
    deleteAdminHighlight: async (id: string) => { await http.fetchJson(`/admin/highlights/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
}
