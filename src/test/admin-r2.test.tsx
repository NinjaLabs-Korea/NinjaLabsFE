// @vitest-environment jsdom
// QA round 2 admin fixes: maxWinners bound, application deadline, new error codes, audit label, deleted-row save, notice field errors.
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { PostManager, validatePostForm } from "@/components/admin/PostManager";
import { adminErrorDescription, adminTextFieldErrors } from "@/lib/admin-helpers";
import { KNOWN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { bountyToForm, emptyBountyForm, formToBounty, MAX_WINNERS_MAX, validateBountyForm } from "@/lib/admin-bounty-form";
import { getAdminBounties, getAdminHighlights, getAdminPosts } from "@/lib/admin";
import { ApiHttpError } from "@/lib/api/http";
import type { AdminApi } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";
import en from "../../messages/en/admin.json";

let api: AdminApi;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminApi: () => api }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  HTMLElement.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => { api = createMockApiClient(); });
afterEach(() => { vi.restoreAllMocks(); });

const valid = { ...emptyBountyForm(), title: "T", sponsor: "S", description: "D", deliverables: "R", reviewProcess: "P", deadline: "2099-07-14T23:59" };
const opts = { now: new Date("2026-01-01") };

describe("bounty form bounds", () => {
  it("caps maxWinners at the BE @Max(1000)", () => {
    expect(MAX_WINNERS_MAX).toBe(1000);
    expect(validateBountyForm({ ...valid, maxWinners: "1001" }, opts).maxWinners).toBe("maxWinnersInvalid");
    expect(validateBountyForm({ ...valid, maxWinners: "1000" }, opts).maxWinners).toBeUndefined();
  });

  it("flags an application deadline after the deadline, tolerating the BE one-minute slack", () => {
    expect(validateBountyForm({ ...valid, applicationDeadline: "2099-07-15T00:00" }, opts).applicationDeadline).toBe("applicationDeadlineAfterDeadline");
    expect(validateBountyForm({ ...valid, applicationDeadline: "2099-07-14T23:59" }, opts).applicationDeadline).toBeUndefined();
    expect(validateBountyForm({ ...valid, applicationDeadline: "2099-07-01T00:00" }, opts).applicationDeadline).toBeUndefined();
    expect(validateBountyForm({ ...valid, applicationDeadline: "" }, opts).applicationDeadline).toBeUndefined();
  });

  it("round-trips the stored application deadline byte for byte and clears it when emptied", () => {
    const bounty = { ...getAdminBounties()[0], deadline: "2099-07-14T23:59:30.000Z", applicationDeadline: "2099-07-01T00:00:15.000Z" };
    const form = bountyToForm(bounty);
    expect(form.applicationDeadline).not.toBe("");
    expect(formToBounty(form, { slug: "x", coverImage: null }).applicationDeadline).toBe("2099-07-01T00:00:15.000Z");
    expect(formToBounty({ ...form, applicationDeadline: "" }, { slug: "x", coverImage: null }).applicationDeadline).toBeNull();
  });
});

describe("admin error copy and audit labels", () => {
  const translate = (key: string) => key;
  it("maps the two new BE codes", () => {
    expect(adminErrorDescription(new ApiHttpError(400, "APPLICATION_DEADLINE_AFTER_SUBMISSION_DEADLINE"), translate, "fb")).toBe("errors.APPLICATION_DEADLINE_AFTER_SUBMISSION_DEADLINE");
    expect(adminErrorDescription(new ApiHttpError(400, "REWARD_SYMBOL_DENOM_MISMATCH"), translate, "fb")).toBe("errors.REWARD_SYMBOL_DENOM_MISMATCH");
    expect(en.common.errors.APPLICATION_DEADLINE_AFTER_SUBMISSION_DEADLINE).toMatch(/application deadline/i);
  });

  it("labels BOUNTY_FUNDING_PENDING", () => {
    expect(KNOWN_AUDIT_ACTIONS).toContain("BOUNTY_FUNDING_PENDING");
    expect(en.audit.actions.BOUNTY_FUNDING_PENDING).toBe("Bounty marked funding pending");
  });
});

describe("notice form validation", () => {
  const base = { title: "T", bodyMarkdown: "B", thumbnail: null, externalUrl: null };
  it("bounds the event date", () => {
    expect(validatePostForm({ ...base, eventDate: "2101-01-01" }).eventDate).toBe("dateRange");
    expect(validatePostForm({ ...base, eventDate: "1999-12-31" }).eventDate).toBe("dateRange");
    expect(validatePostForm({ ...base, eventDate: "2026-05-01" }).eventDate).toBeUndefined();
    expect(validatePostForm({ ...base, eventDate: "" }).eventDate).toBeUndefined();
  });

  it("treats zero-width-only title/body as empty", () => {
    expect(validatePostForm({ ...base, title: "​​" }).title).toBe("required");
    expect(validatePostForm({ ...base, bodyMarkdown: "ㅤ " }).bodyMarkdown).toBe("required");
  });

  it("maps a BE 400 about visible/bidi characters to field errors", () => {
    const error = new ApiHttpError(400, "VALIDATION_FAILED", ["title must not contain bidirectional override characters", "body must contain visible characters"]);
    expect(adminTextFieldErrors(error, { title: "title", body: "bodyMarkdown" } as const)).toEqual({ title: "bidiChars", bodyMarkdown: "required" });
    expect(adminTextFieldErrors(new ApiHttpError(400, "VALIDATION_FAILED", ["summary must be a string"]), { title: "title" } as const)).toEqual({});
  });
});

describe("saving a record deleted elsewhere", () => {
  const row = (text: string) => screen.getByText(text, { selector: "td" }).closest("tr") as HTMLTableRowElement;

  it("notice: re-reads the list and leaves edit mode", async () => {
    renderWithIntl(<><PostManager posts={getAdminPosts()} tabs={null}>{null}</PostManager><AdminToastHost /></>);
    await waitFor(() => expect(row("Q3 roadmap preview")).toBeTruthy());
    fireEvent.click(row("Q3 roadmap preview").querySelector("button") as HTMLButtonElement);
    expect(screen.getByText("Edit post")).toBeTruthy();
    vi.spyOn(api, "saveAdminPost").mockRejectedValue(new ApiHttpError(404, "NOTICE_NOT_FOUND"));
    const reread = vi.spyOn(api, "getAdminPosts").mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/no longer exists/)).toBeTruthy();
    await waitFor(() => expect(reread).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Edit post")).toBeNull());
  });

  it("highlight: re-reads the list on HIGHLIGHT_NOT_FOUND", async () => {
    renderWithIntl(<><HighlightManager highlights={getAdminHighlights()} /><AdminToastHost /></>);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    vi.spyOn(api, "saveAdminHighlight").mockRejectedValue(new ApiHttpError(404, "HIGHLIGHT_NOT_FOUND"));
    const reread = vi.spyOn(api, "getAdminHighlights").mockResolvedValue([]);
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    expect(await screen.findByText(/no longer exists/)).toBeTruthy();
    await waitFor(() => expect(reread).toHaveBeenCalled());
  });
});
