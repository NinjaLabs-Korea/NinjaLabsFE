// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyOperations } from "@/components/admin/BountyOperations";
import { opsInput, opsTextarea } from "@/components/admin/ops-ui";
import type { AdminOperations } from "@/lib/admin-operations";
import { renderWithIntl } from "@/test/intl";

const LONG = "n".repeat(36);

function operations(): AdminOperations {
  const base = { status: "APPROVED", kind: "USER", agentId: null, agentName: null, currentRevisionNo: 1, submittedAt: "2026-10-02T00:00:00Z", reviewedAt: null, reviewComment: null, revisions: [], reviews: [] };
  return {
    bounty: { id: "b1", title: "Widget", status: "IN_REVIEW", submissionDeadline: "2099-01-01T00:00:00.000Z", maxWinners: 2, applicationRequired: true },
    lifecycle: { blockers: { COMPLETED: [], OPEN: [] }, allowedTransitions: [] },
    applications: [],
    submissions: [
      { ...base, id: "s1", userId: "u1", nickname: LONG, recipientWalletAddress: null },
      { ...base, id: "s2", userId: "u2", nickname: "mina", recipientWalletAddress: "inj1mina" },
    ],
    rewards: [{ id: "r1", status: "FUNDED", symbol: "INJ", amount: "5000000000000000000", depositedAmount: "5000000000000000000", depositedAt: null, depositTxHash: null, custodyAddress: "inj1ms", cap: "5000000000000000000", allocated: "0" }],
    payouts: [],
    policy: { payoutSelfApprovalAllowed: false },
  } as unknown as AdminOperations;
}

const adminApi = { getAdminOperations: vi.fn(async () => operations()), requestAdminPayout: vi.fn(async () => undefined) };
vi.mock("@/components/auth/FoundationProvider", async () => (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});
beforeEach(() => {
  adminApi.getAdminOperations.mockImplementation(async () => operations());
});

async function openDialog() {
  renderWithIntl(<><BountyOperations bountyId="b1" /><AdminToastHost /></>);
  await screen.findByRole("heading", { name: "Widget" });
  fireEvent.click(screen.getByRole("button", { name: "Request payout" }));
  return screen.getByRole("dialog");
}

describe("payout request dialog", () => {
  it("preselects the first candidate that has a wallet", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByRole("combobox").textContent).toContain("mina");
  });

  it("shows the wallet and amount errors together", async () => {
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "abc" } });
    fireEvent.click(within(dialog).getByRole("combobox"));
    fireEvent.mouseDown(within(dialog).getByRole("option", { name: new RegExp(LONG) }));
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(within(dialog).getAllByRole("alert").length).toBe(2));
    expect(adminApi.requestAdminPayout).not.toHaveBeenCalled();
  });

  it("keeps the select inside the dialog width", async () => {
    const dialog = await openDialog();
    const wrapper = within(dialog).getByRole("combobox").parentElement!.parentElement!;
    expect(wrapper.className).toContain("w-full");
    expect(wrapper.className).toContain("min-w-0");
    expect(wrapper.className).not.toContain("w-fit");
  });
});

describe("ops field focus ring", () => {
  it("keeps a visible focus ring on inputs and textareas", () => {
    for (const cls of [opsInput, opsTextarea]) {
      expect(cls).toContain("focus-visible:outline-solid");
      expect(cls).not.toMatch(/(^|\s)outline-none/);
    }
  });

  it("gives the users search the same ring", () => {
    const src = readFileSync("src/components/admin/UserDirectory.tsx", "utf8");
    const line = src.split("\n").find((l) => l.includes("sm:w-[384px]"))!;
    expect(line).toContain("focus-visible:outline-solid");
    expect(line).not.toContain("outline-none");
  });
});
