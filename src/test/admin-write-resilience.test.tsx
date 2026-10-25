// @vitest-environment jsdom
// A write that succeeded must not read as failed because the follow-up list re-read failed (the retry would create a
// duplicate), and deleting the record the form is editing must not leave the form pointing at a missing row.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyManager } from "@/components/admin/BountyManager";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { PostManager } from "@/components/admin/PostManager";
import { getAdminBounties, getAdminHighlights, getAdminPosts } from "@/lib/admin";
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
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  api = createMockApiClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const row = (text: string) => screen.getByText(text, { selector: "td" }).closest("tr") as HTMLTableRowElement;
const field = (label: string) => {
  const wrapping = [...document.querySelectorAll("label")].find((node) => node.firstChild?.textContent?.trim() === label);
  const control = wrapping?.querySelector("input, textarea");
  return (control ?? screen.getByLabelText(label)) as HTMLInputElement | HTMLTextAreaElement;
};
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const confirmDelete = () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));

describe("a succeeded write followed by a failed re-read", () => {
  it("bounty create reports success plus a load error, and resets the form so a retry cannot duplicate", async () => {
    const save = vi.spyOn(api, "saveAdminBounty");
    renderWithIntl(<><BountyManager bounties={getAdminBounties()} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
    type("Title", "Fresh bounty");
    type("Sponsor", "Injective");
    type("Deadline", "2099-03-01T12:30");
    type("Description (markdown)", "Body");
    type("Deliverables", "- Repo");
    type("Review process", "Triage");
    vi.spyOn(api, "getAdminBounties").mockRejectedValue(new Error("offline"));
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);

    expect(await screen.findByText("Bounty created")).toBeTruthy();
    expect(await screen.findByText("Could not load admin bounties.")).toBeTruthy();
    expect(screen.queryByText("Save failed")).toBeNull();
    expect(field("Title").value).toBe("");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("notice create reports success plus a load error and resets the form", async () => {
    renderWithIntl(<><PostManager posts={getAdminPosts()} tabs={null}>{null}</PostManager><AdminToastHost /></>);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
    type("Title", "New post");
    type("Body (markdown)", "Hello");
    vi.spyOn(api, "getAdminPosts").mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Post created")).toBeTruthy();
    expect(await screen.findByText("Could not load admin notices.")).toBeTruthy();
    expect(screen.queryByText("Save failed")).toBeNull();
    expect(field("Title").value).toBe("");
  });

  it("highlight create reports success plus a load error and resets the form", async () => {
    renderWithIntl(<><HighlightManager highlights={getAdminHighlights()} /><AdminToastHost /></>);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
    type("Title", "Best tool");
    type("Description", "Body");
    vi.spyOn(api, "getAdminHighlights").mockRejectedValue(new Error("offline"));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

    expect(await screen.findByText("Highlight added")).toBeTruthy();
    expect(await screen.findByText("Could not load highlights.")).toBeTruthy();
    expect(screen.queryByText("Save failed")).toBeNull();
    expect(field("Title").value).toBe("");
  });

  it("a bounty transition that succeeded is not reported as failed when the re-read fails", async () => {
    renderWithIntl(<><BountyManager bounties={getAdminBounties()} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" })).toBeTruthy());
    vi.spyOn(api, "getAdminBounties").mockRejectedValue(new Error("offline"));
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Status updated")).toBeTruthy();
    expect(screen.queryByText("Transition failed")).toBeNull();
  });
});

describe("deleting the record that is open in the form", () => {
  it("bounty: returns to create mode with an empty form", async () => {
    renderWithIntl(<><BountyManager bounties={getAdminBounties()} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
    await waitFor(() => expect(row("Quest copy refresh")).toBeTruthy());
    fireEvent.click(within(row("Quest copy refresh")).getByRole("button", { name: "Edit" }));
    expect(field("Title").value).toBe("Quest copy refresh");
    fireEvent.click(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" }));
    confirmDelete();
    await waitFor(() => expect(screen.queryByText("Quest copy refresh", { selector: "td" })).toBeNull());
    expect(field("Title").value).toBe("");
    expect(screen.getByRole("heading", { name: "Create sponsor-backed work" })).toBeTruthy();
  });

  it("bounty: deleting a different row keeps the edit in progress", async () => {
    renderWithIntl(<><BountyManager bounties={getAdminBounties()} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
    await waitFor(() => expect(row("Quest copy refresh")).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" }));
    fireEvent.click(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" }));
    confirmDelete();
    await waitFor(() => expect(screen.queryByText("Quest copy refresh", { selector: "td" })).toBeNull());
    expect(field("Title").value).toBe("Build an iAsset price widget");
  });

  it("notice: returns to create mode with an empty form", async () => {
    renderWithIntl(<><PostManager posts={getAdminPosts()} tabs={null}>{null}</PostManager><AdminToastHost /></>);
    await waitFor(() => expect(row("Q3 roadmap preview")).toBeTruthy());
    fireEvent.click(within(row("Q3 roadmap preview")).getByRole("button", { name: "Edit" }));
    expect(field("Title").value).toBe("Q3 roadmap preview");
    fireEvent.click(within(row("Q3 roadmap preview")).getByRole("button", { name: "Delete" }));
    confirmDelete();
    await waitFor(() => expect(screen.queryByText("Q3 roadmap preview", { selector: "td" })).toBeNull());
    expect(field("Title").value).toBe("");
    expect(screen.getByRole("heading", { name: "Create community feed post" })).toBeTruthy();
  });

  it("highlight: returns to create mode with an empty form", async () => {
    renderWithIntl(<><HighlightManager highlights={getAdminHighlights()} /><AdminToastHost /></>);
    await waitFor(() => expect(row("Hydro opens content bounties")).toBeTruthy());
    fireEvent.click(within(row("Hydro opens content bounties")).getByRole("button", { name: "Edit" }));
    expect(field("Title").value).toBe("Hydro opens content bounties");
    fireEvent.click(within(row("Hydro opens content bounties")).getByRole("button", { name: "Delete" }));
    confirmDelete();
    await waitFor(() => expect(screen.queryByText("Hydro opens content bounties", { selector: "td" })).toBeNull());
    expect(field("Title").value).toBe("");
  });
});

describe("highlight display order", () => {
  it("blocks a negative or fractional order with a field error instead of a BE 400", async () => {
    const save = vi.spyOn(api, "saveAdminHighlight");
    renderWithIntl(<><HighlightManager highlights={getAdminHighlights()} /><AdminToastHost /></>);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
    type("Title", "Best tool");
    type("Description", "Body");
    type("Display order", "-3");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    const input = field("Display order");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Enter a whole number from 0 up.");
    expect(save).not.toHaveBeenCalled();

    type("Display order", "4");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
});
