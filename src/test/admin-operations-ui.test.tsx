// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyOperations } from "@/components/admin/BountyOperations";
import { OperationsConsole } from "@/components/admin/OperationsConsole";
import type { AdminOperations } from "@/lib/admin-operations";
import { ApiHttpError } from "@/lib/api/http";
import { renderWithIntl } from "@/test/intl";

const HASH = "ef".repeat(32);

function operations(overrides: Partial<AdminOperations> = {}): AdminOperations {
  return {
    bounty: { id: "b1", title: "Widget", status: "IN_REVIEW", submissionDeadline: "2099-01-01T00:00:00.000Z", maxWinners: 2, applicationRequired: true },
    lifecycle: { blockers: { COMPLETED: [{ code: "UNRESOLVED_SUBMISSIONS", count: 1 }, { code: "UNPAID_WINNERS" }], OPEN: [] }, allowedTransitions: ["COMPLETED", "OPEN"] },
    applications: [{ id: "a1", status: "PENDING", userId: "u1", nickname: "mina", message: "pick me", portfolioUrl: null, reviewNote: null, appliedAt: "2026-10-01T00:00:00Z", reviewedAt: null }],
    submissions: [
      { id: "s1", status: "RESUBMITTED", userId: "u2", nickname: "juho", currentRevisionNo: 3, submittedAt: "2026-10-02T00:00:00Z", reviewedAt: null, payoutAddress: "inj1juho", payoutAddressEvm: null, email: null, reviewComment: null, revisions: [{ revisionNo: 3, submissionUrl: "https://x.test/v3", description: "third", repositoryUrl: null, commitSha: null, createdAt: "2026-10-03T00:00:00Z" }], reviews: [] },
      { id: "s2", status: "APPROVED", userId: "u3", nickname: "ara", currentRevisionNo: 1, submittedAt: "2026-10-02T00:00:00Z", reviewedAt: null, payoutAddress: "inj1ara", payoutAddressEvm: null, email: null, reviewComment: "ok", revisions: [], reviews: [] },
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
  getAdminBounties: vi.fn(),
};

const expirePublicLists = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-helpers", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/admin-helpers")>()), expirePublicLists }));

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  for (const fn of Object.values(adminApi)) fn.mockClear();
  expirePublicLists.mockClear();
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
    fireEvent.click(screen.getByRole("button", { name: "Reopen bounty" }));
    await waitFor(() => expect(adminApi.transitionAdminBounty).toHaveBeenCalledWith("b1", "OPEN"));
  });

  it("expires the cached public lists after a successful action so an opened bounty shows at once, and not after a failed one", async () => {
    await renderOps();
    adminApi.transitionAdminBounty.mockRejectedValueOnce(new ApiHttpError(400, "INVALID_TRANSITION"));
    fireEvent.click(screen.getByRole("button", { name: "Reopen bounty" }));
    await waitFor(() => expect(adminApi.transitionAdminBounty).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(adminApi.getAdminOperations).toHaveBeenCalledTimes(2));
    expect(expirePublicLists).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reopen bounty" }));
    await waitFor(() => expect(expirePublicLists).toHaveBeenCalledWith(["bounties", "hall-of-fame", "members"]));
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
    // A comment of only zero-width characters would reach the submitter as a blank revision request.
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "\u200b\u200b" } });
    fireEvent.submit(form);
    expect(within(dialog()).getByRole("alert").textContent).toBe("Add a comment explaining what needs to change.");
    expect(adminApi.reviewAdminSubmission).not.toHaveBeenCalled();
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "Add tests" } });
    fireEvent.submit(form);
    await waitFor(() => expect(adminApi.reviewAdminSubmission).toHaveBeenCalledWith("s1", { decision: "REQUEST_REVISION", revisionNo: 3, comment: "Add tests" }));
  });

  it("labels a WITHDRAWN submission (the owner left the platform) and offers no review actions for it", async () => {
    const base = operations();
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: [{ ...base.submissions[0], id: "s3", status: "WITHDRAWN", nickname: "gone" }] }));
    await renderOps();
    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("shows an unknown review decision (the reserved REOPEN) as its raw code instead of a missing-message key", async () => {
    const base = operations();
    const reviews = [{ revisionNo: 3, decision: "REOPEN", comment: null, createdAt: "2026-10-05T00:00:00Z" }];
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: [{ ...base.submissions[0], reviews }, base.submissions[1]] }));
    await renderOps();
    expect(screen.getByText(/REOPEN/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("submissions.decisions");
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

  it("closes the cancel confirmation when a re-read shows the cancellation is blocked or no longer allowed", async () => {
    const open = operations({ bounty: { ...operations().bounty, status: "OPEN" }, lifecycle: { blockers: {}, allowedTransitions: ["SUBMISSION_CLOSED", "CANCELLED"] } });
    adminApi.getAdminOperations.mockImplementation(async () => open);
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Cancel bounty" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    adminApi.getAdminOperations.mockImplementation(async () => ({ ...open, lifecycle: { blockers: { CANCELLED: [{ code: "UNPAID_WINNERS" }] }, allowedTransitions: ["SUBMISSION_CLOSED", "CANCELLED"] } }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
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

  it("sends a write once even when the form is submitted again while the re-read after it is still running", async () => {
    const approved = operations({ payouts: [{ ...operations().payouts[0], status: "APPROVED", requestedByMe: false }] });
    adminApi.getAdminOperations.mockImplementation(async () => approved);
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: HASH } });
    const form = within(dialog()).getByRole("button", { name: "Mark paid" }).closest("form")!;
    let finishRead: (value: AdminOperations) => void = () => undefined;
    adminApi.getAdminOperations.mockImplementation(() => new Promise<AdminOperations>((resolve) => { finishRead = resolve; }));
    fireEvent.submit(form);
    await waitFor(() => expect(adminApi.getAdminOperations).toHaveBeenCalledTimes(2));
    // The write succeeded and the dialog is still open until the re-read lands: the second submit must not reach the BE.
    fireEvent.submit(form);
    expect(adminApi.markAdminPayoutPaid).toHaveBeenCalledTimes(1);
    finishRead(operations({ payouts: [{ ...approved.payouts[0], status: "PAID" }] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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

describe("payout request after a re-read", () => {
  it("checks the amount against the reward's current headroom, not the one from when the dialog opened", async () => {
    const reward = operations().rewards[0];
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [], rewards: [{ ...reward, allocated: "0" }] }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
    // Another admin allocates 4 of the 5 INJ while the dialog is open; the next read shows 1 INJ left.
    adminApi.getAdminOperations.mockImplementation(async () => operations({ payouts: [], rewards: [{ ...reward, allocated: "4000000000000000000" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(within(dialog()).getByText("Up to 1 INJ can still be allocated from this reward.")).toBeTruthy());
    fireEvent.change(within(dialog()).getByRole("textbox"), { target: { value: "2" } });
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Request payout" }).closest("form")!);
    expect(within(dialog()).getByRole("alert").textContent).toContain("Only 1 INJ is left");
    expect(adminApi.requestAdminPayout).not.toHaveBeenCalled();
  });
});

describe("payout request without a payout address", () => {
  it("explains the missing payout address instead of sending a request the BE answers with 409 PAYOUT_ADDRESS_NOT_SET", async () => {
    const base = operations();
    adminApi.getAdminOperations.mockImplementation(async () => operations({
      payouts: [], rewards: [{ ...base.rewards[0], allocated: "0" }],
      submissions: [base.submissions[0], { ...base.submissions[1], payoutAddress: null, payoutAddressEvm: null, email: null }],
    }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
    fireEvent.submit(within(dialog()).getByRole("button", { name: "Request payout" }).closest("form")!);
    expect(within(dialog()).getByRole("alert").textContent).toContain("No payout address");
    expect(adminApi.requestAdminPayout).not.toHaveBeenCalled();
  });
});

describe("payout address cell in the submissions table", () => {
  const noAddress = (status: string) => ({ ...operations().submissions[0], id: "sw", status, payoutAddress: null, payoutAddressEvm: null, email: null, nickname: "noaddress" });
  const addressCell = (name: string) => within(screen.getByText(name, { selector: "td *" }).closest("tr") as HTMLElement).getAllByRole("cell")[3];

  it("warns about a missing payout address only on an approved submission of a bounty that pays", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: [noAddress("APPROVED")] }));
    await renderOps();
    expect(addressCell("noaddress").textContent).toContain("No payout address");
  });

  it.each(["SUBMITTED", "REJECTED"])("shows a dash for a %s submission without a payout address", async (status) => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: [noAddress(status)] }));
    await renderOps();
    expect(addressCell("noaddress").textContent).toBe("–");
  });

  it("shows a dash on a bounty with no reward even when approved", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ submissions: [noAddress("APPROVED")], rewards: [] }));
    await renderOps();
    expect(addressCell("noaddress").textContent).toBe("–");
  });
});

describe("winner email and payout address in the submissions table", () => {
  const withWinner = (overrides: object = {}, reward: object = {}) => operations({
    submissions: [{ ...operations().submissions[1], nickname: "ara", email: "ara@example.test", payoutAddress: "inj1" + "q".repeat(38), payoutAddressEvm: "0x" + "ab".repeat(20), ...overrides }],
    rewards: [{ ...operations().rewards[0], ...reward }],
    payouts: [],
  });
  const rowOf = (name: string) => within(screen.getByText(name, { selector: "td *" }).closest("tr") as HTMLElement);

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
  });

  it("shows the winner's email with a copy button that puts it on the clipboard", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => withWinner());
    await renderOps();
    expect(rowOf("ara").getByText("ara@example.test")).toBeTruthy();
    fireEvent.click(rowOf("ara").getByRole("button", { name: "Copy email of ara" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ara@example.test"));
    await waitFor(() => expect(rowOf("ara").getAllByText("Copied").length).toBeGreaterThan(0));
  });

  it("shows no email line when the BE sends none (not approved, or withdrawn)", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => withWinner({ email: null }));
    await renderOps();
    expect(rowOf("ara").queryByRole("button", { name: /Copy email/ })).toBeNull();
  });

  it("emphasizes the inj1 form for an INJ reward and the 0x form for an ERC20 reward, and copies that one", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => withWinner());
    await renderOps();
    const inj = rowOf("ara").getByTitle(/^inj1 /);
    expect(inj.className).toContain("font-semibold");
    fireEvent.click(rowOf("ara").getByRole("button", { name: "Copy payout address of ara" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("inj1" + "q".repeat(38)));
  });

  it("emphasizes and copies the 0x form when the reward is an ERC20 token", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => withWinner({}, { symbol: "USDC", tokenType: "ERC20" }));
    await renderOps();
    const evm = rowOf("ara").getByTitle(/^0x /);
    expect(evm.className).toContain("font-semibold");
    fireEvent.click(rowOf("ara").getByRole("button", { name: "Copy payout address of ara" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("0x" + "ab".repeat(20)));
  });

  it("the payout request dialog shows the 0x form for an ERC20 reward", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => withWinner({}, { symbol: "USDC", tokenType: "ERC20" }));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
    expect(within(dialog()).getByText("0x" + "ab".repeat(20))).toBeTruthy();
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

  describe("?bounty= deep link", () => {
    const rows = [{ slug: "first", title: "First bounty" }, { slug: "second", title: "Second bounty" }] as never[];
    const openWith = (query: string) => {
      window.history.replaceState(null, "", `/admin/operations${query}`);
      adminApi.getAdminBounties.mockResolvedValue(rows);
      adminApi.getAdminOperations.mockClear();
      renderWithIntl(<OperationsConsole bounties={[]} tabs={null}>{null}</OperationsConsole>);
    };

    it("selects the linked bounty", async () => {
      openWith("?bounty=second");
      await waitFor(() => expect(adminApi.getAdminOperations).toHaveBeenCalledWith("second"));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each(["nope", "00000000-0000-4000-8000-000000000000"])("says so and opens no bounty for an unknown id (%s), instead of the first bounty", async (id) => {
      openWith(`?bounty=${id}`);
      expect((await screen.findByRole("alert")).textContent).toContain(`“${id}”`);
      expect(adminApi.getAdminOperations).not.toHaveBeenCalled();
    });

    it("opens the first bounty when there is no link", async () => {
      openWith("");
      await waitFor(() => expect(adminApi.getAdminOperations).toHaveBeenCalledWith("first"));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
