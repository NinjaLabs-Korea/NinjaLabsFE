// QA round 2, package FE-3: what a builder sees for cancelled / closed / unreachable bounty states.
import { describe, expect, it } from "vitest";
import { createApiApiClient } from "@/lib/api/api-client";
import { deriveActionView, type BountyActionInput } from "@/lib/bounty-action-state";
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
