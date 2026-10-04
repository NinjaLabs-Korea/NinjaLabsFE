// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import { createApiApiClient } from "@/lib/api/api-client";
import { toApiHttpError, type ApiHttp } from "@/lib/api/http";
import type { AccountApplication, AccountSubmission } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const signedIn: AuthSnapshot = {
  status: "signed-in",
  user: { id: "user-1", handle: "ninja", initials: "NI", profileSlug: "ninja" },
};

const state: { applications: AccountApplication[]; submissions: AccountSubmission[] } = {
  applications: [],
  submissions: [],
};

const apiClient = {
  getApplications: async () => ({ status: "available" as const, data: state.applications }),
  getSubmissions: async () => ({ status: "available" as const, data: state.submissions }),
} as unknown as ApiClient;

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthSnapshot: () => signedIn,
  useFoundationApiClient: () => apiClient,
}));

const application = (status: AccountApplication["status"]): AccountApplication => ({
  bountySlug: "bounty-1",
  bountyTitle: "Bounty",
  category: "Dev",
  appliedAt: "2026-10-01",
  note: "",
  status,
});

describe("BountyActionPanel", () => {
  beforeEach(() => {
    state.applications = [];
    state.submissions = [];
  });

  it("shows the apply form when no application exists", async () => {
    render(<BountyActionPanel applicationRequired bountyId="bounty-1" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("shows review status instead of the apply form after submitting on an apply-type bounty", async () => {
    state.applications = [application("submitted")];
    state.submissions = [{ bountySlug: "bounty-1", status: "in_review" }];
    render(<BountyActionPanel applicationRequired bountyId="bounty-1" submissionMode="direct" />);
    expect(await screen.findByText("Submission under review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update submission" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("shows a rejected application without offering to apply again", async () => {
    state.applications = [application("rejected")];
    render(<BountyActionPanel applicationRequired bountyId="bounty-1" submissionMode="direct" />);
    expect(await screen.findByText("Application not selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("unlocks submission after approval", async () => {
    state.applications = [application("approved")];
    render(<BountyActionPanel applicationRequired bountyId="bounty-1" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Submit" })).toBeTruthy();
  });

  it("offers resubmission on direct bounties when a revision is requested", async () => {
    state.submissions = [{ bountySlug: "bounty-1", status: "revision_requested" }];
    render(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" submissionMode="direct" />);
    expect(await screen.findByRole("button", { name: "Resubmit" })).toBeTruthy();
  });

  it("shows approved direct submissions as final", async () => {
    state.submissions = [{ bountySlug: "bounty-1", status: "approved" }];
    render(<BountyActionPanel applicationRequired={false} bountyId="bounty-1" submissionMode="direct" />);
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
      { id: "a4", status: "APPROVED", message: "", applied_at: "", reviewed_at: null, bounty_id: "b4", bounty_title: "B4", category: "DEV" },
    ],
    "/submissions/me": [
      { status: "REVISION_REQUESTED", bounty_id: "b4" },
      { status: "SUBMITTED", bounty_id: "b5" },
    ],
  };
  const http = { fetchJson: async (path: string) => rows[path] } as unknown as ApiHttp;
  const client = createApiApiClient(http);

  it("keeps rejected applications, drops withdrawn ones, and maps submissions", async () => {
    const applications = await client.getApplications(signedIn);
    expect(applications.status === "available" && applications.data.map((item) => [item.bountySlug, item.status])).toEqual([
      ["b1", "open"],
      ["b2", "rejected"],
      ["b4", "submitted"],
    ]);
    await expect(client.getSubmissions(signedIn)).resolves.toEqual({
      status: "available",
      data: [
        { bountySlug: "b4", status: "revision_requested" },
        { bountySlug: "b5", status: "submitted" },
      ],
    });
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
