// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { UserDirectory } from "@/components/admin/UserDirectory";
import { auditActorKind, isAuditUuid, type AdminAuditLog } from "@/lib/admin-audit";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";

const UUID = "11111111-1111-4111-8111-111111111111";
const log = (n: number, overrides: Partial<AdminAuditLog> = {}): AdminAuditLog => ({
  id: `log-${n}`, actorUserId: "aaaaaaaa-0000-4000-8000-000000000000", actorAgentId: null, action: "PAYOUT_APPROVED", entityType: "payout", entityId: UUID, createdAt: "2026-10-01T09:30:00.000Z", ...overrides,
});

const adminApi = { getAdminAuditLogs: vi.fn(), getAdminUsers: vi.fn() };
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

const render = () => renderWithIntl(<AuditLogViewer tabs={null}><h1>Audit</h1></AuditLogViewer>);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  adminApi.getAdminAuditLogs.mockReset();
  adminApi.getAdminUsers.mockReset();
  adminApi.getAdminAuditLogs.mockImplementation(async (_filter, page: number) => ({ items: [log(page)], page, pageSize: 30, total: 65 }));
});

describe("audit actor classification", () => {
  it("labels script actions when both actors are empty, plus the forfeit script whose actor is the deciding operator", () => {
    expect(auditActorKind(log(1))).toBe("user");
    expect(auditActorKind(log(1, { actorUserId: null, actorAgentId: "ag" }))).toBe("agent");
    expect(auditActorKind(log(1, { actorUserId: null, action: "PAYOUT_CANCELLED_MANUAL" }))).toBe("script");
    expect(auditActorKind(log(1, { actorUserId: null, action: "APPLICATION_REAPPLIED" }))).toBe("unknown");
    // scripts/record-refund.js writes REWARD_REFUNDED with no actor; scripts/forfeit-award.js writes SUBMISSION_AWARD_FORFEITED with one.
    expect(auditActorKind(log(1, { actorUserId: null, action: "REWARD_REFUNDED", entityType: "bounty_reward" }))).toBe("script");
    expect(auditActorKind(log(1, { action: "SUBMISSION_AWARD_FORFEITED", entityType: "bounty_submission" }))).toBe("script");
  });

  it("validates UUIDs", () => {
    expect(isAuditUuid(UUID)).toBe(true);
    expect(isAuditUuid(` ${UUID} `)).toBe(true);
    expect(isAuditUuid("not-a-uuid")).toBe(false);
  });
});

describe("AuditLogViewer", () => {
  it("renders rows with the time in the browser zone and a NULL actor as Ops script", async () => {
    adminApi.getAdminAuditLogs.mockResolvedValue({ items: [log(1), log(2, { actorUserId: null, action: "ADMIN_GRANTED", entityType: "user", entityId: null }), log(3, { actorUserId: null, action: "APPLICATION_REAPPLIED" })], page: 1, pageSize: 30, total: 3 });
    render();
    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("PAYOUT_APPROVED")).toBeTruthy();
    expect(within(rows[1]).getByText(/Oct 1, 2026/)).toBeTruthy();
    expect(within(rows[2]).getByText("Ops script")).toBeTruthy();
    expect(within(rows[3]).getByText("Unknown")).toBeTruthy();
    expect(screen.getByText("3 entries")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Audit log pages" })).toBeNull();
  });

  it("shows the operator id next to the Ops script badge for a script action that has an actor", async () => {
    adminApi.getAdminAuditLogs.mockResolvedValue({ items: [log(1, { action: "SUBMISSION_AWARD_FORFEITED", entityType: "bounty_submission" })], page: 1, pageSize: 30, total: 1 });
    render();
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]).getByText("Ops script")).toBeTruthy();
    expect(within(rows[1]).getByText("aaaaaaaa…0000")).toBeTruthy();
  });

  it("pages with previous / next", async () => {
    render();
    await screen.findByText("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    expect(adminApi.getAdminAuditLogs).toHaveBeenLastCalledWith({}, 2);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Page 1 of 3");
  });

  it("steps back to the page on screen when fetching another page fails, instead of labelling old rows with the new page", async () => {
    render();
    await screen.findByText("Page 1 of 3");
    adminApi.getAdminAuditLogs.mockRejectedValueOnce(new Error("down"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(adminApi.getAdminAuditLogs).toHaveBeenCalledWith({}, 2));
    await waitFor(() => expect(adminApi.getAdminAuditLogs).toHaveBeenLastCalledWith({}, 1));
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(screen.queryByText("Page 2 of 3")).toBeNull();
    // The next click retries page 2 rather than doing nothing.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
  });

  it("refuses a non-UUID entity ID without calling the API, then applies a valid filter from page 1", async () => {
    render();
    await screen.findByText("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    adminApi.getAdminAuditLogs.mockClear();

    fireEvent.change(screen.getByLabelText("Entity ID"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Entity ID must be a UUID.");
    expect(screen.getByLabelText("Entity ID").getAttribute("aria-invalid")).toBe("true");
    expect(adminApi.getAdminAuditLogs).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Entity ID"), { target: { value: ` ${UUID} ` } });
    fireEvent.change(screen.getByLabelText("Entity type"), { target: { value: "payout" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(adminApi.getAdminAuditLogs).toHaveBeenCalledWith({ entityType: "payout", entityId: UUID }, 1));
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(adminApi.getAdminAuditLogs).toHaveBeenLastCalledWith({}, 1));
  });

  it("shows the empty state and the load failure", async () => {
    adminApi.getAdminAuditLogs.mockResolvedValueOnce({ items: [], page: 1, pageSize: 30, total: 0 });
    const { unmount } = render();
    expect(await screen.findByText("No audit log entries match.")).toBeTruthy();
    unmount();
    adminApi.getAdminAuditLogs.mockRejectedValueOnce(new Error("down"));
    renderWithIntl(<AuditLogViewer tabs={null}>{null}</AuditLogViewer>);
    expect((await screen.findAllByText("Could not load the audit log.")).length).toBeGreaterThan(0);
  });
});

describe("mock audit api", () => {
  it("filters, pages and rejects a bad UUID like the BE", async () => {
    const api = createMockApiClient();
    const all = await api.getAdminAuditLogs({}, 1);
    expect(all.total).toBeGreaterThan(0);
    expect((await api.getAdminAuditLogs({ entityType: "user" }, 1)).items.every((item) => item.entityType === "user")).toBe(true);
    expect((await api.getAdminAuditLogs({}, 2)).items).toEqual([]);
    await expect(api.getAdminAuditLogs({ entityId: "x" }, 1)).rejects.toMatchObject({ status: 400 });
  });
});

describe("UserDirectory load more", () => {
  const user = (n: number) => ({ slug: `u${n}`, nickname: `nick${n}`, email: `n${n}@x.test`, joinedAt: "2026-10-01", walletStatus: null, isMember: false, memberRole: null, memberDisplayOrder: null });
  const full = Array.from({ length: 30 }, (_, i) => user(i));

  it("appends the next page and hides the control after a short page", async () => {
    adminApi.getAdminUsers.mockImplementation(async (_q: string | undefined, page?: number) => (page === 2 ? [user(30), user(0)] : full));
    const { container } = renderWithIntl(<UserDirectory users={[]} />);
    const button = await screen.findByText("Load more", {}, { timeout: 4000 });
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText("Load more")).toBeNull());
    expect(adminApi.getAdminUsers).toHaveBeenLastCalledWith("", 2);
    // 30 + 1 new row (the duplicate is dropped) + header. Plain DOM query: role queries over ~32 rows take seconds in jsdom and made this test time out intermittently.
    expect(container.querySelectorAll("tr")).toHaveLength(32);
  }, 20_000);

  it("offers no control when the first page is short", async () => {
    adminApi.getAdminUsers.mockResolvedValue([user(1)]);
    renderWithIntl(<UserDirectory users={[]} />);
    await waitFor(() => expect(screen.getAllByText("nick1").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
