// @vitest-environment jsdom
// In api mode the manager pages render with no rows and read the list after mount. An empty table must only mean "the BE answered
// empty": until then the page says "Loading…", and a failed first read offers a retry instead of inviting a duplicate create.
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { BountyManager } from "@/components/admin/BountyManager";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { PostManager } from "@/components/admin/PostManager";
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

const managers = [
  { name: "bounties", read: "getAdminBounties", failed: "Could not load admin bounties.", render: () => <BountyManager bounties={[]} tabs={null}>{null}</BountyManager> },
  { name: "notices", read: "getAdminPosts", failed: "Could not load admin notices.", render: () => <PostManager posts={[]} tabs={null}>{null}</PostManager> },
  { name: "highlights", read: "getAdminHighlights", failed: "Could not load highlights.", render: () => <HighlightManager highlights={[]} /> },
] as const;

describe.each(managers)("$name manager first read", ({ read, failed, render }) => {
  it("shows Loading… instead of an empty table until the read answers", async () => {
    let resolve: (rows: never[]) => void = () => undefined;
    vi.spyOn(api, read).mockReturnValue(new Promise((done) => { resolve = done as typeof resolve; }) as never);
    renderWithIntl(<>{render()}<AdminToastHost /></>);

    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(screen.queryByRole("table")).toBeNull();
    resolve([]);
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("offers a retry after a failed first read, and shows the table once it succeeds", async () => {
    const spy = vi.spyOn(api, read).mockRejectedValueOnce(new Error("offline"));
    renderWithIntl(<>{render()}<AdminToastHost /></>);

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getAllByText(failed).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
