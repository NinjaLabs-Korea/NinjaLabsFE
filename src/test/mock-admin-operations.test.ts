import { describe, expect, it } from "vitest";
import { createMockApiClient, MockApiError } from "@/lib/mocks/api-client";
import { getAdminBounties } from "@/lib/admin";
import { bountyHasOpenFunds, lifecycleFor } from "@/lib/mocks/admin-operations";
import type { OpsPayout, OpsReward } from "@/lib/admin-operations";

const HASH = "cd".repeat(32);
const codeOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(MockApiError);
  return [(error as MockApiError).status, (error as MockApiError).code];
};
const activeBounty = () => getAdminBounties().find((bounty) => bounty.status === "active" && bounty.reward.amount > 0 && bounty.intakeEnabled) ?? getAdminBounties().find((bounty) => bounty.status === "active" && bounty.reward.amount > 0)!;

describe("mock operations parity (lib/mocks/admin-operations.ts)", () => {
  it("serves a seeded operations view with BE-shaped rows and the lifecycle computed from them", async () => {
    const client = createMockApiClient();
    const bounty = activeBounty();
    const ops = await client.getAdminOperations(bounty.slug);
    expect(ops.bounty).toMatchObject({ id: bounty.slug, status: "OPEN" });
    expect(ops.rewards[0]).toMatchObject({ status: "FUNDED", symbol: bounty.reward.currency });
    expect(ops.lifecycle.allowedTransitions).toEqual(["SUBMISSION_CLOSED", "CANCELLED"]);
    expect(ops.payouts[0]).toMatchObject({ status: "REQUESTED", requestedByMe: false });
    expect(await codeOf(client.getAdminOperations("missing"))).toEqual([404, "BOUNTY_NOT_FOUND"]);
  });

  it("reviews a submission with the optimistic revision check and the comment rule", async () => {
    const client = createMockApiClient();
    const ops = await client.getAdminOperations(activeBounty().slug);
    const resubmitted = ops.submissions.find((s) => s.status === "RESUBMITTED")!;
    expect(await codeOf(client.reviewAdminSubmission(resubmitted.id, { decision: "APPROVE", revisionNo: 1 }))).toEqual([400, "SUBMISSION_REVISION_CHANGED"]);
    expect(await codeOf(client.reviewAdminSubmission(resubmitted.id, { decision: "REQUEST_REVISION", revisionNo: 2, comment: " " }))).toEqual([400, "REVISION_COMMENT_REQUIRED"]);
    await client.reviewAdminSubmission(resubmitted.id, { decision: "START_REVIEW", revisionNo: 2 });
    expect(await codeOf(client.reviewAdminSubmission(resubmitted.id, { decision: "START_REVIEW", revisionNo: 2 }))).toEqual([400, "SUBMISSION_NOT_REVIEWABLE"]);
    const after = await client.getAdminOperations(activeBounty().slug);
    expect(after.submissions.find((s) => s.id === resubmitted.id)).toMatchObject({ status: "IN_REVIEW", reviews: [{ decision: "START_REVIEW", revisionNo: 2 }] });
  });

  it("enforces the two-person rule on payouts this tab requested, approves another admin's request, and records the payment", async () => {
    const client = createMockApiClient();
    const slug = activeBounty().slug;
    let ops = await client.getAdminOperations(slug);
    const seeded = ops.payouts[0];
    expect(await codeOf(client.markAdminPayoutPaid(seeded.id, HASH))).toEqual([404, "PAYOUT_NOT_FOUND_OR_WRONG_STATUS"]);
    await client.approveAdminPayout(seeded.id);
    expect(await codeOf(client.markAdminPayoutPaid(seeded.id, "nope"))).toEqual([400, "INVALID_TX_HASH"]);
    await client.markAdminPayoutPaid(seeded.id, HASH);
    ops = await client.getAdminOperations(slug);
    expect(ops.payouts[0]).toMatchObject({ status: "PAID", txHash: `0x${HASH}` });

    // a second approved submission → this admin requests → cannot approve their own request
    const resubmitted = ops.submissions.find((s) => s.status === "RESUBMITTED")!;
    await client.reviewAdminSubmission(resubmitted.id, { decision: "APPROVE", revisionNo: 2 });
    const reward = ops.rewards[0];
    // The seeded request takes one winner's share, so the rest of the reward is still allocatable.
    const headroom = (BigInt(reward.cap!) - BigInt(seeded.amount)).toString();
    expect(BigInt(headroom) > BigInt(0)).toBe(true);
    expect(await codeOf(client.requestAdminPayout({ rewardId: reward.id, submissionId: resubmitted.id, amount: (BigInt(headroom) + BigInt(1)).toString() }))).toEqual([400, "PAYOUT_EXCEEDS_AVAILABLE_REWARD"]);
    expect(await codeOf(client.requestAdminPayout({ rewardId: reward.id, submissionId: seeded.submissionId, amount: "1" }))).toEqual([409, "PAYOUT_ALREADY_REQUESTED"]);
    await client.requestAdminPayout({ rewardId: reward.id, submissionId: resubmitted.id, amount: headroom });
    ops = await client.getAdminOperations(slug);
    const mine = ops.payouts.find((p) => p.submissionId === resubmitted.id)!;
    expect(mine).toMatchObject({ status: "REQUESTED", requestedByMe: true, amount: headroom });
    expect(ops.rewards[0].allocated).toBe(reward.cap);
    expect(await codeOf(client.approveAdminPayout(mine.id))).toEqual([403, "PAYOUT_SELF_APPROVAL"]);
  });

  it("transitions an opened bounty through the BE table and its blockers", async () => {
    const client = createMockApiClient();
    const slug = activeBounty().slug;
    const ops = await client.getAdminOperations(slug);
    expect(await codeOf(client.transitionAdminBounty(slug, "COMPLETED"))).toEqual([400, "INVALID_TRANSITION:OPEN->COMPLETED"]);
    if (ops.applications.some((a) => a.status === "PENDING")) {
      expect(await codeOf(client.transitionAdminBounty(slug, "SUBMISSION_CLOSED"))).toEqual([400, "VALIDATION_FAILED"]);
      for (const application of ops.applications.filter((a) => a.status === "PENDING")) await client.reviewAdminApplication(application.id, { decision: "REJECTED" });
    }
    await client.transitionAdminBounty(slug, "SUBMISSION_CLOSED");
    expect((await client.getAdminOperations(slug)).bounty.status).toBe("SUBMISSION_CLOSED");
    expect((await client.getAdminBounties()).find((b) => b.slug === slug)?.status).toBe("reviewing");
  });

  it("confirms a pending deposit only with a valid hash and an amount covering the reward", async () => {
    const client = createMockApiClient();
    const funding = getAdminBounties().find((bounty) => bounty.reward.amount > 0);
    if (!funding) return;
    await client.saveAdminBounty({ ...funding, status: "funding" }, false);
    const ops = await client.getAdminOperations(funding.slug);
    const reward = ops.rewards[0];
    expect(reward.status).toBe("DEPOSIT_PENDING");
    expect(await codeOf(client.confirmAdminDeposit(reward.id, { txHash: HASH, depositedAmount: "1" }))).toEqual([404, "REWARD_NOT_FOUND_OR_NOT_PENDING"]);
    expect(await codeOf(client.confirmAdminDeposit(reward.id, { txHash: "x", depositedAmount: reward.amount }))).toEqual([400, "INVALID_TX_HASH"]);
    await client.confirmAdminDeposit(reward.id, { txHash: HASH, depositedAmount: reward.amount });
    expect((await client.getAdminOperations(funding.slug)).rewards[0]).toMatchObject({ status: "FUNDED", cap: reward.amount, depositTxHash: `0x${HASH}` });
  });

  it("lists NFT jobs by status and retries a FAILED one once", async () => {
    const client = createMockApiClient();
    const failed = await client.getAdminNftJobs("FAILED", 1);
    expect(failed.total).toBe(2);
    await client.retryAdminNftJob(failed.items[0].id);
    expect(await codeOf(client.retryAdminNftJob(failed.items[0].id))).toEqual([404, "NFT_JOB_NOT_FOUND_OR_NOT_FAILED"]);
    expect((await client.getAdminNftJobs("FAILED", 1)).total).toBe(1);
    expect((await client.getAdminNftJobs("PENDING", 1)).items.map((job) => job.id)).toContain(failed.items[0].id);
  });
});

describe("mock lifecycle blockers mirror BountyLifecycleService (UNPAID_WINNERS)", () => {
  const reward = { id: "rw", status: "FUNDED", cap: "100", allocated: "50" };
  const sub = { id: "s1", status: "APPROVED" };
  const payout = (status: string) => ({ id: "p1", rewardId: "rw", submissionId: "s1", status });
  const make = (over: { reward?: object; payouts?: object[] }) => ({
    bounty: { status: "IN_REVIEW", submissionDeadline: new Date(Date.now() + 1e9).toISOString() },
    applications: [], submissions: [sub], rewards: [{ ...reward, ...over.reward }], payouts: over.payouts ?? [],
  }) as unknown as Parameters<typeof lifecycleFor>[0];
  const codes = (ops: Parameters<typeof lifecycleFor>[0]) => {
    const { blockers } = lifecycleFor(ops);
    return [blockers.COMPLETED!.map((b) => b.code), blockers.CANCELLED!.map((b) => b.code)];
  };

  it("an owed winner with headroom blocks COMPLETED and CANCELLED", () => {
    expect(codes(make({}))).toEqual([["UNPAID_WINNERS"], ["UNPAID_WINNERS"]]);
  });

  it("a winner with only a CANCELLED payout, or an exhausted pool, blocks neither", () => {
    expect(codes(make({ payouts: [payout("CANCELLED")] }))).toEqual([[], []]);
    expect(codes(make({ reward: { allocated: "100" } }))).toEqual([[], []]);
  });

  it("open payouts block, FAILED counts as owed but not as an open payout, PAID blocks nothing", () => {
    expect(codes(make({ reward: { allocated: "100" }, payouts: [payout("APPROVED")] }))[1]).toEqual(["UNPAID_WINNERS"]);
    expect(codes(make({ reward: { allocated: "100" }, payouts: [payout("PAID")] }))).toEqual([[], []]);
    const ops = make({ reward: { allocated: "100" }, payouts: [payout("FAILED")] });
    expect(ops.payouts.filter((p) => ["REQUESTED", "AWAITING_MULTISIG_APPROVAL", "APPROVED", "BROADCASTING"].includes(p.status))).toHaveLength(0);
    expect(codes(ops)).toEqual([["UNPAID_WINNERS"], ["UNPAID_WINNERS"]]);
  });

  it("cancel is rejected with the BE 400 while a winner is owed", async () => {
    const client = createMockApiClient();
    const slug = activeBounty().slug;
    const ops = await client.getAdminOperations(slug);
    const resubmitted = ops.submissions.find((s) => s.status === "RESUBMITTED")!;
    await client.reviewAdminSubmission(resubmitted.id, { decision: "APPROVE", revisionNo: 2 });
    expect(await codeOf(client.transitionAdminBounty(slug, "CANCELLED"))).toEqual([400, "VALIDATION_FAILED"]);
  });
});

describe("mock deleteAdminBounty mirrors BOUNTY_HAS_OPEN_FUNDS (BE BountyAdminService.remove)", () => {
  const reward = (overrides: Partial<OpsReward> = {}): OpsReward => ({
    id: "r1", status: "FUNDED", symbol: "INJ", amount: "100", depositedAmount: "100", depositedAt: null, depositTxHash: null, custodyAddress: null, cap: "100", allocated: "0", ...overrides,
  });
  const payout = (status: OpsPayout["status"], amount = "100"): OpsPayout => ({
    id: `p-${status}`, rewardId: "r1", submissionId: "s1", status, amount, symbol: "INJ", txHash: null, recipientAddress: "inj1x", requestedBy: "a", requestedByNickname: null,
    requestedAt: "", approvedByNickname: null, approvedAt: null, paidAt: null, requestedByMe: false,
  });

  it.each<[string, OpsReward[], OpsPayout[], boolean]>([
    ["DEPOSIT_PENDING reward (nothing deposited)", [reward({ status: "DEPOSIT_PENDING", depositedAmount: null })], [], false],
    ["REFUNDED reward", [reward({ status: "REFUNDED" })], [], false],
    ["CANCELLED reward", [reward({ status: "CANCELLED", depositedAmount: null })], [], false],
    ["no rewards at all", [], [], false],
    ["REFUND_PENDING reward", [reward({ status: "REFUND_PENDING" })], [], true],
    ["FUNDED, nothing paid yet", [reward()], [], true],
    ["PARTIALLY_PAID, PAID total below the deposit", [reward({ status: "PARTIALLY_PAID" })], [payout("PAID", "60")], true],
    ["PAID in full", [reward({ status: "PAID" })], [payout("PAID", "100")], false],
    ["PAID in full across two payouts", [reward({ status: "PAID" })], [payout("PAID", "40"), payout("PAID", "60")], false],
    ["PAID up to the cap but the deposit was larger (surplus is still owed back)", [reward({ status: "PAID", depositedAmount: "120" })], [payout("PAID", "100")], true],
    ["fully paid but another payout is still open", [reward({ status: "PAID" })], [payout("PAID", "100"), payout("REQUESTED", "1")], true],
    ["open payout statuses", [reward({ status: "PAID" })], [payout("PAID", "100"), payout("AWAITING_MULTISIG_APPROVAL", "1")], true],
    ["APPROVED payout", [reward({ status: "PAID" })], [payout("PAID", "100"), payout("APPROVED", "1")], true],
    ["BROADCASTING payout", [reward({ status: "PAID" })], [payout("PAID", "100"), payout("BROADCASTING", "1")], true],
    ["fully paid plus terminal CANCELLED/FAILED payouts only", [reward({ status: "PAID" })], [payout("PAID", "100"), payout("CANCELLED", "5"), payout("FAILED", "5")], false],
  ])("%s", (_label, rewards, payouts, blocked) => {
    expect(bountyHasOpenFunds({ rewards, payouts })).toBe(blocked);
  });

  it("answers 409 for an opened bounty that holds funds and keeps it, even after one winner is paid", async () => {
    const client = createMockApiClient();
    const slug = activeBounty().slug;
    const ops = await client.getAdminOperations(slug);
    expect(await codeOf(client.deleteAdminBounty(slug))).toEqual([409, "BOUNTY_HAS_OPEN_FUNDS"]);
    expect((await client.getAdminBounties()).some((bounty) => bounty.slug === slug)).toBe(true);

    // The only payout is paid, but it is one share of the deposit: the rest is still in the multisig.
    await client.approveAdminPayout(ops.payouts[0].id);
    await client.markAdminPayoutPaid(ops.payouts[0].id, HASH);
    expect(await codeOf(client.deleteAdminBounty(slug))).toEqual([409, "BOUNTY_HAS_OPEN_FUNDS"]);
  });

  it("deletes an opened draft whose reward is still DEPOSIT_PENDING, and 404s a missing bounty", async () => {
    const client = createMockApiClient();
    const { id } = await client.saveAdminBounty({ ...activeBounty(), slug: "", title: "Unfunded draft", status: "draft" }, true);
    const draft = { slug: id };
    const ops = await client.getAdminOperations(draft.slug);
    expect(ops.rewards[0]).toMatchObject({ status: "DEPOSIT_PENDING" });
    await client.deleteAdminBounty(draft.slug);
    expect((await client.getAdminBounties()).some((bounty) => bounty.slug === draft.slug)).toBe(false);
    expect(await codeOf(client.deleteAdminBounty("missing"))).toEqual([404, "BOUNTY_NOT_FOUND"]);
  });
});
