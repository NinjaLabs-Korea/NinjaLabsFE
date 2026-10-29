// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { RecruitmentManager, validateCohortForm } from "@/components/admin/RecruitmentManager";
import { ApiHttpError } from "@/lib/api/http";
import type { ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";

let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminCohortApi: () => api }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  HTMLElement.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  api = createMockApiClient();
});

const mount = () => renderWithIntl(<><RecruitmentManager tabs={null}><h1>Member recruitment</h1></RecruitmentManager><AdminToastHost /></>);
const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
const openDialog = () => document.querySelector("dialog[open]") as HTMLElement;

describe("validateCohortForm", () => {
  it("needs a name, caps the lengths and the window must run forwards", () => {
    expect(validateCohortForm({ name: " ", description: "", opensAt: "", closesAt: "" })).toEqual({ name: "required" });
    expect(validateCohortForm({ name: "x".repeat(61), description: "", opensAt: "", closesAt: "" })).toEqual({ name: "tooLong" });
    expect(validateCohortForm({ name: "ok", description: "x".repeat(10_001), opensAt: "", closesAt: "" })).toEqual({ description: "tooLong" });
    expect(validateCohortForm({ name: "ok", description: "", opensAt: "2026-12-02T10:00", closesAt: "2026-12-01T10:00" })).toEqual({ window: "window" });
    expect(validateCohortForm({ name: "ok", description: "", opensAt: "", closesAt: "2026-12-01T10:00" })).toEqual({});
  });
});

describe("RecruitmentManager", () => {
  it("lists the cohorts with status, counts and the actions the BE allows", async () => {
    mount();
    expect(await screen.findByRole("cell", { name: "Ninja Labs 2nd cohort" })).toBeTruthy();
    const open = row("Ninja Labs 2nd cohort");
    expect(within(open).getByText("Open")).toBeTruthy();
    expect(within(open).getByText(/4 total · 1 waiting · 1 accepted · 1 not selected/)).toBeTruthy();
    expect(within(open).getByRole("button", { name: "Close" })).toBeTruthy();
    expect(within(open).queryByRole("button", { name: "Open" })).toBeNull();
    const closed = row("Ninja Labs 1st cohort");
    expect(within(closed).getByRole("button", { name: "Re-open" })).toBeTruthy();
    // No applications: deletable. Cohort 2 has some: the button is disabled.
    expect((within(open).getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(closed).getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("creates a cohort as a draft, then opens it only after the other one is closed", async () => {
    mount();
    await screen.findByRole("cell", { name: "Ninja Labs 2nd cohort" });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Ninja Labs 3rd cohort" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Third round" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("cell", { name: "Ninja Labs 3rd cohort" })).toBeTruthy();
    const draft = row("Ninja Labs 3rd cohort");
    expect(within(draft).getByText("Draft")).toBeTruthy();

    fireEvent.click(within(draft).getByRole("button", { name: "Open" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Open recruitment" }));
    expect(await within(openDialog()).findByText(/Another cohort is already open/)).toBeTruthy();

    fireEvent.click(within(openDialog()).getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(row("Ninja Labs 2nd cohort")).getByRole("button", { name: "Close" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Close recruitment" }));
    await waitFor(() => expect(within(row("Ninja Labs 2nd cohort")).getByText("Closed")).toBeTruthy());

    fireEvent.click(within(row("Ninja Labs 3rd cohort")).getByRole("button", { name: "Open" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Open recruitment" }));
    await waitFor(() => expect(within(row("Ninja Labs 3rd cohort")).getByText("Open")).toBeTruthy());
  });

  it("blocks an invalid window before calling the BE and explains why", async () => {
    const save = vi.spyOn(api, "saveAdminCohort");
    mount();
    await screen.findByRole("cell", { name: "Ninja Labs 2nd cohort" });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText(/Applications open/), { target: { value: "2026-12-02T10:00" } });
    fireEvent.change(screen.getByLabelText(/Applications close/), { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("The closing time must be after the opening time.")).length).toBeGreaterThan(0);
    expect(save).not.toHaveBeenCalled();
  });

  it("deletes an empty cohort after a confirmation", async () => {
    mount();
    await screen.findByRole("cell", { name: "Ninja Labs 1st cohort" });
    fireEvent.click(within(row("Ninja Labs 1st cohort")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("cell", { name: "Ninja Labs 1st cohort" })).toBeNull());
  });

  it("shows the toast with the BE's reason when a save fails", async () => {
    vi.spyOn(api, "saveAdminCohort").mockRejectedValue(new ApiHttpError(400, "COHORT_INVALID_WINDOW"));
    mount();
    await screen.findByRole("cell", { name: "Ninja Labs 2nd cohort" });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("The closing time must be after the opening time.")).length).toBeGreaterThan(0);
  });

  it("offers a retry when the first read fails, not an empty table", async () => {
    api.getAdminCohorts = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue([]);
    mount();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(/No cohorts yet/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No cohorts yet/)).toBeTruthy();
  });
});

describe("CohortApplicationsPanel (through the manager)", () => {
  async function openApplications(name = "Ninja Labs 2nd cohort") {
    mount();
    await screen.findByRole("cell", { name });
    fireEvent.click(within(row(name)).getByRole("button", { name: "Applications" }));
    await screen.findByRole("heading", { name: `Applications for ${name}` });
  }

  it("lists the applicants and filters by status and by search", async () => {
    await openApplications();
    await screen.findByText("Joon");
    expect(screen.getByText("4 applications")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "joon" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("1 applications")).toBeTruthy());
    expect(screen.queryByText("Mina")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(screen.getByText("4 applications")).toBeTruthy());
  });

  it("says so when a filter matches nothing", async () => {
    await openApplications();
    await screen.findByText("Joon");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzz" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("No application matches these filters.")).toBeTruthy();
  });

  it("reviews an application through a confirmation; a withdrawn one has no review button", async () => {
    await openApplications();
    await screen.findByText("Mina");
    expect(within(row("Haru")).queryByRole("button", { name: /Review|Change decision/ })).toBeNull();
    fireEvent.click(within(row("Mina")).getByRole("button", { name: "Review" }));
    const confirm = within(openDialog()).getByRole("button", { name: "Choose a decision" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(within(openDialog()).getByText(/applicant only ever sees|applicant sees the result/)).toBeTruthy();
    fireEvent.click(within(openDialog()).getByRole("radio", { name: "Accept" }));
    fireEvent.change(within(openDialog()).getByLabelText(/Internal note/), { target: { value: "strong" } });
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Accept application" }));
    await waitFor(() => expect(within(row("Mina")).getByText("Accepted")).toBeTruthy());
    const applications = await api.getAdminCohortApplications("cohort-2", { q: "mina" }, 1);
    expect(applications.items[0]).toMatchObject({ status: "ACCEPTED", reviewNote: "strong" });
  });

  it("lets an operator change a decision, starting from the saved one", async () => {
    await openApplications();
    await screen.findByText("Joon");
    fireEvent.click(within(row("Joon")).getByRole("button", { name: "Change decision" }));
    expect((within(openDialog()).getByRole("radio", { name: "Accept" }) as HTMLInputElement).checked).toBe(true);
    expect((within(openDialog()).getByLabelText(/Internal note/) as HTMLTextAreaElement).value).toBe("Strong portfolio.");
    fireEvent.click(within(openDialog()).getByRole("radio", { name: "Do not select" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Mark as not selected" }));
    await waitFor(() => expect(within(row("Joon")).getByText("Not selected")).toBeTruthy());
  });

  it("keeps the dialog open with the BE's reason when the applicant withdrew meanwhile", async () => {
    await openApplications();
    await screen.findByText("Mina");
    vi.spyOn(api, "reviewAdminCohortApplication").mockRejectedValue(new ApiHttpError(409, "COHORT_APPLICATION_WITHDRAWN"));
    fireEvent.click(within(row("Mina")).getByRole("button", { name: "Review" }));
    fireEvent.click(within(openDialog()).getByRole("radio", { name: "Accept" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Accept application" }));
    expect(await within(openDialog()).findByText(/applicant withdrew this application/)).toBeTruthy();
  });

  it("exports the CSV with the current filter and saves it as a file", async () => {
    const created = vi.fn(() => "blob:csv");
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const exportCsv = vi.spyOn(api, "exportAdminCohortApplications");
    await openApplications();
    await screen.findByText("Mina");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "joon" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("1 applications")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(exportCsv).toHaveBeenCalledWith("cohort-2", { q: "joon" });
    const blob = (created.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain("text/csv");
    expect(revoked).toHaveBeenCalledWith("blob:csv");
    click.mockRestore();
  });

  it("reports a failed export in a toast", async () => {
    vi.spyOn(api, "exportAdminCohortApplications").mockRejectedValue(new ApiHttpError(503, "DATABASE_UNAVAILABLE"));
    await openApplications();
    await screen.findByText("Mina");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(await screen.findByText("Export failed")).toBeTruthy();
  });
});
