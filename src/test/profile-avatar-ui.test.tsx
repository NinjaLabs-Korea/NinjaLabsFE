// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarSettings } from "@/components/account/AvatarSettings";
import { MemberCard } from "@/components/cards/MemberCard";
import { Avatar } from "@/components/ui/Avatar";
import type { ClientUser } from "@/lib/contracts/auth";
import { MockApiError } from "@/lib/mocks/mock-error";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const refreshMemberLists = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/member-revalidate", () => ({ refreshMemberLists }));

const photo = "/media/0b6f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";
const api = { uploadAvatar: vi.fn(), removeAvatar: vi.fn() };
const refresh = vi.fn(async () => ({ status: "signed-out", user: null }));
const state = { mode: "api" as "api" | "mock" };

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAccountSettingsApi: () => api,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn(), refresh }),
    useFoundationMode: () => state.mode,
  }));

const user = (extra: Partial<ClientUser> = {}): ClientUser => ({ id: "u1", handle: "pelican", initials: "PE", profileSlug: "pelican", ...extra });
const png = (size = 100, type = "image/png") => new File([new Uint8Array(size)], "me.png", { type });
const fileInput = () => screen.getByTestId("avatar-settings").querySelector<HTMLInputElement>('input[type="file"]')!;

beforeEach(() => {
  api.uploadAvatar.mockReset();
  api.removeAvatar.mockReset();
  refresh.mockClear();
  refreshMemberLists.mockClear();
  state.mode = "api";
  URL.createObjectURL = vi.fn(() => "blob:preview-1");
  URL.revokeObjectURL = vi.fn();
});

describe("ui/Avatar", () => {
  it("shows the photo when there is one, the initials otherwise, and falls back to the initials when the photo fails", () => {
    const { container, rerender } = renderWithIntl(<Avatar avatarUrl={photo} initials="PE" sizeClass="size-8" sizes="32px" />);
    const img = container.querySelector("img")!;
    expect(img).not.toBeNull();
    expect(container.textContent).not.toContain("PE");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("PE");
    rerender(<Avatar initials="PE" sizeClass="size-8" sizes="32px" />);
    expect(container.querySelector("[data-avatar]")?.getAttribute("data-avatar")).toBe("initials");
  });

  it("is decorative: the nickname is read from the text next to it", () => {
    const { container } = renderWithIntl(<Avatar avatarUrl={photo} initials="PE" sizeClass="size-8" sizes="32px" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});

describe("MemberCard", () => {
  it("renders the member photo when the list carries one", () => {
    const { container } = renderWithIntl(<MemberCard member={{ slug: "a", name: "alpha", initials: "AL", role: "Dev", title: "", bio: "", isMember: true, links: {}, avatarUrl: photo }} />);
    expect(container.querySelector("[data-avatar]")?.getAttribute("data-avatar")).toBe("photo");
  });
});

describe("account/AvatarSettings", () => {
  it("gives the visually hidden file input an accessible name (axe: form elements must have labels)", () => {
    renderWithIntl(<AvatarSettings user={user()} />);
    expect(fileInput().getAttribute("aria-label")).toBe("Profile photo");
    expect(screen.getByLabelText("Profile photo")).toBe(fileInput());
  });

  it("rejects a wrong type or a too-large file before any request", () => {
    renderWithIntl(<AvatarSettings user={user()} />);
    fireEvent.change(fileInput(), { target: { files: [png(100, "image/gif")] } });
    expect(screen.getByRole("alert").textContent).toBe("Only JPG, PNG and WebP photos can be uploaded.");
    fireEvent.change(fileInput(), { target: { files: [png(2 * 1024 * 1024 + 1)] } });
    expect(screen.getByRole("alert").textContent).toBe("The photo is larger than 2 MB. Choose a smaller one.");
    expect(api.uploadAvatar).not.toHaveBeenCalled();
  });

  it("previews the picked file, uploads it on save, re-reads the user and expires the member list", async () => {
    let resolveUpload!: (value: { avatarUrl: string }) => void;
    api.uploadAvatar.mockImplementation(() => new Promise((resolve) => { resolveUpload = resolve; }));
    renderWithIntl(<AvatarSettings user={user()} />);
    fireEvent.change(fileInput(), { target: { files: [png()] } });
    expect(screen.getByText("This is a preview. Save to use it.")).toBeTruthy();
    expect(screen.getByTestId("avatar-settings").querySelector("img")?.getAttribute("src")).toBe("blob:preview-1");

    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Uploading…" })); // double click while in flight
    expect(api.uploadAvatar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("Uploading…");
    await act(async () => resolveUpload({ avatarUrl: photo }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Profile photo saved."));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshMemberLists).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
  });

  it("maps a BE error code to its copy and keeps the preview for a retry", async () => {
    api.uploadAvatar.mockRejectedValueOnce(new MockApiError(400, "MEDIA_FILE_TYPE_UNSUPPORTED"));
    renderWithIntl(<AvatarSettings user={user()} />);
    fireEvent.change(fileInput(), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Only JPG, PNG and WebP photos can be uploaded."));
    expect(screen.getByRole("button", { name: "Save photo" })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("removes the current photo; without one there is no remove button; mock mode does not call the server action", async () => {
    state.mode = "mock";
    api.removeAvatar.mockResolvedValueOnce(undefined);
    const { rerender } = renderWithIntl(<AvatarSettings user={user({ avatarUrl: photo })} />);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Profile photo removed."));
    expect(api.removeAvatar).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshMemberLists).not.toHaveBeenCalled();
    rerender(<AvatarSettings user={user()} />);
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeTruthy();
  });
});
