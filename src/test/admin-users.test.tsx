// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { UserActions } from "@/components/admin/UserActions";
import { UserDirectory } from "@/components/admin/UserDirectory";
import { getAdminUsers as fixtureUsers } from "@/lib/admin";
import { ApiHttpError } from "@/lib/api/http";
import type { AdminApi } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";

let api: AdminApi;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAdminApi: () => api,
  }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  api = createMockApiClient();
});

afterEach(() => {
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

  it("renders wallet/member/role columns with dashes for missing values", async () => {
    renderDirectory();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(fixtureUsers().length + 1));
    expect(cells("sora")).toEqual(["sora", "sora@example.com", "2026-07-01", "-", "-", "-", "Assign"]);
    expect(cells("jinyoung")).toEqual(["jinyoung", "jinyoung@example.com", "2026-05-03", "Linked", "Yes", "Core", "Remove"]);
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
    fireEvent.change(box, { target: { value: "ze" } });
    fireEvent.change(box, { target: { value: " zed " } });
    expect(await screen.findByText("zedmund", { selector: "td" })).toBeTruthy();
    // One request for the settled term (trimmed); the keystroke in between never left the browser.
    expect(search.mock.calls.slice(1)).toEqual([["zed"]]);

    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByText("zedmund", { selector: "td" })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(search).toHaveBeenCalledTimes(2);
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

    await waitFor(() => expect(cells("sora").slice(4, 7)).toEqual(["Yes", "Ops", "Remove"]));
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
    await waitFor(() => expect(cells("juho").slice(4, 7)).toEqual(["-", "-", "Assign"]));
    expect(setMember).toHaveBeenLastCalledWith("juho", { isMember: false });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(cells("juho").slice(4, 7)).toEqual(["Yes", "Dev", "Remove"]));
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
    expect(cells("sora")[4]).toBe("-");

    fireEvent.click(within(row("mina")).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove mina from members?" })).getByRole("button", { name: "Remove member" }));
    expect(await screen.findByText("The member assignment was not changed.")).toBeTruthy();
    expect(cells("mina")[4]).toBe("Yes");
    expect(screen.getAllByText("Update failed")).toHaveLength(2);
  });

  it("reports a failed Undo instead of leaving an unhandled rejection, and keeps the member removed", async () => {
    const setMember = vi.spyOn(api, "setAdminMember");
    renderDirectory();
    fireEvent.click(within(row("juho")).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(cells("juho")[4]).toBe("-"));

    setMember.mockRejectedValueOnce(new ApiHttpError(500, "INTERNAL"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Update failed");
    expect(alert.textContent).toContain("The member assignment was not changed.");
    expect(cells("juho").slice(4, 7)).toEqual(["-", "-", "Assign"]);
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
