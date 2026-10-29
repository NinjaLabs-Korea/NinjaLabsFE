// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { NftJobsManager } from "@/components/admin/NftJobsManager";
import { renderWithIntl } from "@/test/intl";

const job = { id: "j1", nftId: "n1", jobType: "MINT_PARENT", status: "FAILED", retryCount: 5, lastError: "out of gas", scheduledAt: null, updatedAt: null, nftType: "NINJA_PARENT", nftStatus: "FAILED", bountyTitle: null, ownerNickname: null, ownerWalletAddress: null };
const page = { page: 1, pageSize: 30, total: 1, items: [job] };

const adminApi = {
  getAdminNftJobs: vi.fn(),
  retryAdminNftJob: vi.fn(async () => undefined),
};

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => adminApi }));

describe("NftJobsManager double submit", () => {
  it("sends one retry for a double click while the reload is pending", async () => {
    adminApi.getAdminNftJobs.mockResolvedValueOnce(page);
    renderWithIntl(<><NftJobsManager tabs={null}>{null}</NftJobsManager><AdminToastHost /></>);
    expect(await screen.findByText("out of gas")).toBeTruthy();
    let release!: () => void;
    adminApi.getAdminNftJobs.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(page); }));
    const button = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(button);
    await waitFor(() => expect(adminApi.retryAdminNftJob).toHaveBeenCalledTimes(1));
    // Retry has resolved and the reload is pending: the row is still on screen, a second click must not resend the write.
    await waitFor(() => expect(adminApi.getAdminNftJobs).toHaveBeenCalledTimes(2));
    fireEvent.click(button);
    fireEvent.click(button);
    expect(adminApi.retryAdminNftJob).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
