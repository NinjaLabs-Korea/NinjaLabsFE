// @vitest-environment jsdom
// QA round 2, package FE-3: what a builder sees for cancelled / closed / unreachable bounty states.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import { FLASH_EVENT } from "@/lib/flash";
import { signedIn as signedInSnapshot } from "@/test/support/auth";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { renderWithIntl } from "@/test/intl";
import { signedOut } from "@/test/support/auth";
import type { AccountApplication } from "@/lib/contracts/account";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));

const auth: { current: AuthSnapshot } = { current: signedOut };
const none = async () => ({ status: "available" as const, data: [] });
const apiClient = { getApplications: none, getSubmissions: none } as unknown as ApiClient & Record<string, unknown>;
vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthSnapshot: () => auth.current,
  useAccountApi: () => apiClient,
  useBountyApi: () => apiClient,
  useFoundationMode: () => "api",
}));
import { createApiApiClient } from "@/lib/api/api-client";
import { deriveActionView, type BountyActionInput } from "@/lib/bounty-action-state";
import { applicationStatusLabel } from "@/components/account/ApplicationsView";
import type { ApiHttp } from "@/lib/api/http";

const BOUNTY = "b-1";
const loaded = <T,>(data: T[]) => ({ loading: false, unavailable: false, data });

function input(overrides: Partial<BountyActionInput> = {}): BountyActionInput {
  return {
    bountyId: BOUNTY, applicationRequired: false, status: "active", submissionMode: "direct", auth: "signed-in",
    applications: loaded([]), submissions: loaded([]), applied: false, submitted: false, ...overrides,
  };
}

function fakeHttp(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const http = {
    fetchJson: async (path: string) => {
      calls.push(path);
      return routes[path];
    },
  } as unknown as ApiHttp;
  return { http, calls };
}

const signedIn = { status: "signed-in", user: { id: "u1" } } as never;

describe("cancelled-bounty submissions (#31)", () => {
  const rejected = (extra: Record<string, unknown>) => ({ id: "s1", bounty_id: BOUNTY, bounty_title: "T", category: "DEV", status: "REJECTED", ...extra });

  it("flags a REJECTED submission with no review on a CANCELLED bounty", async () => {
    const { http } = fakeHttp({ "/applications/me": [], "/submissions/me": [rejected({ bounty_status: "CANCELLED", has_review: false })] });
    const client = createApiApiClient(http);
    const apps = await client.getApplications(signedIn);
    const subs = await client.getSubmissions(signedIn);
    expect(apps.status === "available" && apps.data[0]).toMatchObject({ status: "notAccepted", closedByCancellation: true });
    expect(subs.status === "available" && subs.data[0]).toMatchObject({ closedByCancellation: true });
  });

  it("keeps today's behaviour when the BE does not send has_review or a reviewed rejection", async () => {
    const { http } = fakeHttp({ "/applications/me": [], "/submissions/me": [rejected({}), rejected({ id: "s2", bounty_id: "b-2", bounty_status: "CANCELLED", has_review: true })] });
    const apps = await createApiApiClient(http).getApplications(signedIn);
    expect(apps.status === "available" && apps.data.every((row) => !row.closedByCancellation)).toBe(true);
  });

  it("detail shows the cancelled panel instead of 'submission rejected'", () => {
    const row = { bountySlug: BOUNTY, status: "rejected" as const, agent: null, closedByCancellation: true };
    expect(deriveActionView(input({ status: "closed", submissions: loaded([row]) }))).toEqual({ kind: "closed", reason: "cancelled" });
    expect(deriveActionView(input({ status: "closed", submissions: loaded([{ ...row, closedByCancellation: undefined }]) })).kind).toBe("submissionRejected");
  });
});

describe("applicationStatusLabel for closed bounties (#32, #33)", () => {
  const t = (key: string) => key;
  const NOW = Date.parse("2026-10-30T00:00:00Z");
  const base = { agent: null, reviewComment: null };

  it("approved on a bounty that no longer takes submissions is not 'submit unlocked'", () => {
    expect(applicationStatusLabel(t, { ...base, status: "approved", bountyStatus: "CANCELLED" }, NOW)).toBe("approvedClosedStatus");
    expect(applicationStatusLabel(t, { ...base, status: "approved", bountyStatus: "OPEN", submissionDeadline: "2026-10-01T00:00:00Z" }, NOW)).toBe("approvedClosedStatus");
  });

  it("approved on an open bounty and approved with unknown bounty state keep today's label", () => {
    expect(applicationStatusLabel(t, { ...base, status: "approved", bountyStatus: "OPEN", submissionDeadline: "2026-12-01T00:00:00Z" }, NOW)).toBe("approvedStatus");
    expect(applicationStatusLabel(t, { ...base, status: "approved" }, NOW)).toBe("approvedStatus");
  });

  it("pending past the deadline reads as closed; pending before it stays 'Applied'", () => {
    expect(applicationStatusLabel(t, { ...base, status: "open", bountyStatus: "OPEN", submissionDeadline: "2026-10-01T00:00:00Z" }, NOW)).toBe("pendingClosedStatus");
    expect(applicationStatusLabel(t, { ...base, status: "open", bountyStatus: "OPEN", submissionDeadline: "2026-12-01T00:00:00Z" }, NOW)).toBe("steps.open");
  });
});

describe("pending application that can no longer be approved (#33)", () => {
  const app = [{ bountySlug: BOUNTY, status: "open" as const, agent: null }];
  const base = { applicationRequired: true, applications: loaded(app) };
  it("past the deadline reads as applications closed", () => {
    expect(deriveActionView(input({ ...base, status: "closed", closedReason: "deadline" }))).toEqual({ kind: "closed", reason: "applications" });
  });
  it("on a reviewing or completed bounty reads as closed", () => {
    expect(deriveActionView(input({ ...base, status: "reviewing" }))).toEqual({ kind: "closed", reason: "reviewing" });
    expect(deriveActionView(input({ ...base, status: "closed", closedReason: "completed" }))).toEqual({ kind: "closed", reason: "closed" });
  });
  it("on an open bounty it is still under review", () => {
    expect(deriveActionView(input(base))).toEqual({ kind: "applicationUnderReview" });
  });
});

describe("session unavailable on detail (#4)", () => {
  it("a failed session check is not 'signed out'", () => {
    expect(deriveActionView(input({ auth: "signed-out", authReason: "unavailable" }))).toEqual({ kind: "sessionUnavailable" });
  });
  it("a plain or ended session still shows the sign-in panel", () => {
    expect(deriveActionView(input({ auth: "signed-out" }))).toEqual({ kind: "signedOut" });
    expect(deriveActionView(input({ auth: "signed-out", authReason: "session-ended" }))).toEqual({ kind: "signedOut" });
  });
});

describe("session unavailable rendering (#4)", () => {
  const unavailableSession: AuthSnapshot = { status: "signed-out", user: null, reason: "unavailable" };

  it("the panel says the sign-in cannot be checked and offers a retry, not a sign-in prompt", () => {
    auth.current = unavailableSession;
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="b-1" status="active" submissionMode="direct" />);
    expect(screen.getByText("We can't check your sign-in right now.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Sign in first")).toBeNull();
  });
});

describe("shared in-flight account reads (#5)", () => {
  it("getApplications and getSubmissions in parallel send one /submissions/me", async () => {
    const { http, calls } = fakeHttp({ "/applications/me": [], "/submissions/me": [] });
    const client = createApiApiClient(http);
    await Promise.all([client.getApplications(signedIn), client.getSubmissions(signedIn)]);
    expect(calls.filter((path) => path === "/submissions/me")).toHaveLength(1);
    expect(calls.filter((path) => path === "/applications/me")).toHaveLength(1);
  });

  it("a read after the first settled goes to the network again (refresh after a mutation)", async () => {
    const { http, calls } = fakeHttp({ "/applications/me": [], "/submissions/me": [] });
    const client = createApiApiClient(http);
    await client.getSubmissions(signedIn);
    await client.getSubmissions(signedIn);
    expect(calls).toEqual(["/submissions/me", "/submissions/me"]);
  });
});

describe("withdraw result is visible (#8)", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  it("pushes the shell flash after a successful withdraw", async () => {
    auth.current = signedInSnapshot;
    const open: AccountApplication = {
      id: "app-1", bountySlug: "b-1", bountyTitle: "Open one", category: "Dev", appliedAt: "2026-10-01T00:00:00Z", note: "hi",
      status: "open", agent: null, reviewComment: null, reviewNote: null, paymentStatus: "NONE",
    };
    let rows = [open];
    apiClient.getApplications = async () => ({ status: "available" as const, data: rows });
    apiClient.withdrawApplication = vi.fn(async () => { rows = []; return { id: "app-1", status: "WITHDRAWN" }; });
    const flashes: string[] = [];
    window.addEventListener(FLASH_EVENT, (event) => flashes.push((event as CustomEvent<string>).detail));
    renderWithIntl(<ApplicationsView />);
    const article = (await screen.findByRole("link", { name: "Open one" })).closest("article") as HTMLElement;
    fireEvent.click(within(article).getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { hidden: true })).getByRole("button", { name: "Withdraw application" }));
    await waitFor(() => expect(flashes).toEqual(["applicationWithdrawn"]));
  });
});
