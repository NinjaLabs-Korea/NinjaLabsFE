import { describe, expect, it, vi } from "vitest";
import { createAdminApi } from "@/lib/api/admin";
import type { ApiHttp } from "@/lib/api/http";
import type { AdminBounty, AdminHighlight, AdminPost } from "@/lib/admin";

const post: AdminPost = {
  slug: "n1", title: "Title", category: "Events", status: "published", publishedAt: "2026-06-20T00:00:00Z",
  bodyMarkdown: "Body", thumbnail: null, externalUrl: null,
};

function createHttp() {
  const fetchJson = vi.fn(async () => ({ id: "n1" }));
  const http = { fetchJson, fetchForm: vi.fn(), hasSession: () => true, signOutRemote: vi.fn() } as unknown as ApiHttp;
  return { http, fetchJson };
}

describe("admin notice save payload", () => {
  it("omits `publish` on a plain edit so the BE keeps published_at", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminPost(post, false);
    expect(fetchJson).toHaveBeenCalledWith("/admin/notices/n1", expect.objectContaining({ method: "PATCH" }));
    const [, init] = fetchJson.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(init.body).not.toHaveProperty("publish");
    expect(init.body).toMatchObject({ title: "Title", body: "Body", category: "EVENT" });
  });

  it("sends `publish` only when the status was toggled", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminPost({ ...post, status: "draft" }, false, { publish: false });
    await api.saveAdminPost(post, false, { publish: true });
    const bodies = fetchJson.mock.calls.map((call) => (call as unknown as [string, { body: Record<string, unknown> }])[1].body);
    expect(bodies[0]).toMatchObject({ publish: false });
    expect(bodies[1]).toMatchObject({ publish: true });
  });

  it("derives `publish` from the status on create", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminPost(post, true);
    await api.saveAdminPost({ ...post, status: "draft" }, true);
    const calls = fetchJson.mock.calls as unknown as Array<[string, { method: string; body: Record<string, unknown> }]>;
    expect(calls[0][0]).toBe("/admin/notices");
    expect(calls[0][1]).toMatchObject({ method: "POST", body: { publish: true } });
    expect(calls[1][1]).toMatchObject({ method: "POST", body: { publish: false } });
  });

  it("sends a plain-text summary derived from the markdown body", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminPost({ ...post, bodyMarkdown: "## Kickoff\n\nJoin the **hackathon** at [Injective](https://injective.com).\n\n- Prizes\n- `code`" }, true);
    const [, init] = fetchJson.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(init.body.summary).toBe("Kickoff Join the hackathon at Injective. Prizes code");
  });

  it("sends cleared thumbnail/external URLs as null so the BE clears the columns (never an omitted key)", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminPost({ ...post, thumbnail: null, externalUrl: null }, false);
    const [, init] = fetchJson.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(init.body).toMatchObject({ thumbnailUrl: null, externalUrl: null });
    expect(Object.keys(init.body)).toEqual(expect.arrayContaining(["thumbnailUrl", "externalUrl"]));
  });

  it("maps the admin user join date to a stable ISO day", async () => {
    const { http, fetchJson } = createHttp();
    fetchJson.mockResolvedValueOnce([
      { id: "u1", email: "a@b.c", nickname: "a", is_member: false, member_role: null, member_display_order: null, created_at: "2026-06-20T23:30:00Z", wallet_address: null },
    ] as never);
    const [user] = await createAdminApi(http).getAdminUsers();
    expect(user.joinedAt).toBe("2026-06-20");
  });

  it("shows the notice publish date as an ISO day, not the raw timestamp", async () => {
    const { http, fetchJson } = createHttp();
    const row = { id: "n1", title: "T", body: "B", category: "EVENT", thumbnail_url: null, external_url: null };
    fetchJson.mockResolvedValueOnce([
      { ...row, status: "PUBLISHED", published_at: "2026-10-24T07:43:03.996Z" },
      { ...row, id: "n2", status: "DRAFT", published_at: null },
    ] as never);
    const [published, draft] = await createAdminApi(http).getAdminPosts();
    expect(published.publishedAt).toBe("2026-10-24");
    expect(draft.publishedAt).toBeNull();
  });
});

const bounty: AdminBounty = {
  slug: "b1", title: "Widget", sponsor: "Injective", reward: { amount: 5, currency: "INJ" }, intakeEnabled: false,
  submissionMode: "direct", coverImage: null, status: "active", deadline: "2026-07-14T14:59:37.123Z", applicationDeadline: null,
  maxWinners: 3, tags: ["Dev"], description: "Desc", submissionGuide: "", requirements: "- Repo\n\n  indented note", deliverables: ["- Repo", "indented note"], reviewProcess: "Review",
};

describe("admin bounty save payload", () => {
  it("PATCH preserves the loaded record's maxWinners and the original deadline string", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty(bounty, false);
    const [path, init] = fetchJson.mock.calls[0] as unknown as [string, { method: string; body: Record<string, unknown> }];
    expect(path).toBe("/admin/bounties/b1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toMatchObject({ maxWinners: 3, submissionDeadline: "2026-07-14T14:59:37.123Z" });
    expect(init.body).not.toHaveProperty("reward");
  });

  it("sends the raw requirements string verbatim and a cleared cover image as null", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty({ ...bounty, coverImage: null }, false);
    const [, init] = fetchJson.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    // Blank lines and indentation survive: deliverables are derived for display only, never re-joined for the PATCH.
    expect(init.body).toMatchObject({ requirements: "- Repo\n\n  indented note", coverImageUrl: null });
    expect(Object.keys(init.body)).toContain("coverImageUrl");
  });

  it("POST sends the form's maxWinners", async () => {
    const { http, fetchJson } = createHttp();
    await createAdminApi(http).saveAdminBounty({ ...bounty, maxWinners: 1 }, true);
    const [, init] = fetchJson.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(init.body).toMatchObject({ maxWinners: 1 });
  });

  it("reads max_winners and application_deadline from the BE row", async () => {
    const { http, fetchJson } = createHttp();
    fetchJson.mockResolvedValueOnce([{
      id: "b1", title: "Widget", sponsor_name: "Injective", summary: "S", description: "D", requirements: "Repo", evaluation_criteria: "E",
      category: "DEV", status: "OPEN", application_required: false, submission_mode: "DIRECT", cover_image_url: null,
      submission_deadline: "2026-07-14T14:59:37.123Z", application_deadline: "2026-07-01T00:00:00.000Z", max_winners: 2,
      rewards: [{ symbol: "INJ", amount: "5000000000000000000" }],
    }] as never);
    const [row] = await createAdminApi(http).getAdminBounties();
    expect(row).toMatchObject({ maxWinners: 2, applicationDeadline: "2026-07-01T00:00:00.000Z", deadline: "2026-07-14T14:59:37.123Z", requirements: "Repo", deliverables: ["Repo"] });
  });
});

const highlight: AdminHighlight = { id: "h1", type: "PARTNERSHIP", title: "Hydro", description: "Partner", order: 2, image: "/media/11111111-1111-4111-8111-111111111111", link: "/notices", published: true };

describe("admin highlight save payload", () => {
  const body = (fetchJson: ReturnType<typeof createHttp>["fetchJson"], index = 0) =>
    (fetchJson.mock.calls[index] as unknown as [string, { method: string; body: Record<string, unknown> }])[1];

  it("keeps every BE type code on read without falling back to another type", async () => {
    const { http, fetchJson } = createHttp();
    const rows = ["MILESTONE", "FEATURED_BOUNTY", "PROJECT", "PARTNERSHIP", "AWARD", "OTHER", "FUTURE_TYPE"].map((type, index) => ({
      id: `h${index}`, type, title: type, description: "", image_url: null, link_url: null, display_order: index, is_published: index % 2 === 0,
    }));
    fetchJson.mockResolvedValueOnce(rows as never);
    const items = await createAdminApi(http).getAdminHighlights();
    expect(items.map((item) => item.type)).toEqual(["MILESTONE", "FEATURED_BOUNTY", "PROJECT", "PARTNERSHIP", "AWARD", "OTHER", "FUTURE_TYPE"]);
    expect(items.map((item) => item.published)).toEqual([true, false, true, false, true, false, true]);
  });

  it("PATCH omits `type` and `publish` unless the admin changed them, and sends cleared URLs as null", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminHighlight({ ...highlight, type: "FUTURE_TYPE", image: null, link: undefined }, false, undefined);
    expect(body(fetchJson).method).toBe("PATCH");
    expect(body(fetchJson).body).not.toHaveProperty("type");
    expect(body(fetchJson).body).not.toHaveProperty("publish");
    expect(body(fetchJson).body).toMatchObject({ imageUrl: null, linkUrl: null, displayOrder: 2 });

    await api.saveAdminHighlight({ ...highlight, type: "AWARD", published: false }, false, { typeChanged: true, publish: false });
    expect(body(fetchJson, 1).body).toMatchObject({ type: "AWARD", publish: false, imageUrl: highlight.image, linkUrl: "/notices" });
  });

  it("POST always sends `type` and derives `publish` from the chosen state (never hard-coded true)", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminHighlight({ ...highlight, published: false }, true);
    await api.saveAdminHighlight({ ...highlight, published: true }, true);
    expect(body(fetchJson, 0)).toMatchObject({ method: "POST", body: { type: "PARTNERSHIP", publish: false } });
    expect(body(fetchJson, 1)).toMatchObject({ method: "POST", body: { type: "PARTNERSHIP", publish: true } });
  });
});

describe("admin notice event date", () => {
  it("sends eventDate on create and edit, and null when it was cleared (an omitted key would keep the old date)", async () => {
    const { http, fetchJson } = createHttp();
    const api = createAdminApi(http);
    await api.saveAdminPost({ ...post, eventDate: "2026-06-18" }, true);
    await api.saveAdminPost({ ...post, eventDate: null }, false);
    await api.saveAdminPost(post, false);
    const bodies = fetchJson.mock.calls.map((call) => (call as unknown as [string, { body: Record<string, unknown> }])[1].body);
    expect(bodies[0]).toMatchObject({ eventDate: "2026-06-18" });
    expect(bodies[1]).toMatchObject({ eventDate: null });
    expect(bodies[2]).toHaveProperty("eventDate", null);
  });
});
