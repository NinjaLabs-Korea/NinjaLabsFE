// QA round 2, package FE-3: what a builder sees for cancelled / closed / unreachable bounty states.
import { describe, expect, it } from "vitest";
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
