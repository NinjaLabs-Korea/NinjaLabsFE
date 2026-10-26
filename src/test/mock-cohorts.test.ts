import { describe, expect, it } from "vitest";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { getMockFixtureSnapshot, createMockFixtures } from "@/lib/mocks/fixtures";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { CohortApplicationValues } from "@/lib/cohorts";

const owner = (): AuthSnapshot => ({ status: "signed-in", user: getMockFixtureSnapshot(createMockFixtures("default")).account.user });
const stranger: AuthSnapshot = { status: "signed-in", user: { id: "someone-else", handle: "x", initials: "X", profileSlug: "x" } };
const values: CohortApplicationValues = {
  displayName: "Me", telegram: "@me_builds", twitter: "@me_builds", web3Experience: "GT_3Y", activityType: "DEVELOPER",
  activityTypeOther: null, interestAreas: ["DEVELOPER"], interestOther: null, intro: "hi",
};
const mine = async (api: ReturnType<typeof createMockApiClient>) => {
  const result = await api.getMyCohortApplications(owner());
  if (result.status !== "available") throw new Error("unavailable");
  return result.data;
};
const code = async (promise: Promise<unknown>) => promise.then(() => null, (error: { status: number; code: string }) => `${error.status} ${error.code}`);

describe("mock cohort recruitment (BE twin)", () => {
  it("starts with an open, accepting cohort and no application of mine", async () => {
    const api = createMockApiClient();
    expect(await api.getCurrentCohort()).toMatchObject({ id: "cohort-2", acceptingApplications: true });
    expect(await mine(api)).toEqual([]);
    expect(await api.getMyCohortApplications(stranger)).toEqual({ status: "available", data: [] });
  });

  it("apply -> edit -> withdraw -> reapply keeps one row per cohort and never shows the review note", async () => {
    const api = createMockApiClient();
    const created = await api.applyToCohort("cohort-2", values);
    expect(created).toMatchObject({ status: "SUBMITTED", editable: true, withdrawable: true });
    expect(created).not.toHaveProperty("reviewNote");
    expect(await code(api.applyToCohort("cohort-2", values))).toBe("409 COHORT_ALREADY_APPLIED");
    expect(await api.updateCohortApplication(created.id, { ...values, intro: "changed" })).toMatchObject({ intro: "changed" });
    await api.withdrawCohortApplication(created.id);
    expect(await code(api.withdrawCohortApplication(created.id))).toBe("409 COHORT_APPLICATION_NOT_SUBMITTED");
    expect(await code(api.updateCohortApplication(created.id, values))).toBe("409 COHORT_APPLICATION_NOT_SUBMITTED");
    const again = await api.applyToCohort("cohort-2", values);
    expect(again.id).toBe(created.id);
    expect(again.status).toBe("SUBMITTED");
    expect(await mine(api)).toHaveLength(1);
  });

  it("requires the detail of 'other' (400) and refuses unknown, draft and closed cohorts", async () => {
    const api = createMockApiClient();
    expect(await code(api.applyToCohort("cohort-2", { ...values, activityType: "OTHER" }))).toBe("400 COHORT_OTHER_DETAIL_REQUIRED");
    expect(await code(api.applyToCohort("nope", values))).toBe("404 COHORT_NOT_FOUND");
    const draft = await api.saveAdminCohort(null, { name: "draft", description: null, opensAt: null, closesAt: null });
    expect(await code(api.applyToCohort(draft.id, values))).toBe("404 COHORT_NOT_FOUND");
    expect(await code(api.applyToCohort("cohort-1", values))).toBe("409 COHORT_NOT_ACCEPTING");
  });

  it("closing stops edits but not withdrawals, and the admin sees the decision while the applicant only sees the status", async () => {
    const api = createMockApiClient();
    const created = await api.applyToCohort("cohort-2", values);
    const reviewed = await api.reviewAdminCohortApplication(created.id, { decision: "ACCEPTED", note: "  keep  " });
    expect(reviewed).toMatchObject({ status: "ACCEPTED", reviewNote: "keep" });
    const [row] = await mine(api);
    expect(row.status).toBe("ACCEPTED");
    expect(row).not.toHaveProperty("reviewNote");
    expect(await api.reviewAdminCohortApplication(created.id, { decision: "REJECTED" })).toMatchObject({ status: "REJECTED", reviewNote: null });

    const second = createMockApiClient();
    const mineSubmitted = await second.applyToCohort("cohort-2", values);
    await second.transitionAdminCohort("cohort-2", "CLOSED");
    expect(await code(second.updateCohortApplication(mineSubmitted.id, values))).toBe("409 COHORT_NOT_ACCEPTING");
    await second.withdrawCohortApplication(mineSubmitted.id);
    expect(await code(second.reviewAdminCohortApplication(mineSubmitted.id, { decision: "ACCEPTED" }))).toBe("409 COHORT_APPLICATION_WITHDRAWN");
  });

  it("enforces one open cohort, the transition table, the window and the delete guard", async () => {
    const api = createMockApiClient();
    const draft = await api.saveAdminCohort(null, { name: "3rd", description: null, opensAt: null, closesAt: null });
    expect(draft.status).toBe("DRAFT");
    expect(draft.allowedTransitions).toEqual(["OPEN"]);
    expect(await code(api.transitionAdminCohort(draft.id, "OPEN"))).toBe("409 COHORT_ALREADY_OPEN");
    expect(await code(api.transitionAdminCohort(draft.id, "CLOSED"))).toBe("400 COHORT_INVALID_TRANSITION");
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    expect((await api.transitionAdminCohort(draft.id, "OPEN")).acceptingApplications).toBe(true);
    expect((await api.transitionAdminCohort("cohort-2", "OPEN").catch((error: { code: string }) => error.code))).toBe("COHORT_ALREADY_OPEN");
    expect((await api.transitionAdminCohort(draft.id, "CLOSED")).allowedTransitions).toEqual(["OPEN"]);
    expect(await code(api.saveAdminCohort(null, { name: "x", description: null, opensAt: "2026-12-01T00:00:00.000Z", closesAt: "2026-12-01T00:00:00.000Z" }))).toBe("400 COHORT_INVALID_WINDOW");
    expect(await code(api.deleteAdminCohort("cohort-2"))).toBe("409 COHORT_HAS_APPLICATIONS");
    await api.deleteAdminCohort(draft.id);
    expect((await api.getAdminCohorts()).map((cohort) => cohort.id)).not.toContain(draft.id);
  });

  it("a window in the future is open but not accepting", async () => {
    const api = createMockApiClient();
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    const future = await api.saveAdminCohort(null, { name: "later", description: null, opensAt: new Date(Date.now() + 86_400_000).toISOString(), closesAt: null });
    const opened = await api.transitionAdminCohort(future.id, "OPEN");
    expect(opened).toMatchObject({ status: "OPEN", acceptingApplications: false });
    expect(await api.getCurrentCohort()).toMatchObject({ id: future.id, acceptingApplications: false });
  });

  it("filters, searches and pages the applications, and the CSV carries the same filter", async () => {
    const api = createMockApiClient();
    const all = await api.getAdminCohortApplications("cohort-2", {}, 1);
    expect(all).toMatchObject({ page: 1, pageSize: 30, total: 4 });
    expect((await api.getAdminCohortApplications("cohort-2", { status: "ACCEPTED" }, 1)).items.map((row) => row.displayName)).toEqual(["Joon"]);
    expect((await api.getAdminCohortApplications("cohort-2", { activityType: "STUDENT" }, 1)).total).toBe(1);
    expect((await api.getAdminCohortApplications("cohort-2", { interestArea: "KOL" }, 1)).total).toBe(1);
    expect((await api.getAdminCohortApplications("cohort-2", { q: "MINA" }, 1)).items.map((row) => row.displayName)).toEqual(["Mina"]);
    expect((await api.getAdminCohortApplications("cohort-2", {}, 2)).items).toEqual([]);
    const csv = await api.exportAdminCohortApplications("cohort-2", { status: "REJECTED" });
    expect(csv.startsWith("﻿\"id\",\"applied_at\"")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
    expect(await code(api.getAdminCohortApplications("nope", {}, 1))).toBe("404 COHORT_NOT_FOUND");
  });

  it("neutralizes spreadsheet formulas in the CSV", async () => {
    const api = createMockApiClient();
    await api.applyToCohort("cohort-2", { ...values, displayName: "=HYPERLINK(\"x\")" });
    const csv = await api.exportAdminCohortApplications("cohort-2", { q: "HYPERLINK" });
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
});
