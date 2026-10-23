// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BountyManager } from "@/components/admin/BountyManager";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { PostManager } from "@/components/admin/PostManager";
import type { AdminBounty, AdminHighlight, AdminPost } from "@/lib/admin";
import { renderWithIntl } from "@/test/intl";

type Deferred = { resolve: () => void; promise: Promise<{ id: string }> };
function deferred(id: string): Deferred {
  let resolve!: () => void;
  const promise = new Promise<{ id: string }>((done) => {
    resolve = () => done({ id });
  });
  return { resolve, promise };
}

const bounty: AdminBounty = {
  slug: "b1", title: "Widget", sponsor: "Injective", reward: { amount: 5, currency: "INJ" }, intakeEnabled: false, submissionMode: "direct",
  coverImage: "/media/11111111-1111-4111-8111-111111111111", status: "active", deadline: "2026-07-14T23:59:00.000Z", applicationDeadline: null, maxWinners: 1,
  tags: ["Dev"], description: "Desc", submissionGuide: "", requirements: "- Repo\n\n  note", deliverables: ["- Repo", "note"], reviewProcess: "Review",
};
const highlight: AdminHighlight = { id: "h1", type: "FUTURE_TYPE", title: "Hydro", description: "Partner", order: 1, image: "/media/11111111-1111-4111-8111-111111111111", link: "/notices", published: false };
const post: AdminPost = { slug: "n1", title: "Launch", category: "Events", status: "published", publishedAt: "2026-06-20", bodyMarkdown: "Body", thumbnail: "/media/11111111-1111-4111-8111-111111111111", externalUrl: "https://example.test/x" };

const adminApi = {
  getAdminBounties: vi.fn(async () => [bounty]),
  saveAdminBounty: vi.fn(),
  uploadAdminMedia: vi.fn(),
  getAdminHighlights: vi.fn(async () => [highlight]),
  saveAdminHighlight: vi.fn(),
  getAdminPosts: vi.fn(async () => [post]),
  saveAdminPost: vi.fn(),
};

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAdminApi: () => adminApi,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  adminApi.saveAdminBounty.mockReset();
  adminApi.saveAdminHighlight.mockReset();
  adminApi.saveAdminPost.mockReset();
  adminApi.getAdminBounties.mockClear();
  adminApi.getAdminHighlights.mockClear();
  adminApi.getAdminPosts.mockClear();
});

describe("BountyManager", () => {
  it("disables the save button while a save is in flight and never double-posts", async () => {
    const pending = deferred("b1");
    adminApi.saveAdminBounty.mockReturnValue(pending.promise);
    renderWithIntl(<BountyManager bounties={[bounty]} tabs={null}>{null}</BountyManager>);
    await waitFor(() => expect(adminApi.getAdminBounties).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    // ISO fixture deadline renders through the formatter, not as the raw string.
    expect(screen.queryByText("2026-07-14T23:59:00.000Z")).toBeNull();
    expect(screen.getByText("Jul 14, 2026, 11:59 PM")).toBeTruthy();

    fireEvent.submit(save.closest("form") as HTMLFormElement);
    await waitFor(() => expect(save.disabled).toBe(true));
    expect(save.textContent).toBe("Saving…");
    fireEvent.submit(save.closest("form") as HTMLFormElement);
    fireEvent.click(save);
    expect(adminApi.saveAdminBounty).toHaveBeenCalledTimes(1);
    // Untouched deliverables/guide: the raw requirements string goes back byte-identical.
    expect(adminApi.saveAdminBounty).toHaveBeenCalledWith(expect.objectContaining({ requirements: "- Repo\n\n  note", coverImage: bounty.coverImage }), false);
    pending.resolve();
    await waitFor(() => expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("sends coverImage null after the admin removes the cover", async () => {
    adminApi.saveAdminBounty.mockResolvedValue({ id: "b1" });
    renderWithIntl(<BountyManager bounties={[bounty]} tabs={null}>{null}</BountyManager>);
    await waitFor(() => expect(adminApi.getAdminBounties).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(adminApi.saveAdminBounty).toHaveBeenCalledTimes(1));
    expect(adminApi.saveAdminBounty.mock.calls[0][0]).toMatchObject({ coverImage: null });
  });
});

describe("HighlightManager", () => {
  it("keeps an unknown type code, omits type/publish on an untouched edit, and sends cleared URLs as null", async () => {
    adminApi.saveAdminHighlight.mockResolvedValue({ id: "h1" });
    renderWithIntl(<HighlightManager highlights={[highlight]} />);
    await waitFor(() => expect(adminApi.getAdminHighlights).toHaveBeenCalled());
    // The raw code is shown (no fallback to another type) and the row carries its hidden state.
    expect(screen.getAllByText("FUTURE_TYPE").length).toBeGreaterThan(0);
    expect(screen.getByText("Hidden")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByPlaceholderText("/bounties/12"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(adminApi.saveAdminHighlight).toHaveBeenCalledTimes(1));
    const [record, create, options] = adminApi.saveAdminHighlight.mock.calls[0] as unknown as [AdminHighlight, boolean, { publish?: boolean; typeChanged?: boolean }];
    expect(create).toBe(false);
    expect(record).toMatchObject({ id: "h1", type: "FUTURE_TYPE", image: null, published: false });
    expect(record).not.toHaveProperty("link");
    expect(options).toEqual({ typeChanged: false });
  });

  it("sends publish only when the visibility toggled and type only when changed, and blocks a second submit while saving", async () => {
    const pending = deferred("h1");
    adminApi.saveAdminHighlight.mockReturnValue(pending.promise);
    renderWithIntl(<HighlightManager highlights={[highlight]} />);
    await waitFor(() => expect(adminApi.getAdminHighlights).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Award" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Visibility" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Published" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    fireEvent.submit(save.closest("form") as HTMLFormElement);
    await waitFor(() => expect(save.disabled).toBe(true));
    fireEvent.submit(save.closest("form") as HTMLFormElement);
    expect(adminApi.saveAdminHighlight).toHaveBeenCalledTimes(1);
    const [record, , options] = adminApi.saveAdminHighlight.mock.calls[0] as unknown as [AdminHighlight, boolean, { publish?: boolean; typeChanged?: boolean }];
    expect(record).toMatchObject({ type: "AWARD", published: true });
    expect(options).toEqual({ publish: true, typeChanged: true });
    pending.resolve();
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it("creates with the chosen visibility instead of a hard-coded publish: true", async () => {
    adminApi.saveAdminHighlight.mockResolvedValue({ id: "h2" });
    renderWithIntl(<HighlightManager highlights={[]} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Body" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Visibility" }));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Hidden" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(adminApi.saveAdminHighlight).toHaveBeenCalledTimes(1));
    const [record, create, options] = adminApi.saveAdminHighlight.mock.calls[0] as unknown as [AdminHighlight, boolean, { publish?: boolean; typeChanged?: boolean }];
    expect(create).toBe(true);
    expect(record).toMatchObject({ type: "MILESTONE", published: false, image: null });
    expect(options).toEqual({ publish: false, typeChanged: false });
  });
});

describe("PostManager", () => {
  it("sends cleared external link and thumbnail as null and blocks double saves", async () => {
    const pending = deferred("n1");
    adminApi.saveAdminPost.mockReturnValue(pending.promise);
    renderWithIntl(<PostManager posts={[post]} tabs={null}>{null}</PostManager>);
    await waitFor(() => expect(adminApi.getAdminPosts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByPlaceholderText("https://injective.com/..."), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    fireEvent.click(save);
    await waitFor(() => expect(save.disabled).toBe(true));
    expect(save.textContent).toBe("Saving…");
    fireEvent.click(save);
    expect(adminApi.saveAdminPost).toHaveBeenCalledTimes(1);
    expect(adminApi.saveAdminPost).toHaveBeenCalledWith(expect.objectContaining({ slug: "n1", externalUrl: null, thumbnail: null }), false, undefined);
    pending.resolve();
    await waitFor(() => expect(save.disabled).toBe(false));
  });
});
