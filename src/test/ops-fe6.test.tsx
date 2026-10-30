// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyOperations } from "@/components/admin/BountyOperations";
import type { AdminOperations } from "@/lib/admin-operations";
import { ApiHttpError } from "@/lib/api/http";
import { renderWithIntl } from "@/test/intl";

function operations(overrides: Partial<AdminOperations> = {}): AdminOperations {
  return {
    bounty: { id: "b1", title: "Widget", status: "SUBMISSION_CLOSED", submissionDeadline: "2099-01-01T00:00:00.000Z", maxWinners: 2, applicationRequired: false },
    lifecycle: { blockers: { OPEN: [] }, allowedTransitions: ["OPEN", "IN_REVIEW"] },
    applications: [],
    submissions: [],
    rewards: [{ id: "r1", status: "DEPOSIT_PENDING", symbol: "INJ", amount: "5000000000000000000", depositedAmount: null, depositedAt: null, depositTxHash: null, custodyAddress: "inj1ms", cap: null, allocated: "0" }],
    payouts: [],
    policy: { payoutSelfApprovalAllowed: false },
    ...overrides,
  };
}

const adminApi = {
  getAdminOperations: vi.fn(async () => operations()),
  confirmAdminDeposit: vi.fn(async () => undefined),
  transitionAdminBounty: vi.fn(async () => undefined),
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

describe("lifecycle reopen label", () => {
  it("labels OPEN from SUBMISSION_CLOSED as Reopen bounty with the deadline note", async () => {
    await renderOps();
    expect(screen.getByRole("button", { name: "Reopen bounty" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open bounty" })).toBeNull();
    expect(screen.getByText("Accepts submissions again. The submission deadline must still be in the future.")).toBeTruthy();
  });

  it("keeps Open bounty when the bounty is not yet published (FUNDING_PENDING)", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ bounty: { ...operations().bounty, status: "FUNDING_PENDING" } }));
    await renderOps();
    expect(screen.getByRole("button", { name: "Open bounty" })).toBeTruthy();
  });
});

describe("unset multisig", () => {
  it("shows the not-configured warning instead of the sentinel address and disables Confirm deposit", async () => {
    adminApi.getAdminOperations.mockImplementation(async () => operations({ rewards: [{ ...operations().rewards[0], custodyAddress: "PENDING_MULTISIG_SETUP" }] }));
    await renderOps();
    expect(screen.queryByText(/PENDING_MULTISIG_SETUP/)).toBeNull();
    expect(screen.getByText(/Multisig address not configured/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirm deposit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps Confirm deposit enabled with a real address", async () => {
    await renderOps();
    expect((screen.getByRole("button", { name: "Confirm deposit" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("BE note rejections", () => {
  it("names hidden characters and the reserved forfeited prefix instead of the generic hint", async () => {
    adminApi.confirmAdminDeposit.mockRejectedValueOnce(new ApiHttpError(400, "VALIDATION_FAILED", ["note must not contain bidirectional override characters"]));
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Confirm deposit" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("0x…"), { target: { value: "0x" + "ab".repeat(32) } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Confirm deposit" }).closest("form")!);
    expect(await screen.findByText("The note contains hidden direction or control characters. Remove them and try again.")).toBeTruthy();
    adminApi.confirmAdminDeposit.mockRejectedValueOnce(new ApiHttpError(400, "VALIDATION_FAILED", ['note must not start with the reserved prefix "forfeited:"']));
    fireEvent.submit(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm deposit" }).closest("form")!);
    expect(await screen.findByText('A note cannot start with "forfeited:" (reserved for the system).')).toBeTruthy();
  });

  it("flags a deposit amount over the 30-digit base-unit limit before sending", async () => {
    await renderOps();
    fireEvent.click(screen.getByRole("button", { name: "Confirm deposit" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("0x…"), { target: { value: "0x" + "ab".repeat(32) } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Deposited amount/ }), { target: { value: "1" + "0".repeat(12) } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Confirm deposit" }).closest("form")!);
    expect(within(dialog).getByRole("alert").textContent).toBe("Use at most 12 digits before the decimal point.");
    expect(adminApi.confirmAdminDeposit).not.toHaveBeenCalled();
  });
});
