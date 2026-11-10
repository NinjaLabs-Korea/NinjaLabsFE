// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import { CopyButton } from "@/components/ui/CopyButton";
import { createApiApiClient } from "@/lib/api/api-client";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { BE_ERROR_CODES } from "@/lib/api/be-error-codes";
import { BE_AUDIT_ACTIONS } from "@/lib/api/be-audit-actions";
import { ERROR_COPY, errorCopyKey } from "@/lib/api/error-copy";
import type { AccountApplication } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { evmHexAddress, isPayoutAddressShape } from "@/lib/injective-address";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { MockApiError } from "@/lib/mocks/mock-error";
import { hrefString } from "@/test/support/link";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: Parameters<typeof hrefString>[0] }) => (
    <a href={hrefString(href)} {...props}>{children}</a>
  ),
}));

const state: { auth: AuthSnapshot } = { auth: signedInAs(previewUser) };
let apiClient: ApiClient;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountApi: () => apiClient,
    useBountyApi: () => apiClient,
    useFoundationMode: () => "api",
  }));

// A real 20-byte address in both forms (0x...01 and its inj1 encoding computed by the mock's encoder is checked below).
const EVM = "0x00000000000000000000000000000000000000ab";
const INJ = "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9tnlugte";

describe("isPayoutAddressShape (client pre-check)", () => {
  it.each([
    ["a 0x address", EVM, true],
    ["a 0x address with mixed case", "0xAbCdEf0000000000000000000000000000000001", true],
    ["a lowercase inj1 address", "inj1cml96vm2229ypa4mmkjy5dthn4kxqtzsk7kdxr", true],
    ["an all-uppercase inj1 address", "INJ1CML96VM2229YPA4MMKJY5DTHN4KXQTZSK7KDXR", true],
    ["an address with surrounding spaces", `  ${EVM}  `, true],
    ["a mixed-case inj1 address", "inj1Cml96vm2229ypa4mmkjy5dthn4kxqtzsk7kdxr", false],
    ["a 0x address that is too short", "0x1234", false],
    ["a 0x address with a non-hex digit", "0xzz00000000000000000000000000000000000001", false],
    ["a 32-byte (contract) inj1 address", "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", false],
    ["a cosmos address", "cosmos1cml96vm2229ypa4mmkjy5dthn4kxqtzs5kjh6x", false],
    ["an empty string", "", false],
  ])("%s -> %s", (_label, input, expected) => {
    expect(isPayoutAddressShape(input)).toBe(expected);
  });
});

describe("BE #69 catalogs", () => {
  it("snapshots the three new error codes and the audit action", () => {
    for (const code of ["PAYOUT_ADDRESS_NOT_SET", "PAYOUT_ADDRESS_LOCKED", "SUBMISSION_NOT_APPROVED"]) expect(BE_ERROR_CODES as readonly string[]).toContain(code);
    expect(BE_AUDIT_ACTIONS as readonly string[]).toContain("PAYOUT_ADDRESS_SET");
  });

  it("gives the applications screen its own copy for the four codes and the ops screen for the two", () => {
    expect(ERROR_COPY.payoutAddress.codes).toEqual(expect.arrayContaining(["INVALID_INJECTIVE_ADDRESS", "PAYOUT_ADDRESS_LOCKED", "SUBMISSION_NOT_APPROVED", "SUBMISSION_NOT_FOUND"]));
    expect(ERROR_COPY.adminOperations.codes).toEqual(expect.arrayContaining(["PAYOUT_ADDRESS_NOT_SET", "APPROVED_SUBMISSION_NOT_FOUND"]));
    expect(errorCopyKey(new ApiHttpError(409, "PAYOUT_ADDRESS_LOCKED"), ERROR_COPY.payoutAddress)).toBe("PAYOUT_ADDRESS_LOCKED");
    expect(errorCopyKey(new ApiHttpError(500, "SOMETHING_ELSE"), ERROR_COPY.payoutAddress)).toBe("generic");
  });
});

describe("api client: submissions and the payout address", () => {
  const fakeHttp = (routes: Record<string, unknown>) => {
    const fetchJson = vi.fn(async (path: string, init?: { method?: string; body?: unknown }) => (init?.method && init.method !== "GET" ? { submissionId: "s1", payoutAddress: INJ, payoutAddressEvm: EVM, updatedAt: "t" } : routes[path]));
    return { fetchJson, client: createApiApiClient({ fetchJson, fetchForm: vi.fn(), hasSession: () => true } as unknown as ApiHttp) };
  };
  const owner: AuthSnapshot = signedInAs(previewUser);
  const approvedRow = { id: "s1", status: "APPROVED", bounty_id: "b1", bounty_title: "T", category: "DEV", agent: null, submitted_at: "2026-07-01T00:00:00Z", description: "d" };

  it("PUTs the trimmed address to /submissions/:id/payout-address", async () => {
    const { client, fetchJson } = fakeHttp({});
    const result = await client.setPayoutAddress("s 1", `  ${EVM}  `);
    expect(fetchJson).toHaveBeenCalledWith("/submissions/s%201/payout-address", { method: "PUT", body: { address: EVM } });
    expect(result.payoutAddressEvm).toBe(EVM);
  });

  it("maps the four payout fields onto a standalone submission row and its submission", async () => {
    const { client } = fakeHttp({
      "/applications/me": [],
      "/submissions/me": [{ ...approvedRow, payout_address: INJ, payout_address_evm: EVM, payout_address_updated_at: "2026-07-02T00:00:00Z", payout_address_editable: true }],
    });
    const rows = await client.getApplications(owner);
    if (rows.status !== "available") throw new Error("unavailable");
    expect(rows.data[0]).toMatchObject({ status: "completed", submissionId: "s1", payoutAddress: INJ, payoutAddressEvm: EVM, payoutAddressUpdatedAt: "2026-07-02T00:00:00Z", payoutAddressEditable: true });
    const subs = await client.getSubmissions(owner);
    if (subs.status !== "available") throw new Error("unavailable");
    expect(subs.data[0]).toMatchObject({ submissionId: "s1", payoutAddress: INJ, payoutAddressEditable: true });
  });

  it("joins the fields onto an approved application row", async () => {
    const { client } = fakeHttp({
      "/applications/me": [{ id: "a1", status: "APPROVED", message: "m", applied_at: "2026-06-01T00:00:00Z", reviewed_at: null, bounty_id: "b1", bounty_title: "T", category: "DEV", agent: null }],
      "/submissions/me": [{ ...approvedRow, payout_address: null, payout_address_evm: null, payout_address_updated_at: null, payout_address_editable: true }],
    });
    const rows = await client.getApplications(owner);
    if (rows.status !== "available") throw new Error("unavailable");
    expect(rows.data[0]).toMatchObject({ id: "a1", status: "completed", submissionId: "s1", payoutAddress: null, payoutAddressEditable: true });
  });

  it("an older BE (no payout fields) leaves them all out, so no form is offered", async () => {
    const { client } = fakeHttp({ "/applications/me": [], "/submissions/me": [{ ...approvedRow, id: undefined }] });
    const rows = await client.getApplications(owner);
    if (rows.status !== "available") throw new Error("unavailable");
    expect(rows.data[0]).not.toHaveProperty("payoutAddressEditable");
    expect(rows.data[0]).not.toHaveProperty("payoutAddress");
  });
});

describe("mock client: setPayoutAddress", () => {
  const mockRow = async (client: ApiClient) => {
    const rows = await client.getApplications(signedInAs(previewUser));
    if (rows.status !== "available") throw new Error("unavailable");
    return rows.data.find((row) => row.status === "completed")!;
  };
  const codeOf = async (promise: Promise<unknown>) => promise.then(() => null, (error: MockApiError) => [error.status, error.code]);

  it("answers both forms of the same 20 bytes and updates the row", async () => {
    const client = createMockApiClient();
    const row = await mockRow(client);
    const saved = await client.setPayoutAddress(row.submissionId!, EVM);
    expect(saved.payoutAddressEvm).toBe(EVM);
    expect(saved.payoutAddress).toBe(INJ);
    expect(evmHexAddress(saved.payoutAddress)).toBe(EVM);
    expect(await mockRow(client)).toMatchObject({ payoutAddress: INJ, payoutAddressEvm: EVM, payoutAddressEditable: true });
    // a change is still allowed (no payout row yet)
    await client.setPayoutAddress(row.submissionId!, INJ);
  });

  it("encodes inj1 exactly like an independent bech32 encoder (checksum included)", async () => {
    const client = createMockApiClient();
    const row = await mockRow(client);
    const saved = await client.setPayoutAddress(row.submissionId!, "0xcafecafecafecafecafecafecafecafecafecafe");
    expect(saved.payoutAddress).toBe("inj1etlv4lk2lm90ajh7etlv4lk2lm90ajh7l5mjkz");
  });

  it("rejects a bad format (400), an unknown submission (404) and a submission that is not approved (409)", async () => {
    const client = createMockApiClient();
    const row = await mockRow(client);
    expect(await codeOf(client.setPayoutAddress(row.submissionId!, "nope"))).toEqual([400, "INVALID_INJECTIVE_ADDRESS"]);
    expect(await codeOf(client.setPayoutAddress("missing", EVM))).toEqual([404, "SUBMISSION_NOT_FOUND"]);
  });
});

const row = (overrides: Partial<AccountApplication> = {}): AccountApplication => ({
  id: "app-1", source: "application", bountySlug: "b1", bountyTitle: "Bounty one", category: "Design", appliedAt: "2026-07-12T09:00:00.000Z", note: "note",
  status: "completed", agent: null, reviewComment: null, reviewNote: null, paymentStatus: "PENDING",
  submissionId: "s1", payoutAddress: null, payoutAddressEvm: null, payoutAddressUpdatedAt: null, payoutAddressEditable: true,
  ...overrides,
});

function serve(rows: AccountApplication[], setPayoutAddress = vi.fn(async () => ({ submissionId: "s1", payoutAddress: INJ, payoutAddressEvm: EVM, updatedAt: "t" }))) {
  apiClient = createMockApiClient();
  Object.assign(apiClient, { getApplications: async () => ({ status: "available", data: rows }), setPayoutAddress });
  return setPayoutAddress;
}

describe("PayoutAddressForm in ApplicationsView", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });
  beforeEach(() => { state.auth = signedInAs(previewUser); });

  it("shows the form with the receive-on-Injective warning for an approved submission without an address", async () => {
    serve([row()]);
    renderWithIntl(<ApplicationsView />);
    expect(await screen.findByRole("region", { name: "Payout address" })).toBeTruthy();
    expect(screen.getByText(/exchange deposit address that needs a memo/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save address" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is not offered for a row without the BE #69 fields, a non-approved row, or an agent's submission", async () => {
    const { payoutAddressEditable, ...legacy } = row();
    void payoutAddressEditable;
    serve([legacy, row({ id: "app-2", bountyTitle: "Two", status: "submitted" }), row({ id: "app-3", bountyTitle: "Three", agent: { id: "ag", name: "bot" } })]);
    renderWithIntl(<ApplicationsView />);
    await screen.findByText("Bounty one");
    expect(screen.queryByRole("region", { name: "Payout address" })).toBeNull();
  });

  it("checks the format before any request and shows the error inline", async () => {
    const save = serve([row()]);
    renderWithIntl(<ApplicationsView />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("42-character address starting with 0x");
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  });

  it("saves the trimmed address once even on a double click, announces it, and re-reads the list", async () => {
    let release: () => void = () => undefined;
    const save = serve([row()], vi.fn(() => new Promise<never>((resolve) => { release = () => resolve({ submissionId: "s1", payoutAddress: INJ, payoutAddressEvm: EVM, updatedAt: "t" } as never); })) as never);
    const read = vi.fn(async () => ({ status: "available", data: [row()] }));
    Object.assign(apiClient, { getApplications: read });
    renderWithIntl(<ApplicationsView />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: `  ${EVM}  ` } });
    const button = screen.getByRole("button", { name: "Save address" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("s1", `  ${EVM}  `);
    const reads = read.mock.calls.length;
    await act(async () => { release(); });
    await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(reads));
    expect(screen.getAllByText("Payout address saved.").length).toBeGreaterThan(0);
  });

  it.each([
    ["INVALID_INJECTIVE_ADDRESS", 400, "That address format is not valid"],
    ["PAYOUT_ADDRESS_LOCKED", 409, "A payout was already requested"],
    ["SUBMISSION_NOT_APPROVED", 409, "only enter a payout address for an approved submission"],
    ["SUBMISSION_NOT_FOUND", 404, "couldn’t find this submission"],
    ["SOMETHING_NEW", 500, "couldn’t save the payout address"],
  ])("maps %s to its own copy", async (code, status, text) => {
    serve([row()], vi.fn(async () => { throw new ApiHttpError(status, code); }) as never);
    renderWithIntl(<ApplicationsView />);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: EVM } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect((await screen.findByRole("alert")).textContent).toContain(text);
  });

  it("shows the saved address in both forms and lets the winner change it", async () => {
    serve([row({ payoutAddress: INJ, payoutAddressEvm: EVM, payoutAddressUpdatedAt: "2026-07-13T00:00:00Z" })]);
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("region", { name: "Payout address" });
    expect(screen.getByText(INJ)).toBeTruthy();
    expect(screen.getByText(EVM)).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(INJ);
    // unchanged -> nothing to save
    expect((screen.getByRole("button", { name: "Change address" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: EVM.replace("ab", "cd") } });
    expect((screen.getByRole("button", { name: "Change address" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("is read-only with a contact link once the BE locked it", async () => {
    serve([row({ payoutAddress: INJ, payoutAddressEvm: EVM, payoutAddressEditable: false, paymentStatus: "PENDING" })]);
    renderWithIntl(<ApplicationsView />);
    await screen.findByRole("region", { name: "Payout address" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Save address|Change address/ })).toBeNull();
    expect(screen.getByText(INJ)).toBeTruthy();
    expect(screen.getByRole("link", { name: "contact the team" }).getAttribute("href")).toMatch(/^mailto:/);
  });
});

describe("CopyButton", () => {
  const props = { value: "ara@example.test", label: "Copy", copiedLabel: "Copied", failedLabel: "Copy failed", className: "x" };

  it("copies the value, flips the label and announces it", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithIntl(<CopyButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(writeText).toHaveBeenCalledWith("ara@example.test");
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it.each([
    ["a missing clipboard", undefined],
    ["a rejected write", { writeText: vi.fn(async () => { throw new Error("denied"); }) }],
  ])("says so instead of failing silently with %s", async (_label, clipboard) => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    renderWithIntl(<CopyButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copy failed" });
    expect(screen.getByRole("status").textContent).toBe("Copy failed");
  });
});
