import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/http";
import { createMockApiClient, MockApiError } from "@/lib/mocks/api-client";
import { getMockFixtureSnapshot } from "@/lib/mocks/fixtures";

const owner = { status: "signed-in" as const, user: getMockFixtureSnapshot().account.user };
const available = <T>(result: { status: string; data?: T }): T => {
  expect(result.status).toBe("available");
  return result.data as T;
};

describe("mock api client parity", () => {
  it("throws ApiHttpError-shaped errors so component code branches the same way as in api mode", async () => {
    const client = createMockApiClient();
    const error = await client.rotateAgentKey("missing").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MockApiError);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect([(error as ApiHttpError).status, (error as ApiHttpError).code]).toEqual([404, "AGENT_NOT_FOUND"]);
  });

  it("registers an agent as pending, verifies it to ACTIVE with a one-time key, and lists it", async () => {
    const client = createMockApiClient();
    const registration = await client.registerAgent({ name: "fresh-agent", walletAddress: "0xA9e1000000000000000000000000000000000001" });
    expect(registration.status).toBe("PENDING_VERIFICATION");

    let agents = available(await client.getAgents(owner));
    expect(agents.find((agent) => agent.id === registration.agentId)).toMatchObject({
      name: "fresh-agent", walletAddress: "0xA9e1000000000000000000000000000000000001", status: "PENDING_VERIFICATION", verified: false, apiKeyMasked: "-", keyStatus: null,
    });

    const verification = await client.verifyAgent(registration.agentId, "0xsig");
    expect(verification).toMatchObject({ agentId: registration.agentId, status: "ACTIVE" });
    expect(verification.apiKey).toMatch(/^nl_preview_/);
    agents = available(await client.getAgents(owner));
    const verified = agents.find((agent) => agent.id === registration.agentId);
    expect(verified).toMatchObject({ status: "ACTIVE", verified: true, keyStatus: "ACTIVE", keyExpiresAt: verification.expiresAt });
    // The list only carries the masked key, never the revealed one.
    expect(verified?.apiKeyMasked).toMatch(/^nl_live_····…/);
    expect(JSON.stringify(agents)).not.toContain(verification.apiKey);

    // An ACTIVE wallet cannot be registered twice (BE 409); a fresh client starts from the fixtures again.
    await expect(client.registerAgent({ name: "dup", walletAddress: "0xa9e1000000000000000000000000000000000001" })).rejects.toMatchObject({ status: 409, code: "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED" });
    await expect(client.verifyAgent("missing", "0xsig")).rejects.toMatchObject({ status: 404, code: "AGENT_NOT_FOUND" });
    expect(available(await createMockApiClient().getAgents(owner)).some((agent) => agent.id === registration.agentId)).toBe(false);
  });

  it("records a submission so getSubmissions and the application join reflect it", async () => {
    const client = createMockApiClient();
    const before = available(await client.getSubmissions(owner));
    expect(before.some((submission) => submission.bountySlug === "wallet-onboarding-states")).toBe(false);

    const first = await client.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.test", description: "Done" });
    expect(first).toMatchObject({ revisionNo: 1, status: "SUBMITTED" });
    expect(available(await client.getSubmissions(owner))).toContainEqual({ bountySlug: "wallet-onboarding-states", status: "submitted", agent: null, paymentStatus: "NONE", reviewComment: null });
    // The approved fixture application on that bounty moves to "submitted", like the api client's join.
    expect(available(await client.getApplications(owner)).find((application) => application.bountySlug === "wallet-onboarding-states")?.status).toBe("submitted");

    const second = await client.submitBounty("wallet-onboarding-states", { submissionUrl: "https://x.test/2", description: "Again" });
    expect(second).toMatchObject({ revisionNo: 2, status: "RESUBMITTED" });
    expect(available(await client.getSubmissions(owner)).filter((submission) => submission.bountySlug === "wallet-onboarding-states")).toHaveLength(1);
  });

  it("applies with the api status set (no under_review)", async () => {
    const client = createMockApiClient();
    await client.applyToBounty("helix-volume-analytics", { message: "QA approach" });
    const statuses = new Set(available(await client.getApplications(owner)).map((application) => application.status));
    for (const status of statuses) expect(["open", "approved", "submitted", "completed", "rejected"]).toContain(status);
  });

  it("keeps agent-made rows on the same bounty when the owner applies directly", async () => {
    const client = createMockApiClient();
    const before = available(await client.getApplications(owner)).filter((application) => application.bountySlug === "neptune-api-docs");
    expect(before.map((application) => application.agent?.name)).toEqual(["market-scout-agent"]);
    await client.applyToBounty("neptune-api-docs", { message: "Direct application" });
    const after = available(await client.getApplications(owner)).filter((application) => application.bountySlug === "neptune-api-docs");
    expect(after.map((application) => application.agent?.name ?? null).sort()).toEqual([null, "market-scout-agent"].sort());
    // Applying again replaces only the owner's own row.
    await client.applyToBounty("neptune-api-docs", { message: "Second direct application" });
    expect(available(await client.getApplications(owner)).filter((application) => application.bountySlug === "neptune-api-docs")).toHaveLength(2);
  });
});

describe("mock admin api persistence (per client, resets with a new client)", () => {
  it("creates a bounty with a generated id, edits, transitions and deletes it", async () => {
    const client = createMockApiClient();
    const [template] = await client.getAdminBounties();
    const { id } = await client.saveAdminBounty({ ...template, slug: "", title: "Brand new bounty", status: "draft" }, true);
    expect(id).toMatch(/^preview-bounty-\d+$/);
    expect((await client.getAdminBounties()).find((bounty) => bounty.slug === id)).toMatchObject({ title: "Brand new bounty", status: "draft" });

    await client.saveAdminBounty({ ...template, slug: id, title: "Renamed", status: "draft" }, false);
    await client.transitionAdminBounty(id, "OPEN");
    expect((await client.getAdminBounties()).find((bounty) => bounty.slug === id)).toMatchObject({ title: "Renamed", status: "active" });

    await client.deleteAdminBounty(id);
    expect((await client.getAdminBounties()).some((bounty) => bounty.slug === id)).toBe(false);
    await expect(client.deleteAdminBounty(id)).rejects.toMatchObject({ status: 404, code: "BOUNTY_NOT_FOUND" });
    expect((await createMockApiClient().getAdminBounties()).some((bounty) => bounty.title === "Renamed")).toBe(false);
  });

  it("filters users by nickname or email and persists member assignment", async () => {
    const client = createMockApiClient();
    expect((await client.getAdminUsers("JAE")).map((user) => user.nickname)).toEqual(["jaemin"]);
    expect((await client.getAdminUsers("sora@example")).map((user) => user.nickname)).toEqual(["sora"]);
    expect(await client.getAdminUsers("nobody")).toEqual([]);

    await client.setAdminMember("sora", { isMember: true, role: "Design", displayOrder: 9 });
    expect((await client.getAdminUsers("sora"))[0]).toMatchObject({ isMember: true, memberRole: "Design", memberDisplayOrder: 9 });
    await client.setAdminMember("sora", { isMember: false });
    expect((await client.getAdminUsers("sora"))[0]).toMatchObject({ isMember: false, memberRole: null, memberDisplayOrder: null });
    await expect(client.setAdminMember("ghost", { isMember: true })).rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
  });

  it("persists notice and highlight saves, honouring the publish toggle contract", async () => {
    const client = createMockApiClient();
    const [post] = await client.getAdminPosts();
    const created = await client.saveAdminPost({ ...post, slug: "", title: "Draft note", status: "draft", publishedAt: null }, true);
    expect(created.id).toMatch(/^preview-post-\d+$/);
    expect((await client.getAdminPosts()).find((item) => item.slug === created.id)).toMatchObject({ title: "Draft note", status: "draft", publishedAt: null });
    // A plain edit keeps the stored state; a toggle sets it.
    await client.saveAdminPost({ ...post, slug: created.id, title: "Edited", status: "published", publishedAt: null }, false);
    expect((await client.getAdminPosts()).find((item) => item.slug === created.id)).toMatchObject({ title: "Edited", status: "draft" });
    await client.saveAdminPost({ ...post, slug: created.id, title: "Edited", status: "published", publishedAt: null }, false, { publish: true });
    expect((await client.getAdminPosts()).find((item) => item.slug === created.id)?.status).toBe("published");
    await client.deleteAdminPost(created.id);
    expect((await client.getAdminPosts()).some((item) => item.slug === created.id)).toBe(false);

    const highlight = await client.saveAdminHighlight({ id: "ignored", type: "MILESTONE", title: "New milestone", order: 9, image: null, published: true }, true);
    expect(highlight.id).toMatch(/^preview-highlight-\d+$/);
    expect((await client.getAdminHighlights()).find((item) => item.id === highlight.id)).toMatchObject({ title: "New milestone", published: true });
    // A plain edit keeps the stored type and published state; options carry the toggles like the api client's PATCH body.
    await client.saveAdminHighlight({ id: highlight.id, type: "AWARD", title: "Renamed milestone", order: 1, image: null, published: false }, false);
    expect((await client.getAdminHighlights()).find((item) => item.id === highlight.id)).toMatchObject({ title: "Renamed milestone", order: 1, type: "MILESTONE", published: true });
    await client.saveAdminHighlight({ id: highlight.id, type: "AWARD", title: "Renamed milestone", order: 1, image: null, published: false }, false, { typeChanged: true, publish: false });
    expect((await client.getAdminHighlights()).find((item) => item.id === highlight.id)).toMatchObject({ type: "AWARD", published: false });
    await client.deleteAdminHighlight(highlight.id);
    expect((await client.getAdminHighlights()).some((item) => item.id === highlight.id)).toBe(false);
  });
});
