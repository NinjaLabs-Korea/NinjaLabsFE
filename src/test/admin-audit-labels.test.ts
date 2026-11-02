import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { KNOWN_AUDIT_ACTIONS } from "@/lib/admin-audit";
import { BE_AUDIT_ACTIONS, BE_SCRIPT_AUDIT_ACTIONS } from "@/lib/api/be-audit-actions";

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

describe("BE audit action snapshot (lib/api/be-audit-actions.ts)", () => {
  it("is duplicate-free UPPER_SNAKE and the labels cover exactly server + script actions", () => {
    const all = [...BE_AUDIT_ACTIONS, ...BE_SCRIPT_AUDIT_ACTIONS];
    expect(new Set(all).size).toBe(all.length);
    for (const action of all) expect(action).toMatch(/^[A-Z][A-Z0-9_]*$/);
    expect([...KNOWN_AUDIT_ACTIONS].sort()).toEqual([...all].sort());
  });

  // Opt-in against a BE checkout: AUDIT_ACTIONS_BE_FILE=<BE>/src/audit/audit-actions.ts npm run test:unit
  const beFile = process.env.AUDIT_ACTIONS_BE_FILE;
  it.skipIf(!beFile || !existsSync(beFile))("matches the BE audit-actions.ts when AUDIT_ACTIONS_BE_FILE points at it", () => {
    const source = readFileSync(beFile as string, "utf8");
    const keys = (block: string) => [...block.matchAll(/^\s+([A-Z][A-Z0-9_]*): '/gm)].map((m) => m[1]);
    const [server, script] = source.split("export const SCRIPT_AUDIT_ACTIONS");
    expect(keys(server)).toEqual([...BE_AUDIT_ACTIONS]);
    expect(keys(script)).toEqual([...BE_SCRIPT_AUDIT_ACTIONS]);
  });
});
