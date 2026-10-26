// @vitest-environment jsdom
// End-to-end manager flows against the in-memory mock admin client (the same client mock mode ships), so a create,
// transition or delete has to round-trip through the client and re-render from what it returns.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyManager } from "@/components/admin/BountyManager";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { PostManager } from "@/components/admin/PostManager";
import { getAdminBounties, getAdminHighlights, getAdminPosts } from "@/lib/admin";
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
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  api = createMockApiClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const row = (text: string) => screen.getByText(text, { selector: "td" }).closest("tr") as HTMLTableRowElement;
// Labels wrap their error/hint text, so find the wrapping <label> by its leading text node (aria-label inputs fall back).
const field = (label: string) => {
  const wrapping = [...document.querySelectorAll("label")].find((node) => node.firstChild?.textContent?.trim() === label);
  const control = wrapping?.querySelector("input, textarea");
  return (control ?? screen.getByLabelText(label)) as HTMLInputElement | HTMLTextAreaElement;
};
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const errorFor = (input: HTMLElement) => document.getElementById(input.getAttribute("aria-describedby")?.split(" ")[0] ?? "")?.textContent;
const pick = (combobox: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: combobox }));
  fireEvent.mouseDown(screen.getByRole("option", { name: option }));
};

function renderBounties() {
  const bounties = getAdminBounties();
  renderWithIntl(<><BountyManager bounties={bounties} tabs={null}>{null}</BountyManager><AdminToastHost /></>);
  return bounties;
}

describe("BountyManager flows", () => {
  it("renders one row per bounty with localized status, intake, mode and reward", async () => {
    const bounties = renderBounties();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(bounties.length + 1));
    const widget = within(row("Build an iAsset price widget"));
    expect(widget.getByText("Active")).toBeTruthy();
    expect(widget.getByText("OFF")).toBeTruthy();
    expect(widget.getByText("Direct")).toBeTruthy();
    expect(widget.getByText(/500/)).toBeTruthy();
    // Only draft/funding/active rows offer a transition button; active closes, reviewing/closed have none.
    expect(widget.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(within(row("Design wallet onboarding states")).queryByRole("button", { name: /^(Open|Close)$/ })).toBeNull();
    expect(within(row("Quest copy refresh")).getByText("Completed")).toBeTruthy();
  });

  it("blocks an empty create with per-field messages wired through aria-invalid/aria-describedby and a summary toast", async () => {
    const save = vi.spyOn(api, "saveAdminBounty");
    renderBounties();
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);

    for (const label of ["Title", "Sponsor", "Deadline", "Description (markdown)", "Review process"]) {
      const input = field(label);
      expect(input.getAttribute("aria-invalid"), label).toBe("true");
      expect(errorFor(input), label).toBe("This field is required.");
    }
    expect(errorFor(field("Deliverables"))).toBe("Add at least one deliverable or a submission guide.");
    // Optional reward stays valid when empty.
    expect(field("Reward amount").getAttribute("aria-invalid")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Fix the highlighted fields before saving."));
    expect(save).not.toHaveBeenCalled();

    // Typing into a field clears only its own error; filling the submission guide also clears the deliverables error.
    type("Title", "Fresh");
    expect(field("Title").getAttribute("aria-invalid")).toBeNull();
    expect(field("Sponsor").getAttribute("aria-invalid")).toBe("true");
    type("Submission guide / evaluation criteria", "Check the repo");
    expect(field("Deliverables").getAttribute("aria-invalid")).toBeNull();
  });

  it("rejects a past deadline and a non-positive reward on create", async () => {
    renderBounties();
    type("Title", "Fresh");
    type("Sponsor", "Injective");
    type("Deadline", "2020-01-01T10:00");
    type("Reward amount", "0");
    type("Description (markdown)", "Body");
    type("Deliverables", "- Repo");
    type("Review process", "Triage");
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);
    expect(errorFor(field("Deadline"))).toBe("Choose a deadline in the future.");
    expect(errorFor(field("Reward amount"))).toBe("Enter an amount greater than 0 with no more decimals than the token supports (USDC 6, INJ 18), or leave it empty for a draft.");
    expect(field("Title").getAttribute("aria-invalid")).toBeNull();
  });

  it("creates a funding bounty through the client, lists it, and resets the form to create mode", async () => {
    const save = vi.spyOn(api, "saveAdminBounty");
    const bounties = renderBounties();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(bounties.length + 1));
    type("Title", "  Fresh bounty  ");
    type("Sponsor", "Injective");
    type("Deadline", "2099-03-01T12:30");
    type("Reward amount", "42");
    pick("Reward token", "USDC");
    pick("Submission mode", "Agent");
    type("Description (markdown)", "Body");
    type("Deliverables", "  - Repo  \n\n  - Demo ");
    type("Review process", "Triage");
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(bounties.length + 2));
    const [record, create] = save.mock.calls[0];
    expect(create).toBe(true);
    expect(record).toMatchObject({
      slug: "", title: "Fresh bounty", reward: { amount: 42, currency: "USDC" }, submissionMode: "agent", status: "funding",
      deadline: new Date("2099-03-01T12:30").toISOString(), requirements: "- Repo\n- Demo", maxWinners: 1, coverImage: null, tags: ["Dev"],
    });
    const created = within(row("Fresh bounty"));
    expect(created.getByText("Funding")).toBeTruthy();
    expect(created.getByText("Agent")).toBeTruthy();
    expect(created.getByRole("button", { name: "Open" })).toBeTruthy();
    expect(document.querySelector("[aria-live=polite]")?.textContent).toMatch(/^Bounty created\. "\s*Fresh bounty\s*" was saved\.$/);
    expect(screen.getByText("Bounty created")).toBeTruthy();
    expect(field("Title").value).toBe("");
    expect(screen.getByRole("heading", { name: "Create sponsor-backed work" })).toBeTruthy();
  });

  it("edits a loaded bounty in edit mode, keeping its slug/status/maxWinners and showing the updated row", async () => {
    const save = vi.spyOn(api, "saveAdminBounty");
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit bounty" })).toBeTruthy();
    expect(field("Title").value).toBe("Build an iAsset price widget");
    expect(field("Reward amount").value).toBe("500");
    type("Title", "Renamed widget");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("Renamed widget")).toBeTruthy());
    const [record, create] = save.mock.calls[0];
    expect(create).toBe(false);
    // Past fixture deadline is untouched, so it is not re-validated and goes back byte-identical.
    expect(record).toMatchObject({ slug: "iasset-price-widget", status: "active", deadline: "2026-07-14T23:59:00.000Z" });
    expect(screen.queryByText("Build an iAsset price widget")).toBeNull();
    expect(screen.getByText("Bounty updated")).toBeTruthy();
  });

  it("uploads a picked cover file and saves the URL the upload returned", async () => {
    const upload = vi.spyOn(api, "uploadAdminMedia").mockResolvedValue({ id: "m1", url: "/media/22222222-2222-4222-8222-222222222222" });
    const save = vi.spyOn(api, "saveAdminBounty");
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" }));
    const file = new File(["x"], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Cover image"), { target: { files: [file] } });
    expect(screen.getByText("cover.png")).toBeTruthy();
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledWith(file);
    expect(save.mock.calls[0][0].coverImage).toBe("/media/22222222-2222-4222-8222-222222222222");
  });

  it("opens an active bounty's close transition and re-renders the status the client reports", async () => {
    const transition = vi.spyOn(api, "transitionAdminBounty");
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByText("Submissions closed")).toBeTruthy());
    expect(transition).toHaveBeenCalledWith("iasset-price-widget", "SUBMISSION_CLOSED");
    expect(screen.getByText("Build an iAsset price widget is now submission closed.")).toBeTruthy();
  });

  it("maps a transition failure to the generic copy, or the mapped BE code when there is one", async () => {
    vi.spyOn(api, "transitionAdminBounty")
      .mockRejectedValueOnce(new ApiHttpError(409, "INVALID_TRANSITION"))
      .mockRejectedValueOnce(new ApiHttpError(404, "BOUNTY_NOT_FOUND"));
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("This status transition is not currently allowed.")).toBeTruthy();
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" }));
    expect(await screen.findByText("The bounty no longer exists. Reload the page to refresh the list.")).toBeTruthy();
    expect(screen.getAllByText("Transition failed")).toHaveLength(2);
    expect(within(row("Build an iAsset price widget")).getByText("Active")).toBeTruthy();
  });

  it("points a blocked transition (BE 400 with a blocker list) at Operations instead of the generic copy", async () => {
    vi.spyOn(api, "transitionAdminBounty").mockRejectedValueOnce(new ApiHttpError(400, "VALIDATION_FAILED"));
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Close" }));
    expect(await screen.findByText(/Open Operations for this bounty/)).toBeTruthy();
  });

  it("deletes only after the destructive confirm dialog, and cancel returns focus to the opener", async () => {
    const remove = vi.spyOn(api, "deleteAdminBounty");
    renderBounties();
    await waitFor(() => expect(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" })).toBeTruthy());
    const opener = within(row("Quest copy refresh")).getByRole("button", { name: "Delete" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("alertdialog", { name: "Delete Quest copy refresh?" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")?.textContent)
      .toBe("This removes the record from the platform. Public pages update immediately.");
    expect(within(dialog).getByText("This cannot be undone.")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Quest copy refresh", { selector: "td" })).toBeNull());
    expect(remove).toHaveBeenCalledWith("quest-copy-refresh");
    expect(screen.getByText("Bounty deleted")).toBeTruthy();
  });

  it("sends one DELETE and one success toast when the confirm button is clicked several times in the same tick", async () => {
    const remove = vi.spyOn(api, "deleteAdminBounty").mockResolvedValue(undefined);
    renderBounties();
    await waitFor(() => expect(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" })).toBeTruthy());
    fireEvent.click(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" }));
    const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" });
    // One batched tick (what an automated or double click does): React has not re-rendered the closed dialog in between.
    await act(async () => {
      confirm.click();
      confirm.click();
      confirm.click();
    });
    await waitFor(() => expect(screen.getByText("Bounty deleted")).toBeTruthy());
    expect(remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Delete failed")).toBeNull();
  });

  it("keeps the row and shows the mapped copy when the delete fails", async () => {
    vi.spyOn(api, "deleteAdminBounty").mockRejectedValue(new ApiHttpError(404, "BOUNTY_NOT_FOUND"));
    renderBounties();
    await waitFor(() => expect(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" })).toBeTruthy());
    fireEvent.click(within(row("Quest copy refresh")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Delete failed");
    expect(alert.textContent).toContain("The bounty no longer exists. Reload the page to refresh the list.");
    expect(row("Quest copy refresh")).toBeTruthy();
  });

  it("falls back to the generic save copy for an unmapped BE error", async () => {
    vi.spyOn(api, "saveAdminBounty").mockRejectedValue(new ApiHttpError(400, "VALIDATION_FAILED"));
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    expect(await screen.findByText("The bounty was not saved. Check the fields and your admin permissions.")).toBeTruthy();
    // The form stays in edit mode with the admin's input so they can retry.
    expect(screen.getByRole("heading", { name: "Edit bounty" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the load-failed toast when the client list call rejects, keeping the server-rendered rows", async () => {
    vi.spyOn(api, "getAdminBounties").mockRejectedValue(new Error("down"));
    renderBounties();
    expect(await screen.findByText("Could not load admin bounties.")).toBeTruthy();
    expect(row("Build an iAsset price widget")).toBeTruthy();
  });

  it("renders an unparseable deadline as a dash instead of Invalid Date", async () => {
    const [first] = getAdminBounties();
    const broken = { ...first, deadline: "07.14" };
    vi.spyOn(api, "getAdminBounties").mockResolvedValue([broken]);
    renderWithIntl(<BountyManager bounties={[broken]} tabs={null}>{null}</BountyManager>);
    const cells = within(row(first.title)).getAllByRole("cell");
    expect(cells[5].textContent).toBe("–");
    expect(screen.queryByText(/Invalid/)).toBeNull();
  });

  it("flags a stored non-ISO deadline as invalid on edit instead of silently saving it", async () => {
    const [first] = getAdminBounties();
    const broken = { ...first, deadline: "07.14" };
    vi.spyOn(api, "getAdminBounties").mockResolvedValue([broken]);
    const save = vi.spyOn(api, "saveAdminBounty");
    renderWithIntl(<BountyManager bounties={[broken]} tabs={null}>{null}</BountyManager>);
    fireEvent.click(within(row(first.title)).getByRole("button", { name: "Edit" }));
    expect(field("Deadline").value).toBe("");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    expect(errorFor(field("Deadline"))).toBe("Enter a valid date and time.");
    expect(save).not.toHaveBeenCalled();
  });

  it("shows the reward contract as a shortened EVM address with the full value in the title", () => {
    const [first] = getAdminBounties();
    const evm = { ...first, rewardContractAddress: "0x1234567890abcdef1234567890abcdef12345678", rewardChainId: 1776 };
    vi.spyOn(api, "getAdminBounties").mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<BountyManager bounties={[evm]} tabs={null}>{null}</BountyManager>);
    const address = screen.getByText("EVM 1776 · 0x1234…5678");
    expect(address.getAttribute("title")).toBe(evm.rewardContractAddress);
  });

  it("returns to create mode from an edit via + New Bounty", async () => {
    renderBounties();
    await waitFor(() => expect(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" })).toBeTruthy());
    fireEvent.click(within(row("Build an iAsset price widget")).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "+ New Bounty" }));
    expect(screen.getByRole("heading", { name: "Create sponsor-backed work" })).toBeTruthy();
    expect(field("Title").value).toBe("");
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });
});

describe("HighlightManager flows", () => {
  function renderHighlights() {
    renderWithIntl(<><HighlightManager highlights={getAdminHighlights()} /><AdminToastHost /></>);
  }

  it("lists highlights sorted by order with localized type labels and the link or a dash", async () => {
    renderWithIntl(<HighlightManager highlights={[...getAdminHighlights()].reverse()} />);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((item) => within(item).getAllByRole("cell")[2].textContent)).toEqual(["1", "2", "3"]);
    expect(within(rows[0]).getByText("Milestone")).toBeTruthy();
    expect(within(rows[1]).getByText("Featured bounty")).toBeTruthy();
    expect(within(rows[1]).getByText("/bounties/helix-volume-analytics")).toBeTruthy();
    expect(within(rows[0]).getAllByRole("cell")[3].textContent).toBe("–");
    expect(within(rows[0]).getByText("Published")).toBeTruthy();
  });

  it("shows required and URL errors with role=alert, aria-invalid and the hint kept in aria-describedby", async () => {
    const save = vi.spyOn(api, "saveAdminHighlight");
    renderHighlights();
    type("Link", "javascript:alert(1)");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    const title = field("Title");
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(errorFor(title)).toBe("This field is required.");
    expect(errorFor(field("Description"))).toBe("This field is required.");
    const link = field("Link");
    expect(link.getAttribute("aria-describedby")).toBe("highlight-link-error highlight-link-hint");
    expect(errorFor(link)).toBe("Enter an http(s) URL (or an allowed site path).");
    expect(screen.getAllByRole("alert").map((node) => node.textContent)).toEqual(expect.arrayContaining([
      "This field is required.", "Enter an http(s) URL (or an allowed site path).",
    ]));
    expect(await screen.findByText("Fix the highlighted fields before saving.")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();

    type("Link", "/bounties/12");
    expect(field("Link").getAttribute("aria-invalid")).toBeNull();
    expect(field("Link").getAttribute("aria-describedby")).toBe("highlight-link-hint");
  });

  it("creates a highlight with trimmed fields and the display order, and lists it", async () => {
    const save = vi.spyOn(api, "saveAdminHighlight");
    renderHighlights();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    pick("Type", "Award");
    type("Title", "  Best tool  ");
    type("Description", " Body ");
    type("Link", " https://example.test/x ");
    type("Display order", "7");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(5));
    const [record, create, options] = save.mock.calls[0];
    expect(create).toBe(true);
    expect(record).toMatchObject({ type: "AWARD", title: "Best tool", description: "Body", link: "https://example.test/x", order: 7, published: true, image: null });
    expect(options).toEqual({ publish: true, typeChanged: false });
    const created = within(row("Best tool"));
    expect(created.getByText("Award")).toBeTruthy();
    expect(created.getByText("7")).toBeTruthy();
    expect(screen.getByText("Highlight added")).toBeTruthy();
    expect(field("Title").value).toBe("");
  });

  it("deletes after confirming and maps a delete failure to its copy", async () => {
    const remove = vi.spyOn(api, "deleteAdminHighlight");
    renderHighlights();
    await waitFor(() => expect(row("Hydro opens content bounties")).toBeTruthy());
    fireEvent.click(within(row("Hydro opens content bounties")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete Hydro opens content bounties?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Hydro opens content bounties", { selector: "td" })).toBeNull());
    expect(remove).toHaveBeenCalledWith("highlight-3");
    expect(screen.getByText("Highlight deleted")).toBeTruthy();

    remove.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(within(row("100th builder onboarded")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("The highlight was not deleted.")).toBeTruthy();
    expect(row("100th builder onboarded")).toBeTruthy();
  });

  it("lets the image picker button open the hidden file input and shows the picked file name", () => {
    renderWithIntl(<HighlightManager highlights={[]} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [new File(["x"], "hall.webp", { type: "image/webp" })] } });
    expect(screen.getByText("hall.webp")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByText("hall.webp")).toBeNull();
    expect(screen.getByText("JPEG, PNG, or WebP up to 5 MB")).toBeTruthy();
  });
});

describe("PostManager flows", () => {
  function renderPosts() {
    renderWithIntl(<><PostManager posts={getAdminPosts()} tabs={null}>{null}</PostManager><AdminToastHost /></>);
  }

  it("lists posts with localized category, status badge and the published date or a dash", async () => {
    renderPosts();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(getAdminPosts().length + 1));
    const draft = within(row("Q3 roadmap preview"));
    expect(draft.getByText("Draft")).toBeTruthy();
    expect(draft.getAllByRole("cell")[3].textContent).toBe("–");
    const event = within(row("Community review call for July bounty sponsors"));
    expect(event.getByText("Events")).toBeTruthy();
    expect(event.getByText("Published")).toBeTruthy();
  });

  it("blocks a save with empty title/body and a non-http external link", async () => {
    const save = vi.spyOn(api, "saveAdminPost");
    renderPosts();
    type("External link (optional)", "ftp://example.test");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(errorFor(field("Title"))).toBe("This field is required.");
    expect(errorFor(field("Body (markdown)"))).toBe("This field is required.");
    const link = field("External link (optional)");
    expect(link.getAttribute("aria-invalid")).toBe("true");
    expect(link.getAttribute("aria-describedby")).toBe("post-externalUrl-error post-externalUrl-hint");
    expect(errorFor(link)).toBe("Enter an http(s) URL (or an allowed site path).");
    expect(save).not.toHaveBeenCalled();
  });

  it("creates a published post with publish: true and a null external link, then lists it", async () => {
    const save = vi.spyOn(api, "saveAdminPost");
    renderPosts();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(getAdminPosts().length + 1));
    type("Title", "  New post ");
    type("Body (markdown)", "Hello");
    pick("Category", "Recruitment");
    pick("Status", "Published");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(getAdminPosts().length + 2));
    const [post, create, options] = save.mock.calls[0];
    expect(create).toBe(true);
    expect(post).toMatchObject({ slug: "", title: "New post", category: "Recruitment", status: "published", externalUrl: null, thumbnail: null });
    expect(options).toEqual({ publish: true });
    const created = within(row("New post"));
    expect(created.getByText("Recruitment")).toBeTruthy();
    expect(created.getByText("Published")).toBeTruthy();
    expect(screen.getByText("Post created")).toBeTruthy();
  });

  it("omits publish on a plain edit and sends publish: false when unpublishing", async () => {
    const save = vi.spyOn(api, "saveAdminPost");
    renderPosts();
    const title = "Ninja Labs joins the Injective builder hackathon";
    await waitFor(() => expect(row(title)).toBeTruthy());
    fireEvent.click(within(row(title)).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit post" })).toBeTruthy();
    type("Body (markdown)", "Edited body");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][2]).toBeUndefined();
    // Plain edit keeps the stored published date.
    await waitFor(() => expect(within(row(title)).getAllByRole("cell")[3].textContent).toBe("2026.06.20"));

    fireEvent.click(within(row(title)).getByRole("button", { name: "Edit" }));
    pick("Status", "Draft");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][2]).toEqual({ publish: false });
    await waitFor(() => expect(within(row(title)).getByText("Draft")).toBeTruthy());
    expect(screen.getAllByText("Post updated").length).toBeGreaterThan(0);
  });

  it("deletes after confirming, and maps a save failure code to its copy", async () => {
    renderPosts();
    await waitFor(() => expect(row("Q3 roadmap preview")).toBeTruthy());
    fireEvent.click(within(row("Q3 roadmap preview")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete Q3 roadmap preview?" })).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Q3 roadmap preview", { selector: "td" })).toBeNull());
    expect(screen.getByText("Post deleted")).toBeTruthy();

    vi.spyOn(api, "saveAdminPost").mockRejectedValue(new ApiHttpError(400, "INVALID_CHARACTER"));
    type("Title", "Bad");
    type("Body (markdown)", "Body");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A field contains characters that cannot be saved (for example a NUL byte). Remove them and try again.")).toBeTruthy();
    expect(field("Title").value).toBe("Bad");
  });

  it("does not validate a stored thumbnail once a new file replaces it", async () => {
    vi.spyOn(api, "uploadAdminMedia").mockResolvedValue({ id: "m", url: "/media/33333333-3333-4333-8333-333333333333" });
    const save = vi.spyOn(api, "saveAdminPost");
    const [first] = getAdminPosts();
    const broken = { ...first, thumbnail: "not a url" };
    vi.spyOn(api, "getAdminPosts").mockResolvedValue([broken]);
    renderWithIntl(<PostManager posts={[broken]} tabs={null}>{null}</PostManager>);
    fireEvent.click(within(row(first.title)).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter an http(s) URL (or an allowed site path).")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Thumbnail"), { target: { files: [new File(["x"], "t.png", { type: "image/png" })] } });
    });
    expect(screen.queryByText("Enter an http(s) URL (or an allowed site path).")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].thumbnail).toBe("/media/33333333-3333-4333-8333-333333333333");
  });
});
