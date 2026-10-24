// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import { createApiApiClient, unavailableReason } from "@/lib/api/api-client";
import { ApiHttpError, toApiHttpError, type ApiHttp } from "@/lib/api/http";
import type { AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const signedIn: AuthSnapshot = {
  status: "signed-in",
  user: { id: "user-1", handle: "ninja", initials: "NI", profileSlug: "ninja" },
};
const signedOut: AuthSnapshot = { status: "signed-out", user: null };

const state: { auth: AuthSnapshot; applications: AccountApplication[]; submissions: AccountSubmission[] } = {
  auth: signedIn,
  applications: [],
  submissions: [],
};

// Every method a test may stub is listed here so `beforeEach` fully restores the client (Object.assign cannot delete).
const defaultApiClient = {
  getApplications: async () => ({ status: "available" as const, data: state.applications }),
  getSubmissions: async () => ({ status: "available" as const, data: state.submissions }),
  applyToBounty: async () => ({ id: "preview-application", status: "PENDING" }),
  submitBounty: async () => ({ id: "preview-submission", revisionNo: 1, status: "SUBMITTED" }),
};
const apiClient = { ...defaultApiClient } as unknown as ApiClient;

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthSnapshot: () => state.auth,
  useAccountApi: () => apiClient,
  useBountyApi: () => apiClient,
}));

const application = (status: AccountApplication["status"], agent: AccountApplication["agent"] = null): AccountApplication => ({
  id: `application-${status}`,
  bountySlug: "bounty-1",
  bountyTitle: "Bounty",
  category: "Dev",
  appliedAt: "2026-10-01",
  note: "",
  status,
  agent,
});

const submission = (status: AccountSubmission["status"], agent: AccountSubmission["agent"] = null): AccountSubmission => ({ bountySlug: "bounty-1", status, agent });

describe("BountyActionPanel", () => {
  beforeEach(() => {
    state.auth = signedIn;
    state.applications = [];
    state.submissions = [];
    Object.assign(apiClient, defaultApiClient);
  });

  it("shows the closed panel to signed-out visitors instead of the sign-in prompt", async () => {
    state.auth = signedOut;
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="closed" submissionMode="direct" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByText("Login required")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in first" })).toBeNull();

    cleanup();
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Login required")).toBeTruthy();
  });

  it("shows the closed panel instead of the endpoint instructions on a closed agent-mode bounty", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="reviewing" submissionMode="agent" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByText("Agent submission")).toBeNull();
    expect(screen.queryByText(/\/agent-api\/v1\//)).toBeNull();

    cleanup();
    state.auth = signedOut;
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="closed" submissionMode="agent" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();

    cleanup();
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="agent" />);
    expect(await screen.findByText("Agent submission")).toBeTruthy();
  });

  it("shows the apply form when no application exists", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Apply" })).toBeTruthy();
  });

  const agent = { id: "agent-1", name: "market-scout-agent" };

  it.each(["open", "approved"] as const)("shows an informational panel without any form when the owner has only an agent application (%s)", async (status) => {
    state.applications = [application(status, agent)];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("heading", { name: "Handled by your agent" })).toBeTruthy();
    expect(screen.getByText("Your agent market-scout-agent applied to this bounty. Manage that application through the Agent API; this page does not submit on its behalf.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage my agents" }).getAttribute("href")).toBe("/agents");
    // The agent row never unlocks the owner's direct actions: no apply form, no submit form (even for an approved agent application).
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    expect(screen.queryByText("Application under review")).toBeNull();
  });

  it("shows the informational panel when only the agent has submitted (apply-type and direct bounties)", async () => {
    state.applications = [application("submitted", agent)];
    state.submissions = [submission("in_review", agent)];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("heading", { name: "Handled by your agent" })).toBeTruthy();
    expect(screen.getByText(/Your agent market-scout-agent submitted work/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update submission" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resubmit" })).toBeNull();

    cleanup();
    state.applications = [];
    state.submissions = [submission("revision_requested", agent)];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("heading", { name: "Handled by your agent" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resubmit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("prefers the owner's own rows over agent rows on the same bounty", async () => {
    // Agent row first in the list: list order must not decide.
    state.applications = [application("open", { id: "agent-1", name: "market-scout-agent" }), { ...application("approved"), id: "own" }];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Submit" })).toBeTruthy();
    expect(screen.queryByText("Application under review")).toBeNull();
    expect(screen.queryByText(/Applied via your agent/)).toBeNull();

    cleanup();
    state.applications = [];
    state.submissions = [submission("in_review", { id: "agent-1", name: "market-scout-agent" }), submission("approved")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Submission approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update submission" })).toBeNull();
  });

  it("closes new applications and submissions while the bounty is reviewing or closed", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="reviewing" submissionMode="direct" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();

    cleanup();
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="closed" submissionMode="direct" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("locks an in-review submission but still allows resubmission on a reviewing bounty when a revision is requested", async () => {
    state.submissions = [submission("in_review")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="reviewing" submissionMode="direct" />);
    expect(await screen.findByText("Submission under review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update submission" })).toBeNull();

    cleanup();
    state.submissions = [submission("revision_requested")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="reviewing" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Resubmit" })).toBeTruthy();
  });

  it("refetches applications after a successful apply", async () => {
    const applyToBounty = vi.fn(async () => {
      state.applications = [application("open")];
      return { id: "a-new", status: "PENDING" };
    });
    const getApplications = vi.fn(async () => ({ status: "available" as const, data: state.applications }));
    Object.assign(apiClient, { applyToBounty, getApplications });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByPlaceholderText("Application note"), { target: { value: "Hi" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form") as HTMLFormElement);
    expect(await screen.findByText("Application under review")).toBeTruthy();
    await waitFor(() => expect(getApplications).toHaveBeenCalledTimes(2));
    expect(applyToBounty).toHaveBeenCalledWith("bounty-1", { message: "Hi" });
  });

  it("refetches submissions after a successful submit", async () => {
    const submitBounty = vi.fn(async () => {
      state.submissions = [submission("submitted")];
      return { id: "s-new", revisionNo: 1, status: "SUBMITTED" };
    });
    const getSubmissions = vi.fn(async () => ({ status: "available" as const, data: state.submissions }));
    Object.assign(apiClient, { submitBounty, getSubmissions });
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByLabelText("Completed work link"), { target: { value: "https://example.test/work" } });
    fireEvent.change(screen.getByLabelText("Describe what you completed"), { target: { value: "Done" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form") as HTMLFormElement);
    expect(await screen.findByRole("heading", { name: "Submission under review" })).toBeTruthy();
    await waitFor(() => expect(getSubmissions).toHaveBeenCalledTimes(2));
    expect(submitBounty).toHaveBeenCalledWith("bounty-1", { submissionUrl: "https://example.test/work", description: "Done" });
  });

  it("restores the default apply/submit stubs between tests", async () => {
    // The previous tests replaced applyToBounty/submitBounty; beforeEach must have put the defaults back.
    await expect(apiClient.applyToBounty("bounty-1", { message: "x" })).resolves.toEqual({ id: "preview-application", status: "PENDING" });
    await expect(apiClient.submitBounty("bounty-1", { submissionUrl: "https://x.test", description: "d" })).resolves.toEqual({ id: "preview-submission", revisionNo: 1, status: "SUBMITTED" });
  });

  it("shows review status instead of the apply form after submitting on an apply-type bounty", async () => {
    state.applications = [application("submitted")];
    state.submissions = [submission("in_review")];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Submission under review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update submission" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("shows a rejected application without offering to apply again", async () => {
    state.applications = [application("rejected")];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Application not selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("unlocks submission after approval", async () => {
    state.applications = [application("approved")];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Submit" })).toBeTruthy();
  });

  it("offers resubmission on direct bounties when a revision is requested", async () => {
    state.submissions = [submission("revision_requested")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Resubmit" })).toBeTruthy();
  });

  it("does not offer resubmission on a closed bounty even when a revision was requested (BE isInProgress)", async () => {
    state.submissions = [submission("revision_requested")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="closed" submissionMode="direct" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resubmit" })).toBeNull();

    cleanup();
    state.applications = [application("submitted")];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="closed" submissionMode="direct" />);
    expect(await screen.findByText("Bounty closed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resubmit" })).toBeNull();
  });

  it("labels the signed-in apply form and wires the API error to its inputs", async () => {
    const applyToBounty = vi.fn(async () => { throw new ApiHttpError(409, "MAX_WINNERS_REACHED"); });
    Object.assign(apiClient, { applyToBounty });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    const note = await screen.findByLabelText("Application note");
    const portfolio = screen.getByLabelText("Relevant work link (optional)");
    expect(note.getAttribute("aria-invalid")).toBeNull();
    fireEvent.change(note, { target: { value: "Hi" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form") as HTMLFormElement);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("This bounty has already reached its maximum number of winners.");
    expect(note.getAttribute("aria-invalid")).toBe("true");
    expect(portfolio.getAttribute("aria-invalid")).toBe("true");
    expect(note.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert.id).not.toBe("");
  });

  it.each([
    ["INVALID_CHARACTER", 400, "Your text contains characters that cannot be saved (for example a NUL byte). Remove them and try again."],
    ["REFERENCE_NOT_FOUND", 400, "Something this request refers to no longer exists. Reload the page and try again."],
    ["BOUNTY_NOT_FOUND", 404, "This bounty no longer exists."],
  ])("maps the BE %s code to localized copy", async (code, status, copy) => {
    const applyToBounty = vi.fn(async () => { throw new ApiHttpError(status, code); });
    Object.assign(apiClient, { applyToBounty });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByLabelText("Application note"), { target: { value: "Hi" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form") as HTMLFormElement);
    expect((await screen.findByRole("alert")).textContent).toBe(copy);
  });

  it("labels the submit form and falls back to a localized generic message for unknown codes", async () => {
    state.applications = [application("approved")];
    const submitBounty = vi.fn(async () => { throw new ApiHttpError(418, "TEAPOT_BUSY"); });
    Object.assign(apiClient, { submitBounty });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    const url = await screen.findByLabelText("Completed work link");
    expect(screen.getByLabelText("Repository URL (optional)")).toBeTruthy();
    expect(screen.getByLabelText("Commit SHA (optional)")).toBeTruthy();
    fireEvent.change(url, { target: { value: "https://example.test/work" } });
    fireEvent.change(screen.getByLabelText("Describe what you completed"), { target: { value: "Done" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form") as HTMLFormElement);

    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong (TEAPOT_BUSY). Please try again.");
    expect(screen.queryByText("teapot busy")).toBeNull();
  });

  it("moves focus to the status heading and announces the success copy after applying", async () => {
    const applyToBounty = vi.fn(async () => ({ id: "a-new", status: "PENDING" }));
    Object.assign(apiClient, { applyToBounty });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByLabelText("Application note"), { target: { value: "Hi" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form") as HTMLFormElement);

    const heading = await screen.findByRole("heading", { name: "Application under review" });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
    const liveRegion = document.querySelector("[aria-live=\"polite\"]");
    await waitFor(() => expect(liveRegion?.textContent).toBe("Application received. You can track it from My applications."));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows approved direct submissions as final", async () => {
    state.submissions = [submission("approved")];
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Submission approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
  });
});

describe("api client application mapping", () => {
  const rows: Record<string, unknown> = {
    "/applications/me": [
      { id: "a1", status: "PENDING", message: "", applied_at: "", reviewed_at: null, bounty_id: "b1", bounty_title: "B1", category: "DEV" },
      { id: "a2", status: "REJECTED", message: "", applied_at: "", reviewed_at: null, bounty_id: "b2", bounty_title: "B2", category: "DEV" },
      { id: "a3", status: "WITHDRAWN", message: "", applied_at: "", reviewed_at: null, bounty_id: "b3", bounty_title: "B3", category: "DEV" },
      { id: "a4", status: "APPROVED", message: "", applied_at: "", reviewed_at: null, bounty_id: "b4", bounty_title: "B4", category: "DEV", agent: null },
      { id: "a5", status: "PENDING", message: "", applied_at: "", reviewed_at: null, bounty_id: "b5", bounty_title: "B5", category: "DEV", agent: { id: "agent-1", name: "scout" } },
      // Owner and agent rows on the same bounty: only the agent has submitted.
      { id: "a6", status: "APPROVED", message: "", applied_at: "", reviewed_at: null, bounty_id: "b6", bounty_title: "B6", category: "DEV", agent: null },
      { id: "a7", status: "APPROVED", message: "", applied_at: "", reviewed_at: null, bounty_id: "b6", bounty_title: "B6", category: "DEV", agent: { id: "agent-1", name: "scout" } },
    ],
    "/submissions/me": [
      { status: "REVISION_REQUESTED", bounty_id: "b4" },
      { status: "SUBMITTED", bounty_id: "b5", agent: { id: "agent-1", name: "scout" } },
      { status: "APPROVED", bounty_id: "b6", agent: { id: "agent-1", name: "scout" } },
    ],
    "/agents/me": [
      { id: "agent-1", name: "scout", description: null, status: "ACTIVE", wallet_address: "0xabc", verified_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", completed_bounties: 2, key_prefix: "nl_live_1234", key_status: "ACTIVE", key_expires_at: "2027-01-01T00:00:00Z" },
      { id: "agent-2", name: "old", description: null, status: "REVOKED", wallet_address: "0xdef", verified_at: null, created_at: "2026-01-01T00:00:00Z", completed_bounties: 0, key_prefix: null, key_status: null, key_expires_at: null },
    ],
  };
  const http = { fetchJson: async (path: string) => rows[path] } as unknown as ApiHttp;
  const client = createApiApiClient(http);

  it("keeps rejected applications, drops withdrawn ones, carries the agent, and maps submissions", async () => {
    const applications = await client.getApplications(signedIn);
    expect(applications.status === "available" && applications.data.map((item) => [item.bountySlug, item.status, item.agent?.name ?? null])).toEqual([
      ["b1", "open", null],
      ["b2", "rejected", null],
      ["b4", "submitted", null],
      ["b5", "open", "scout"],
      // The agent's submission does not complete the owner's own application.
      ["b6", "approved", null],
      ["b6", "completed", "scout"],
    ]);
    await expect(client.getSubmissions(signedIn)).resolves.toEqual({
      status: "available",
      data: [
        { bountySlug: "b4", status: "revision_requested", agent: null },
        { bountySlug: "b5", status: "submitted", agent: { id: "agent-1", name: "scout" } },
        { bountySlug: "b6", status: "approved", agent: { id: "agent-1", name: "scout" } },
      ],
    });
  });

  it("maps agent key status and expiry, and masks the key", async () => {
    const agents = await client.getAgents(signedIn);
    expect(agents.status === "available" && agents.data.map(({ id, status, verified, keyStatus, keyExpiresAt, apiKeyMasked }) => ({ id, status, verified, keyStatus, keyExpiresAt, apiKeyMasked }))).toEqual([
      { id: "agent-1", status: "ACTIVE", verified: true, keyStatus: "ACTIVE", keyExpiresAt: "2027-01-01T00:00:00Z", apiKeyMasked: "nl_live_1234••••••••" },
      { id: "agent-2", status: "REVOKED", verified: false, keyStatus: null, keyExpiresAt: null, apiKeyMasked: "-" },
    ]);
  });

  it("posts key rotation and revocation to the agent endpoints", async () => {
    const calls: Array<[string, unknown]> = [];
    const rotating = createApiApiClient({ fetchJson: async (path: string, init?: unknown) => { calls.push([path, init]); return { agentId: "agent-1" }; } } as unknown as ApiHttp);
    await rotating.rotateAgentKey("agent-1");
    await rotating.revokeAgent("agent 2");
    expect(calls).toEqual([
      ["/agents/agent-1/keys/rotate", { method: "POST" }],
      ["/agents/agent%202/revoke", { method: "POST" }],
    ]);
  });
});

describe("account read unavailability", () => {
  const failing = (error: unknown) => createApiApiClient({ fetchJson: async () => { throw error; } } as unknown as ApiHttp);

  it("distinguishes a rejected session from server and network failures", async () => {
    expect(unavailableReason(new ApiHttpError(401, "UNAUTHORIZED"))).toBe("unauthorized");
    expect(unavailableReason(new ApiHttpError(403, "FORBIDDEN"))).toBe("unauthorized");
    expect(unavailableReason(new ApiHttpError(500, "UNKNOWN_ERROR"))).toBe("server-error");
    expect(unavailableReason(new ApiHttpError(503, "REFRESH_UNAVAILABLE"))).toBe("server-error");
    expect(unavailableReason(new ApiHttpError(0, "REFRESH_UNAVAILABLE"))).toBe("network-error");
    expect(unavailableReason(new TypeError("fetch failed"))).toBe("network-error");

    await expect(failing(new ApiHttpError(401, "UNAUTHORIZED")).getApplications(signedIn)).resolves.toEqual({ status: "unavailable", reason: "unauthorized" });
    await expect(failing(new ApiHttpError(502, "UNKNOWN_ERROR")).getAgents(signedIn)).resolves.toEqual({ status: "unavailable", reason: "server-error" });
    await expect(failing(new TypeError("fetch failed")).getSubmissions(signedIn)).resolves.toEqual({ status: "unavailable", reason: "network-error" });
  });
});

describe("api error normalization", () => {
  it("collapses Nest validation arrays into a string code", async () => {
    const validation = await toApiHttpError(new Response(JSON.stringify({ statusCode: 400, message: ["submissionUrl must be a URL"] }), { status: 400 }));
    expect(validation.code).toBe("VALIDATION_FAILED");
    const conflict = await toApiHttpError(new Response(JSON.stringify({ statusCode: 409, message: "NICKNAME_TAKEN" }), { status: 409 }));
    expect([conflict.status, conflict.code]).toEqual([409, "NICKNAME_TAKEN"]);
    const empty = await toApiHttpError(new Response("oops", { status: 500 }));
    expect(empty.code).toBe("UNKNOWN_ERROR");
  });
});
