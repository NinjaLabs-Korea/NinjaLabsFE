// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BountyOperations } from "@/components/admin/BountyOperations";
import type { AdminOperations } from "@/lib/admin-operations";
import { renderWithIntl } from "@/test/intl";


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
};


vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

function stubViewport(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow, media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  }));
}

afterEach(() => vi.unstubAllGlobals());

const renderOps = async (ops: AdminOperations) => {
  adminApi.getAdminOperations.mockImplementation(async () => ops);
  renderWithIntl(<BountyOperations bountyId="b1" />);
  await screen.findByRole("heading", { name: "Widget" });
};

describe("ops tables: long free text", () => {
  it("keeps a 3000-char application message in a bounded, focusable scroll box", async () => {
    const base = operations();
    const long = "m".repeat(3000);
    await renderOps(operations({ applications: [{ ...base.applications[0], message: long }] }));
    const box = within(screen.getByRole("region", { name: "Applicants" })).getByRole("region", { name: "Message" });
    expect(box.textContent).toBe(long);
    expect(box.className).toContain("max-h-40");
    expect(box.className).toContain("overflow-y-auto");
    expect(box.getAttribute("tabindex")).toBe("0");
  });

  it("keeps an 8000-char submission description in a bounded, focusable scroll box", async () => {
    const base = operations();
    const long = "d".repeat(8000);
    const submission = { ...base.submissions[0], revisions: [{ ...base.submissions[0].revisions[0], description: long }] };
    await renderOps(operations({ submissions: [submission] }));
    const box = screen.getAllByRole("region").find((el) => el.textContent === long);
    expect(box).toBeTruthy();
    expect(box!.className).toContain("max-h-40");
    expect(box!.getAttribute("tabindex")).toBe("0");
  });
});

describe("ops payouts: phone layout", () => {
  beforeEach(() => adminApi.approveAdminPayout.mockClear());

  it("renders each payout as a card with recipient, status, amount and its actions on a narrow viewport", async () => {
    stubViewport(true);
    const base = operations();
    await renderOps(operations({ payouts: [{ ...base.payouts[0], requestedByMe: false }, { ...base.payouts[0], id: "p2", status: "APPROVED", requestedByMe: false }] }));
    const region = within(screen.getByRole("region", { name: "Winner payouts" }));
    expect(region.queryByRole("table")).toBeNull();
    const cards = region.getAllByRole("listitem").filter((li) => li.hasAttribute("data-payout-card"));
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("alpha-bot")).toBeTruthy();
    expect(within(cards[0]).getByText("2 INJ")).toBeTruthy();
    expect(within(cards[0]).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(cards[1]).getByRole("button", { name: "Mark paid" })).toBeTruthy();
  });

  it("keeps the table on a wide viewport", async () => {
    stubViewport(false);
    await renderOps(operations());
    expect(within(screen.getByRole("region", { name: "Winner payouts" })).getByRole("table")).toBeTruthy();
  });
});
