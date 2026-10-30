import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KNOWN_AUDIT_ACTIONS } from "@/lib/admin-audit";

const locales = ["en", "ko", "zh"] as const;
const actionsOf = (locale: string): Record<string, unknown> =>
  (JSON.parse(readFileSync(`messages/${locale}/admin.json`, "utf8")) as { audit: { actions: Record<string, unknown> } }).audit.actions;

describe("audit action labels", () => {
  it.each(locales)("%s has a non-empty label for every known action and no unlisted extras", (locale) => {
    const actions = actionsOf(locale);
    for (const action of KNOWN_AUDIT_ACTIONS) expect(typeof actions[action], `${locale} ${action}`).toBe("string");
    for (const action of KNOWN_AUDIT_ACTIONS) expect((actions[action] as string).trim().length, `${locale} ${action}`).toBeGreaterThan(0);
    expect(Object.keys(actions).sort()).toEqual([...KNOWN_AUDIT_ACTIONS].sort());
  });

  it("covers the codes the BE builds from templates", () => {
    for (const code of [
      "BOUNTY_OPEN", "BOUNTY_SUBMISSION_CLOSED", "BOUNTY_IN_REVIEW", "BOUNTY_COMPLETED", "BOUNTY_CANCELLED",
      "APPLICATION_APPROVED", "APPLICATION_REJECTED",
      "SUBMISSION_APPROVE", "SUBMISSION_REJECT", "SUBMISSION_REQUEST_REVISION", "SUBMISSION_START_REVIEW",
      "PAYOUT_PAID", "COHORT_OPENED", "COHORT_REOPENED", "COHORT_CLOSED",
      "COHORT_APPLICATION_SUBMITTED", "COHORT_APPLICATION_UPDATED", "COHORT_APPLICATION_WITHDRAWN", "COHORT_APPLICATION_REAPPLIED",
      "COHORT_APPLICATION_ACCEPTED", "COHORT_APPLICATION_REJECTED",
    ]) expect(KNOWN_AUDIT_ACTIONS).toContain(code);
  });
});
