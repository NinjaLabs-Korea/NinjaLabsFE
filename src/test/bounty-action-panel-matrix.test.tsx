// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import type { AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import type { ApiClient, ApiResult } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { Bounty } from "@/lib/types";
import { renderWithIntl } from "@/test/intl";
import { signedIn } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const auths: Record<AuthSnapshot["status"], AuthSnapshot> = {
  "signed-in": signedIn,
  "signed-out": { status: "signed-out", user: null },
  loading: { status: "loading", user: null },
};

const state: {
  auth: AuthSnapshot;
  applications: Promise<ApiResult<AccountApplication[]>>;
  submissions: Promise<ApiResult<AccountSubmission[]>>;
} = {
  auth: auths["signed-in"],
  applications: Promise.resolve({ status: "available", data: [] }),
  submissions: Promise.resolve({ status: "available", data: [] }),
};

const applyToBounty = vi.fn(async () => ({ id: "a", status: "PENDING" }));
const submitBounty = vi.fn(async () => ({ id: "s", revisionNo: 1, status: "SUBMITTED" }));
const apiClient = {
  getApplications: () => state.applications,
  getSubmissions: () => state.submissions,
  applyToBounty,
  submitBounty,
} as unknown as ApiClient;

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountApi: () => apiClient,
    useBountyApi: () => apiClient,
  }));

type Status = Bounty["status"];
type Mode = "direct" | "agent";
type AuthStatus = AuthSnapshot["status"];

/** What a visitor with no rows on the bounty should see. */
function expected(status: Status, auth: AuthStatus, mode: Mode, applicationRequired: boolean): string {
  if (status !== "active" && (mode === "agent" || auth === "signed-out")) return status === "reviewing" ? "closed:reviewing" : "closed:closed";
  if (mode === "agent") return applicationRequired ? "agent:applications" : "agent:submissions";
  if (auth === "loading") return "checking-session";
  if (auth === "signed-out") return applicationRequired ? "signed-out:apply" : "signed-out:submit";
  if (status !== "active") return status === "reviewing" ? "closed:reviewing" : "closed:closed";
  return applicationRequired ? "form:apply" : "form:submit";
}

async function observed(): Promise<string> {
  await waitFor(() => expect(screen.queryByText(/^Checking your bounty status/)).toBeNull());
  if (screen.queryByRole("heading", { name: "Bounty closed" })) {
    if (screen.queryByText(/sponsor reviews the received work/)) return "closed:reviewing";
    if (screen.queryByText("This bounty is no longer accepting applications or submissions.")) return "closed:closed";
    return "closed:?";
  }
  if (screen.queryByRole("heading", { name: "Agent submission" })) {
    const code = document.querySelector("code")?.textContent ?? "";
    return code.endsWith("/applications") ? "agent:applications" : code.endsWith("/submissions") ? "agent:submissions" : `agent:${code}`;
  }
  if (screen.queryByText("Checking your session…")) return "checking-session";
  if (screen.queryByText("Login required")) {
    return screen.queryByRole("heading", { name: "Apply" }) ? "signed-out:apply" : "signed-out:submit";
  }
  if (screen.queryByRole("button", { name: "Apply" })) return "form:apply";
  if (screen.queryByRole("button", { name: "Submit" })) return "form:submit";
  return `unknown:${document.body.textContent}`;
}

const statuses: Status[] = ["active", "reviewing", "closed"];
const authStatuses: AuthStatus[] = ["signed-in", "signed-out", "loading"];
const modes: Mode[] = ["direct", "agent"];
const matrix = statuses.flatMap((status) =>
  authStatuses.flatMap((auth) => modes.flatMap((mode) => [true, false].map((applicationRequired) => [status, auth, mode, applicationRequired] as const))),
);

describe("BountyActionPanel state matrix (no existing rows)", () => {
  beforeEach(() => {
    state.applications = Promise.resolve({ status: "available", data: [] });
    state.submissions = Promise.resolve({ status: "available", data: [] });
    applyToBounty.mockClear();
    submitBounty.mockClear();
  });

  it.each(matrix)("status=%s auth=%s mode=%s applicationRequired=%s", async (status, auth, mode, applicationRequired) => {
    state.auth = auths[auth];
    renderWithIntl(<BountyActionPanel applicationRequired={applicationRequired} bountyId="bounty-1" status={status} submissionMode={mode} />);
    expect(await observed()).toBe(expected(status, auth, mode, applicationRequired));
  });
});

describe("BountyActionPanel transitional states", () => {
  beforeEach(() => {
    state.auth = auths["signed-in"];
    state.applications = Promise.resolve({ status: "available", data: [] });
    state.submissions = Promise.resolve({ status: "available", data: [] });
    applyToBounty.mockClear();
    submitBounty.mockClear();
  });

  it("names the agent endpoint for the bounty id", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-42" status="active" submissionMode="agent" />);
    expect((await screen.findByText(/^POST /)).textContent).toBe("POST /agent-api/v1/bounties/bounty-42/applications");
    expect(screen.getByRole("link", { name: "Manage my agents" }).getAttribute("href")).toBe("/agents");
  });

  it("shows a checking status until the account reads resolve", async () => {
    let resolve: (value: ApiResult<AccountSubmission[]>) => void = () => undefined;
    state.submissions = new Promise((r) => { resolve = r; });
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(screen.getByText("Checking your bounty status…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit" })).toBeNull();
    resolve({ status: "available", data: [] });
    expect(await screen.findByRole("button", { name: "Submit" })).toBeTruthy();
  });

  it.each(["unauthorized", "server-error", "network-error"] as const)("shows the unavailable copy instead of a form when a read fails (%s)", async (reason) => {
    state.applications = Promise.resolve({ status: "unavailable", reason });
    state.submissions = Promise.resolve({ status: "available", data: [] });
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByText("Your bounty status is temporarily unavailable. Please refresh and try again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("ignores an unavailable applications read on a direct (non-apply) bounty", async () => {
    state.applications = Promise.resolve({ status: "unavailable", reason: "server-error" });
    state.submissions = Promise.resolve({ status: "available", data: [] });
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Submit" })).toBeTruthy();
  });

  it("previews a disabled apply form for signed-out visitors with links to the intake rules and sign-up", async () => {
    state.auth = auths["signed-out"];
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    const note = await screen.findByRole("textbox", { name: "Application note" });
    expect((note.closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "View intake rules" }).getAttribute("href")).toBe("/bounties/apply");
    expect(screen.getByRole("link", { name: "Apply" }).getAttribute("href")).toBe("/signup");
    expect(screen.getByText("Submit disabled until approved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("sends the optional submission fields only when filled", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByLabelText("Completed work link"), { target: { value: "https://example.test/w" } });
    fireEvent.change(screen.getByLabelText("Repository URL (optional)"), { target: { value: "https://github.com/x/y" } });
    fireEvent.change(screen.getByLabelText("Commit SHA (optional)"), { target: { value: "abc1234" } });
    fireEvent.change(screen.getByLabelText("Describe what you completed"), { target: { value: "Done" } });
    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(submitBounty).toHaveBeenCalledTimes(1));
    expect(submitBounty).toHaveBeenCalledWith("bounty-1", {
      submissionUrl: "https://example.test/w",
      description: "Done",
      repositoryUrl: "https://github.com/x/y",
      commitSha: "abc1234",
    });
  });

  it("sends the portfolio link with the application when given", async () => {
    renderWithIntl(<BountyActionPanel applicationRequired bountyId="bounty-1" status="active" submissionMode="direct" />);
    fireEvent.change(await screen.findByLabelText("Application note"), { target: { value: "Hire me" } });
    fireEvent.change(screen.getByLabelText("Relevant work link (optional)"), { target: { value: "https://me.example" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(applyToBounty).toHaveBeenCalledTimes(1));
    expect(applyToBounty).toHaveBeenCalledWith("bounty-1", { message: "Hire me", portfolioUrl: "https://me.example" });
  });
});
