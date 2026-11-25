// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { UserActions } from "@/components/admin/UserActions";
import { SEARCH_DEBOUNCE_MS, UserDirectory } from "@/components/admin/UserDirectory";
import { getAdminUsers as fixtureUsers } from "@/lib/admin";
import { ApiHttpError } from "@/lib/api/http";
import type { AdminApi } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";

let api: AdminApi;
// The signed-in admin: "jaemin" is the fixture's admin row, so it is the row that shows no grant/revoke button.
let selfId = "jaemin";

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAdminApi: () => api,
    useAuthSnapshot: () => ({ status: "signed-in", user: { id: selfId, handle: "me.inj", initials: "ME", profileSlug: "me", isAdmin: true } }),
  }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  selfId = "jaemin";
  api = createMockApiClient();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const row = (nickname: string) => screen.getByText(nickname, { selector: "td" }).closest("tr") as HTMLTableRowElement;
// The action cell also hosts the (closed) dialogs, so it reads as its trigger button's label.
const cells = (nickname: string) => within(row(nickname)).getAllByRole("cell").map((cell, index, all) => (
  index === all.length - 1 ? cell.querySelector("button")?.textContent : cell.textContent
));

function renderDirectory() {
  renderWithIntl(<><UserDirectory users={fixtureUsers()} /><AdminToastHost /></>);
}

describe("UserDirectory", () => {
  it("shows loading, then a retry on a failed first read, never the 'no users match' empty state", async () => {
    const getAdminUsers = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(fixtureUsers()).mockName("getAdminUsers");
    api = { ...createMockApiClient(), getAdminUsers } as AdminApi;
    renderWithIntl(<><UserDirectory users={[]} /><AdminToastHost /></>);
    expect(screen.getByRole("status").textContent).toBe("Loading users…");
    expect(screen.queryByText("No users match your search")).toBeNull();
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("No users match your search")).toBeNull();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1));
  });

  it("renders member/role columns with dashes for missing values", async () => {
    renderDirectory();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1));
    expect(cells("sora")).toEqual(["sora", "sora@example.com", "2026-07-01", "-", "-", "Assign"]);
    expect(cells("jinyoung")).toEqual(["jinyoung", "jinyoung@example.com", "2026-05-03", "Yes", "Core", "Remove"]);
  });

  it("filters by nickname or email case-insensitively and offers a reset from the empty state", () => {
    renderDirectory();
    const search = screen.getByRole("searchbox", { name: "Search users" });
    fireEvent.change(search, { target: { value: "MINA@EXAMPLE" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(row("mina")).toBeTruthy();
    fireEvent.change(search, { target: { value: "jin" } });
    expect(screen.getAllByRole("row").slice(1).map((item) => within(item).getAllByRole("cell")[0].textContent)).toEqual(["jinyoung"]);

    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No users match your search")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset search" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1);
  });

  it("also searches the BE after a pause, so a user beyond the loaded pages shows up without Load more", async () => {
    const beyond = { ...fixtureUsers()[0], slug: "far-away", nickname: "zedmund", email: "zedmund@example.com" };
    const search = vi.spyOn(api, "getAdminUsers");
    renderDirectory();
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    search.mockImplementation(async (query) => (query === "zed" ? [beyond] : []));
    const box = screen.getByRole("searchbox", { name: "Search users" });
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.change(box, { target: { value: "ze" } });
    fireEvent.change(box, { target: { value: " zed " } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1); });
    expect(search).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    vi.useRealTimers();
    expect(await screen.findByText("zedmund", { selector: "td" })).toBeTruthy();
    // One request for the settled term (trimmed); the keystroke in between never left the browser.
    expect(search.mock.calls.slice(1)).toEqual([["zed"]]);

    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByText("zedmund", { selector: "td" })).toBeTruthy();
    // An emptied box never goes to the BE: no request is pending after the debounce either.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2); });
    vi.useRealTimers();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("pages a search with more than one page of matches instead of loading the unfiltered directory", { timeout: 20_000 }, async () => {
    const page = (prefix: string, from: number) => Array.from({ length: 30 }, (_, index) => (
      { ...fixtureUsers()[0], slug: `${prefix}-${from + index}`, nickname: `${prefix}${from + index}`, email: `${prefix}${from + index}@example.com` }
    ));
    const search = vi.spyOn(api, "getAdminUsers").mockImplementation(async (query = "", pageNo = 1) => {
      if (query === "ab") return pageNo === 1 ? page("ab", 0) : pageNo === 2 ? [{ ...page("ab", 30)[0] }] : [];
      return [];
    });
    renderDirectory();
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "ab" } });
    expect(await screen.findByText("ab0", { selector: "td" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("ab30", { selector: "td" })).toBeTruthy();
    // The search term rides along with the page; the short last page ends the paging.
    expect(search).toHaveBeenLastCalledWith("ab", 2);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load more" })).toBeNull());
  });

  it("keeps a search result that landed before a slow first directory read finished", async () => {
    const beyond = { ...fixtureUsers()[0], slug: "far-away", nickname: "zedmund", email: "zedmund@example.com" };
    let finishFirstRead: (users: ReturnType<typeof fixtureUsers>) => void = () => undefined;
    const getAdminUsers = vi.fn(async (query = "") => (
      query === "zed" ? [beyond] : new Promise<ReturnType<typeof fixtureUsers>>((resolve) => { finishFirstRead = resolve; })
    ));
    api = { ...createMockApiClient(), getAdminUsers } as AdminApi;
    renderWithIntl(<><UserDirectory users={[]} /><AdminToastHost /></>);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "zed" } });
    expect(await screen.findByText("zedmund", { selector: "td" })).toBeTruthy();
    finishFirstRead(fixtureUsers());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "" } });
    await waitFor(() => expect(screen.getByText("jinyoung", { selector: "td" })).toBeTruthy());
    // The first page replaced the list, but the user the search found beyond it is still there.
    expect(screen.getByText("zedmund", { selector: "td" })).toBeTruthy();
  });

  it("caps the search box at the BE limit (320 characters) so a pasted long term is not sent as a 400", async () => {
    renderDirectory();
    expect((screen.getByRole("searchbox", { name: "Search users" }) as HTMLInputElement).maxLength).toBe(320);
  });

  it("reports a failed BE search with the load-failed toast and keeps the filtered rows", async () => {
    const search = vi.spyOn(api, "getAdminUsers");
    renderDirectory();
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    search.mockRejectedValue(new Error("down"));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value: "mina" } });
    expect(await screen.findByText("Could not load the admin user directory.")).toBeTruthy();
    expect(row("mina")).toBeTruthy();
  });

  it("assigns a role with a display order through the client and updates the row", async () => {
    const setMember = vi.spyOn(api, "setAdminMember");
    renderDirectory();
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Assign" }));
    const dialog = screen.getByRole("dialog", { name: "Assign member role" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ops" }));
    expect(within(dialog).getByRole("button", { name: "Ops" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Core" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.change(within(dialog).getByLabelText("Display order"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(cells("sora").slice(3, 6)).toEqual(["Yes", "Ops", "Remove"]));
    expect(setMember).toHaveBeenCalledWith("sora", { isMember: true, role: "Ops", displayOrder: 5 });
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(screen.getByText("sora is now visible in the public member directory.")).toBeTruthy();
  });

  it("sends no displayOrder when the field is emptied (automatic order)", async () => {
    const setMember = vi.spyOn(api, "setAdminMember");
    renderDirectory();
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Assign" }));
    const dialog = screen.getByRole("dialog", { name: "Assign member role" });
    fireEvent.change(within(dialog).getByLabelText("Display order"), { target: { value: "  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(setMember).toHaveBeenCalledWith("sora", { isMember: true, role: "Core" }));
  });

  it("removes a member only after the confirm dialog and restores them with Undo", async () => {
    const setMember = vi.spyOn(api, "setAdminMember");
    renderDirectory();
    fireEvent.click(within(row("juho")).getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("alertdialog", { name: "Remove juho from members?" });
    expect(within(dialog).getByText("Members", { selector: "b" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(setMember).not.toHaveBeenCalled();

    fireEvent.click(within(row("juho")).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(cells("juho").slice(3, 6)).toEqual(["-", "-", "Assign"]));
    expect(setMember).toHaveBeenLastCalledWith("juho", { isMember: false });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(cells("juho").slice(3, 6)).toEqual(["Yes", "Dev", "Remove"]));
    // Undo puts back the exact role and display order the member had.
    expect(setMember).toHaveBeenLastCalledWith("juho", { isMember: true, role: "Dev", displayOrder: 2 });
    expect(screen.getByText("juho was restored.")).toBeTruthy();
  });

  it("keeps the row and shows the mapped or fallback copy when assign/remove fail", async () => {
    vi.spyOn(api, "setAdminMember")
      .mockRejectedValueOnce(new ApiHttpError(400, "INVALID_CHARACTER"))
      .mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL"));
    renderDirectory();
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Assign" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Assign member role" })).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("A field contains characters that cannot be saved (for example a NUL byte). Remove them and try again.")).toBeTruthy();
    expect(cells("sora")[3]).toBe("-");

    fireEvent.click(within(row("mina")).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove mina from members?" })).getByRole("button", { name: "Remove member" }));
    expect(await screen.findByText("The member assignment was not changed.")).toBeTruthy();
    expect(cells("mina")[3]).toBe("Yes");
    expect(screen.getAllByText("Update failed")).toHaveLength(2);
  });

  it("reports a failed Undo instead of leaving an unhandled rejection, and keeps the member removed", async () => {
    const setMember = vi.spyOn(api, "setAdminMember");
    renderDirectory();
    fireEvent.click(within(row("juho")).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(cells("juho")[3]).toBe("-"));

    setMember.mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Update failed");
    expect(alert.textContent).toContain("The member assignment was not changed.");
    expect(cells("juho").slice(3, 6)).toEqual(["-", "-", "Assign"]);
    expect(screen.queryByText("juho was restored.")).toBeNull();
  });

  it("shows the load-failed toast when the directory request rejects", async () => {
    vi.spyOn(api, "getAdminUsers").mockRejectedValue(new Error("down"));
    renderDirectory();
    expect(await screen.findByText("Could not load the admin user directory.")).toBeTruthy();
    expect(row("sora")).toBeTruthy();
  });
});

describe("UserActions display order validation", () => {
  const user = { slug: "ninja", nickname: "ninja", isMember: false, memberRole: null, memberDisplayOrder: null };

  it.each(["0", "-1", "1.5", "2147483648"])("rejects %s with an aria-invalid field and a described error, without calling onAssign", (value) => {
    const onAssign = vi.fn();
    renderWithIntl(<UserActions onAssign={onAssign} onRemove={vi.fn()} user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    const input = screen.getByLabelText("Display order");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onAssign).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const error = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(error?.textContent).toBe("Enter a whole number of 1 or more, or leave it empty.");
    expect(screen.getByRole("dialog", { name: "Assign member role" }).hasAttribute("open")).toBe(true);

    // Editing the value clears the error state.
    fireEvent.change(input, { target: { value: "2" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onAssign).toHaveBeenCalledWith("Core", 2);
  });

  it("prefills the member's current role when reopening and closes on Cancel without assigning", () => {
    const onAssign = vi.fn();
    renderWithIntl(<UserActions onAssign={onAssign} onRemove={vi.fn()} user={{ ...user, memberRole: "Design", memberDisplayOrder: 3 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    const dialog = screen.getByRole("dialog", { name: "Assign member role" });
    expect(within(dialog).getByRole("button", { name: "Design" }).getAttribute("aria-pressed")).toBe("true");
    expect((within(dialog).getByLabelText("Display order") as HTMLInputElement).value).toBe("3");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(onAssign).not.toHaveBeenCalled();
  });
});

describe("UserDirectory admin access", () => {
  it("badges admin rows, offers grant on others and no button on the signed-in admin's own row (a note instead)", async () => {
    renderDirectory();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1));
    expect(within(row("jaemin")).getByText("Admin")).toBeTruthy();
    expect(within(row("sora")).queryByText("Admin")).toBeNull();
    expect(within(row("jaemin")).queryByRole("button", { name: /admin/i })).toBeNull();
    expect(within(row("jaemin")).getByText("You")).toBeTruthy();
    expect(within(row("sora")).getByRole("button", { name: "Grant admin" })).toBeTruthy();
  });

  it("offers no admin action when the BE sends no is_admin (older BE)", async () => {
    api = { ...createMockApiClient(), getAdminUsers: async () => fixtureUsers().map((user) => { const copy = { ...user }; delete copy.isAdmin; return copy; }) } as AdminApi;
    renderDirectory();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1));
    expect(screen.queryByRole("button", { name: /admin/i })).toBeNull();
    expect(screen.queryByText("You")).toBeNull();
  });

  it("grants only after the confirm dialog, then shows the badge, a toast and re-reads the list", async () => {
    const setAccess = vi.spyOn(api, "setAdminAccess");
    const list = vi.spyOn(api, "getAdminUsers");
    renderDirectory();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Grant admin" }));
    const dialog = screen.getByRole("dialog", { name: "Grant admin access to sora?" });
    expect(within(dialog).getByText(/payout approval/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(setAccess).not.toHaveBeenCalled();

    fireEvent.click(within(row("sora")).getByRole("button", { name: "Grant admin" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /Grant admin access/ })).getByRole("button", { name: "Grant admin" }));
    expect(await screen.findByText("sora is now an admin.")).toBeTruthy();
    expect(setAccess).toHaveBeenCalledExactlyOnceWith("sora", true);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(within(row("sora")).getByText("Admin")).toBeTruthy();
    expect(within(row("sora")).getByRole("button", { name: "Revoke admin" })).toBeTruthy();
  });

  it("revokes through the destructive dialog and drops the badge", async () => {
    await api.setAdminAccess("sora", true);
    const setAccess = vi.spyOn(api, "setAdminAccess");
    renderDirectory();
    await waitFor(() => expect(within(row("sora")).getByText("Admin")).toBeTruthy());
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Revoke admin" }));
    const dialog = screen.getByRole("alertdialog", { name: "Revoke admin access from sora?" });
    expect(within(dialog).getByText(/loses access to the admin console immediately/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke admin" }));
    expect(await screen.findByText("sora is no longer an admin.")).toBeTruthy();
    expect(setAccess).toHaveBeenCalledExactlyOnceWith("sora", false);
    await waitFor(() => expect(within(row("sora")).queryByText("Admin")).toBeNull());
  });

  it.each([
    [new ApiHttpError(403, "ADMIN_SELF_CHANGE"), "You cannot change your own admin access. Ask another admin."],
    [new ApiHttpError(404, "USER_NOT_FOUND"), "This user no longer exists or has withdrawn. Reload the page to refresh the list."],
    [new ApiHttpError(409, "USER_NOT_ACTIVE"), "This account is suspended or withdrawn, so admin access cannot be granted."],
    [new ApiHttpError(409, "PROFILE_REQUIRED"), "This user has not finished signing up yet, so admin access cannot be granted. Try again after they complete onboarding."],
    [new ApiHttpError(409, "LAST_ADMIN"), "This is the last active admin. Grant admin access to someone else before revoking this one."],
    [new ApiHttpError(500, "INTERNAL"), "The admin access was not changed. Try again."],
    [new TypeError("fetch failed"), "The admin access was not changed. Try again."],
  ])("maps a failed grant (%s) to its copy and keeps the row", async (error, copy) => {
    vi.spyOn(api, "setAdminAccess").mockRejectedValue(error);
    renderDirectory();
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Grant admin" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /Grant admin access/ })).getByRole("button", { name: "Grant admin" }));
    expect(await screen.findByText(copy)).toBeTruthy();
    expect(screen.getByText("Admin change failed")).toBeTruthy();
    expect(within(row("sora")).queryByText("Admin")).toBeNull();
  });

  it("blocks a second request for the same row while one is in flight", async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const original = api.setAdminAccess.bind(api);
    const setAccess = vi.spyOn(api, "setAdminAccess").mockImplementation(async (userId, isAdmin) => { await gate; return original(userId, isAdmin); });
    renderDirectory();
    fireEvent.click(within(row("sora")).getByRole("button", { name: "Grant admin" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: /Grant admin access/ })).getByRole("button", { name: "Grant admin" }));
    await waitFor(() => expect((within(row("sora")).getByRole("button", { name: "Grant admin" }) as HTMLButtonElement).disabled).toBe(true));
    expect(setAccess).toHaveBeenCalledTimes(1);
    // Another row stays usable.
    expect((within(row("mina")).getByRole("button", { name: "Grant admin" }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { finish(); });
    await waitFor(() => expect(within(row("sora")).getByRole("button", { name: "Revoke admin" })).toBeTruthy());
  });
});
