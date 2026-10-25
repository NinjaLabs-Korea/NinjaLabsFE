// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyOperations } from "@/components/admin/BountyOperations";
import { NftJobsManager } from "@/components/admin/NftJobsManager";
import { OperationsConsole } from "@/components/admin/OperationsConsole";
import type { AdminOperations } from "@/lib/admin-operations";
import { ApiHttpError } from "@/lib/api/http";
import { renderWithIntl } from "@/test/intl";

const HASH = "ef".repeat(32);

function operations(overrides: Partial<AdminOperations> = {}): AdminOperations {
  return {
    bounty: { id: "b1", title: "Widget", status: "IN_REVIEW", submissionDeadline: "2099-01-01T00:00:00.000Z", maxWinners: 2, applicationRequired: true },
    lifecycle: { blockers: { COMPLETED: [{ code: "UNRESOLVED_SUBMISSIONS", count: 1 }, { code: "UNPAID_WINNERS" }], OPEN: [] }, allowedTransitions: ["COMPLETED", "OPEN"] },
    applications: [{ id: "a1", status: "PENDING", kind: "USER", userId: "u1", nickname: "mina", agentId: null, agentName: null, message: "pick me", portfolioUrl: null, reviewNote: null, appliedAt: "2026-10-01T00:00:00Z", reviewedAt: null }],
    submissions: [
      { id: "s1", status: "RESUBMITTED", kind: "USER", userId: "u2", nickname: "juho", agentId: null, agentName: null, currentRevisionNo: 3, submittedAt: "2026-10-02T00:00:00Z", reviewedAt: null, recipientWalletAddress: "inj1juho", reviewComment: null, revisions: [{ revisionNo: 3, submissionUrl: "https://x.test/v3", description: "third", repositoryUrl: null, commitSha: null, createdAt: "2026-10-03T00:00:00Z" }], reviews: [] },
      { id: "s2", status: "APPROVED", kind: "AGENT", userId: "u3", nickname: "ara", agentId: "ag", agentName: "alpha-bot", currentRevisionNo: 1, submittedAt: "2026-10-02T00:00:00Z", reviewedAt: null, recipientWalletAddress: "inj1ara", reviewComment: "ok", revisions: [], reviews: [] },
    ],
    rewards: [{ id: "r1", status: "FUNDED", symbol: "INJ", amount: "5000000000000000000", depositedAmount: "5000000000000000000", depositedAt: null, depositTxHash: null, custodyAddress: "inj1ms", cap: "5000000000000000000", allocated: "2000000000000000000" }],
    payouts: [
      { id: "p-mine", rewardId: "r1", submissionId: "s2", status: "REQUESTED", amount: "2000000000000000000", symbol: "INJ", txHash: null, recipientAddress: "inj1ara", requestedBy: "me", requestedByNickname: "me", requestedAt: "2026-10-04T00:00:00Z", approvedByNickname: null, approvedAt: null, paidAt: null, requestedByMe: true },
    ],
    policy: { payoutSelfApprovalAllowed: false },
    ...overrides,
  };
}

const adminApi = {
  getAdminOperations: vi.fn(async () => operations()),
  reviewAdminApplication: vi.fn(async () => undefined),
  reviewAdminSubmission: vi.fn(async () => undefined),
  confirmAdminDeposit: vi.fn(async () => undefined),
  requestAdminPayout: vi.fn(async () => undefined),
  approveAdminPayout: vi.fn(async () => undefined),
  markAdminPayoutPaid: vi.fn(async () => undefined),
  transitionAdminBounty: vi.fn(async () => undefined),
  getAdminNftJobs: vi.fn(),
  retryAdminNftJob: vi.fn(async () => undefined),
  getAdminBounties: vi.fn(),
};

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  for (const fn of Object.values(adminApi)) fn.mockClear();
  adminApi.getAdminOperations.mockImplementation(async () => operations());
});

const renderOps = async () => {
  renderWithIntl(<><BountyOperations bountyId="b1" /><AdminToastHost /></>);
  await screen.findByRole("heading", { name: "Widget" });
};
const dialog = () => screen.getByRole("dialog");
const payouts = () => within(screen.getByRole("region", { name: "Winner payouts" }));

describe("BountyOperations", () => {
  it("shows localized blockers and disables a blocked transition; an unblocked one posts the transition", async () => {
    await renderOps();
    const complete = screen.getByRole("button", { name: "Complete bounty" }) as HTMLButtonElement;
    expect(complete.disabled).toBe(true);
    expect(screen.getByText("1 submission still needs a final review (including requested revisions).")).toBeTruthy();
    expect(screen.getByText("Every approved winner needs a payout recorded as paid, and no payout may still be open.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open bounty" }));
    await waitFor(() => expect(adminApi.transitionAdminBounty).toHaveBeenCalledWith("b1", "OPEN"));
  });

  it("keeps the newest read when an older overlapping read answers last", async () => {
    await renderOps();
    const pending: Array<(value: AdminOperations) => void> = [];
    adminApi.getAdminOperations.mockImplementation(() => new Promise<AdminOperations>((resolve) => { pending.push(resolve); }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(pending).toHaveLength(2);
    const withTitle = (title: string) => operations({ bounty: { ...operations().bounty, title } });
    pending[1](withTitle("Newer read"));
    expect(await screen.findByRole("heading", { name: "Newer read" })).toBeTruthy();
    pending[0](withTitle("Older read"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("heading", { name: "Newer read" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Older read" })).toBeNull();
  });

  it("explains the two-person rule instead of offering Approve on the admin's own payout request", async () => {
    await renderOps();
    expect(screen.getByText("You requested this payout, so another admin must approve it (two-person rule).")).toBeTruthy();
    expect(payouts().queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText("Two-person rule: a payout must be approved by a different admin than the one who requested it.")).toBeTruthy();
  });

  it("with self-approval enabled, Approve opens a dialog that warns it will be audited", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ policy: { payoutSelfApprovalAllowed: true } }));
    await renderOps();
    fireEvent.click(payouts().getByRole("button", { name: "Approve" }));
    expect(within(dialog()).getByText(/recorded as a self-approval in the audit log/)).toBeTruthy();
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Approve" }).closest("form")!);
    await waitFor(() => expect(adminApi.approveAdminPayout).toHaveBeenCalledWith("p-mine"));
  });

  it("maps a 403 PAYOUT_SELF_APPROVAL from the BE to its localized message", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ policy: { payoutSelfApprovalAllowed: true } }));
    adminApi.approveAdminPayout.mockRejectedValueOnce(new ApiHttpError(403, "PAYOUT_SELF_APPROVAL"));
    await renderOps();
    fireEvent.click(payouts().getByRole("button", { name: "Approve" }));
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Approve" }).closest("form")!);
    expect(await screen.findByText("You requested this payout, so you cannot approve it. Ask another admin (two-person rule).")).toBeTruthy();
  });

  it("reviews the revision on screen (revisionNo) and requires a comment for a revision request", async () => {
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));
    const form = within(dialog()).getByRole("button", { name: "Request revision" }).closest("form")!;
    fireEvent.submit(form);
    expect(within(dialog()).getByRole("alert").textContent).toBe("Add a comment explaining what needs to change.");
    expect(adminApi.reviewAdminSubmission).not.toHaveBeenCalled();
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "Add tests" } });
    fireEvent.submit(form);
    await waitFor(() => expect(adminApi.reviewAdminSubmission).toHaveBeenCalledWith("s1", { decision: "REQUEST_REVISION", revisionNo: 3, comment: "Add tests" }));
  });

  it("closes a review dialog whose revision was superseded by a re-read instead of resending the stale revisionNo", async () => {
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));
    expect(dialog()).toBeTruthy();
    const base = operations();
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: base.submissions.map((item) => (item.id === "s1" ? { ...item, currentRevisionNo: 4 } : item)) }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes an approve dialog when another admin already approved the payout", async () => {
    await renderOps();
    // p-mine is requested by "me" (self-blocked), so use a payout someone else requested.
    const others = operations({ payouts: [{ ...operations().payouts[0], id: "p-other", requestedByMe: false }] });
    adminApi.getAdminOperations.mockImplementation(async () => others);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const approve = await within(screen.getByRole("region", { name: "Winner payouts" })).findByRole("button", { name: "Approve" });
    fireEvent.click(approve);
    expect(dialog()).toBeTruthy();
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [{ ...others.payouts[0], status: "APPROVED" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the deposit dialog when another admin already confirmed that deposit", async () => {
    const pending = operations({ rewards: [{ ...operations().rewards[0], status: "DEPOSIT_PENDING", depositedAmount: null, cap: null, allocated: "0" }] });
    adminApi.getAdminOperations.mockImplementation(async () => pending);
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Confirm deposit" }));
    expect(dialog()).toBeTruthy();
    adminApi.getAdminOperations.mockImplementation(async () => operations());
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the payout request dialog once its submission already has a payout", async () => {
    // s2 (approved) has p-mine; use a payout-free state first so s2 is a candidate.
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [] }));
    await renderOps();
    fireEvent.click(payouts().getByRole("button", { name: "Request payout" }));
    expect(dialog()).toBeTruthy();
    adminApi.getAdminOperations.mockImplementation(async () => operations());
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("only offers rejection for a pending application once intake is closed (IN_REVIEW)", async () => {
    await renderOps();
    const row = screen.getByText("pick me").closest("tr")!;
    expect(within(row).queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Reject" }));
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: " late " } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Reject" }).closest("form")!);
    await waitFor(() => expect(adminApi.reviewAdminApplication).toHaveBeenCalledWith("a1", { decision: "REJECTED", note: " late " }));
  });

  it("records a payment only with a valid tx hash", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [{ ...operations().payouts[0], status: "APPROVED", requestedByMe: false }] }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    const form = within(dialog()).getByRole("button", { name: "Mark paid" }).closest("form")!;
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "0x123" } });
    fireEvent.submit(form);
    expect(within(dialog()).getByRole("alert").textContent).toContain("32-byte hex");
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: HASH } });
    fireEvent.submit(form);
    await waitFor(() => expect(adminApi.markAdminPayoutPaid).toHaveBeenCalledWith("p-mine", HASH));
  });

  it("confirms a deposit with the amount converted to base units", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ bounty: { ...operations().bounty, status: "FUNDING_PENDING" }, rewards: [{ ...operations().rewards[0], status: "DEPOSIT_PENDING", depositedAmount: null, cap: null, allocated: "0" }], payouts: [] }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Confirm deposit" }));
    const [txInput, amountInput] = within(dialog()).getAllByRole("textbox");
    expect((amountInput as HTMLInputElement).value).toBe("5");
    fireEvent.change(amountInput, { target: { value: "4.9" } });
    fireEvent.change(txInput, { target: { value: HASH } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Confirm deposit" }).closest("form")!);
    expect(within(dialog()).getByRole("alert").textContent).toContain("must cover the posted reward");
    fireEvent.change(amountInput, { target: { value: "5.5" } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Confirm deposit" }).closest("form")!);
    await waitFor(() => expect(adminApi.confirmAdminDeposit).toHaveBeenCalledWith("r1", { txHash: HASH, depositedAmount: "5500000000000000000" }));
  });

  it("requests a payout for an approved submission without one, prefilled with the remaining headroom", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [] , rewards: [{ ...operations().rewards[0], allocated: "0" }] }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
    const amount = within(dialog()).getByRole("textbox") as HTMLInputElement;
    expect(amount.value).toBe("5");
    fireEvent.change(amount, { target: { value: "6" } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Request payout" }).closest("form")!);
    expect(within(dialog()).getByRole("alert").textContent).toContain("Only 5 INJ is left");
    fireEvent.change(amount, { target: { value: "2.5" } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Request payout" }).closest("form")!);
    await waitFor(() => expect(adminApi.requestAdminPayout).toHaveBeenCalledWith({ rewardId: "r1", submissionId: "s2", amount: "2500000000000000000" }));
  });
});

describe("payout request without a recipient wallet", () => {
  it("explains the missing wallet instead of sending a request the BE answers with 404", async () => {
    const base = operations();
    adminApi.getAdminOperations.mockImplementation(async () => operations({
      payouts: [], rewards: [{ ...base.rewards[0], allocated: "0" }],
      submissions: [base.submissions[0], { ...base.submissions[1], recipientWalletAddress: null }],
    }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Request payout" }).closest("form")!);
    expect(within(dialog()).getByRole("alert").textContent).toContain("No linked wallet");
    expect(adminApi.requestAdminPayout).not.toHaveBeenCalled();
  });
});

describe("NftJobsManager", () => {
  it("lists FAILED jobs and retries one, then re-reads the page", async () => {
    adminApi.getAdminNftJobs.mockResolvedValue({ page: 1, pageSize: 30, total: 1, items: [{ id: "j1", nftId: "n1", jobType: "MINT_CHILD", status: "FAILED", retryCount: 5, lastError: "out of gas", scheduledAt: null, updatedAt: "2026-10-01T00:00:00Z", nftType: "BOUNTY_COMPLETION_CHILD", nftStatus: "FAILED", bountyTitle: "Widget", ownerNickname: "juho", ownerWalletAddress: "inj1juho" }] });
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    expect(await screen.findByText("out of gas")).toBeTruthy();
    expect(adminApi.getAdminNftJobs).toHaveBeenCalledWith("FAILED", 1);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(adminApi.retryAdminNftJob).toHaveBeenCalledWith("j1"));
    await waitFor(() => expect(adminApi.getAdminNftJobs).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    await waitFor(() => expect(adminApi.getAdminNftJobs).toHaveBeenLastCalledWith("PENDING", 1));
  });

  it("steps back to the new last page when a retry empties the last page (the pager would otherwise be hidden)", async () => {
    const job = (id: string) => ({ id, nftId: `${id}-n`, jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: `err ${id}`, scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null });
    let total = 31;
    adminApi.getAdminNftJobs.mockImplementation(async (_status: string, page: number) => ({
      page, pageSize: 30, total, items: page === 1 ? Array.from({ length: Math.min(total, 30) }, (_, i) => job(`j${i}`)) : total > 30 ? [job("j30")] : [],
    }));
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("err j30")).toBeTruthy();
    total = 30;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(adminApi.getAdminNftJobs).toHaveBeenLastCalledWith("FAILED", 1));
    expect(await screen.findByText("err j0")).toBeTruthy();
    expect(screen.queryByText("No jobs in this status.")).toBeNull();
  });

  it("steps back to the page on screen when fetching another page fails", async () => {
    const job = (id: string) => ({ id, nftId: `${id}-n`, jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: `err ${id}`, scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null });
    adminApi.getAdminNftJobs.mockImplementation(async (_status: string, page: number) => ({ page, pageSize: 30, total: 61, items: [job(`p${page}`)] }));
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    adminApi.getAdminNftJobs.mockRejectedValueOnce(new Error("down"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(adminApi.getAdminNftJobs).toHaveBeenLastCalledWith("FAILED", 1));
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(screen.getByText("err p1")).toBeTruthy();
  });

  it("ignores a slower response for the status the operator already switched away from", async () => {
    let resolveFailed: (value: unknown) => void = () => undefined;
    const job = { id: "jp", nftId: "np", jobType: "MINT_PARENT", status: "PENDING", retryCount: 1, lastError: "pending row", scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "PENDING", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null };
    adminApi.getAdminNftJobs.mockImplementation((status: string) => status === "FAILED"
      ? new Promise((resolve) => { resolveFailed = resolve; })
      : Promise.resolve({ page: 1, pageSize: 30, total: 1, items: [job] }));
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(await screen.findByText("pending row")).toBeTruthy();
    resolveFailed({ page: 1, pageSize: 30, total: 0, items: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("pending row")).toBeTruthy();
    expect(screen.queryByText("No jobs in this status.")).toBeNull();
  });

  it("drops the previous status's rows while the next status loads, and keeps them when the active tab is clicked again", async () => {
    const job = { id: "jf", nftId: "nf", jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: "failed row", scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null };
    let resolvePending: (value: unknown) => void = () => undefined;
    adminApi.getAdminNftJobs.mockImplementation((status: string) => status === "FAILED"
      ? Promise.resolve({ page: 1, pageSize: 30, total: 1, items: [job] })
      : new Promise((resolve) => { resolvePending = resolve; }));
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    expect(await screen.findByText("failed row")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Failed" }));
    expect(screen.getByText("failed row")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(screen.queryByText("failed row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    resolvePending({ page: 1, pageSize: 30, total: 0, items: [] });
    expect(await screen.findByText("No jobs in this status.")).toBeTruthy();
  });

  it("shows NFT_JOB_NOT_FOUND_OR_NOT_FAILED as its localized message", async () => {
    adminApi.getAdminNftJobs.mockResolvedValue({ page: 1, pageSize: 30, total: 1, items: [{ id: "j1", nftId: "n1", jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: null, scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null }] });
    adminApi.retryAdminNftJob.mockRejectedValueOnce(new ApiHttpError(404, "NFT_JOB_NOT_FOUND_OR_NOT_FAILED"));
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("This job is no longer failed (it may already be retrying).")).toBeTruthy();
  });
});

describe("OperationsConsole", () => {
  it("api mode: shows loading (not 'no bounties yet') until GET /admin/bounties answers, and a retry when it fails", async () => {
    let reject: (error: unknown) => void = () => undefined;
    adminApi.getAdminBounties.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    renderWithIntl(<><OperationsConsole bounties={[]} tabs={null}>{null}</OperationsConsole><AdminToastHost /></>);
    expect(screen.getByText("Loading operations…")).toBeTruthy();
    expect(screen.queryByText(/No bounties yet/)).toBeNull();
    reject(new ApiHttpError(500, "INTERNAL"));
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText(/No bounties yet/)).toBeNull();
    adminApi.getAdminBounties.mockResolvedValueOnce([]);
    fireEvent.click(retry);
    expect(await screen.findByText(/No bounties yet/)).toBeTruthy();
  });
});
