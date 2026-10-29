import { describe, expect, it } from "vitest";
import * as limits from "@/lib/input-limits";
import { AUDIT_ENTITY_TYPE_MAX } from "@/lib/admin-audit";
import { BOUNTY_TEXT_MAX } from "@/lib/admin-bounty-form";
import { AGENT_NAME_MAX } from "@/lib/agent-register-form";
import { NICKNAME_MAX } from "@/lib/nickname";

/**
 * Pins the FE mirrors of the BE DTO limits (NinjaLabsBE, checked 2026-10-30). Change a number here only together with the DTO:
 *   notices/notice-admin.controller.ts      CreateNoticeDto     title @MaxChars(200), body @MaxLength(50_000)
 *   highlights/highlight-admin.controller.ts CreateHighlightDto title @MaxChars(200), description @MaxLength(2000)
 *   bounties/admin/bounty-admin.dto.ts      CreateBountyDto     title 200, sponsorName 100, description 50_000, requirements/evaluationCriteria 20_000
 *   agents/agents.controller.ts             RegisterAgentDto    name @MaxChars(100), description @MaxLength(1000)
 *   audit/audit.controller.ts               AuditLogsQueryDto   entityType @MaxLength(64)
 *   cohorts/cohort-admin.controller.ts      cohort application search q @MaxChars(320)
 */
describe("input limits mirror the BE DTOs", () => {
  it("pins the admin form limits", () => {
    expect([limits.NOTICE_TITLE_MAX, limits.NOTICE_BODY_MAX]).toEqual([200, 50_000]);
    expect([limits.HIGHLIGHT_TITLE_MAX, limits.HIGHLIGHT_DESCRIPTION_MAX]).toEqual([200, 2000]);
    expect([limits.BOUNTY_TITLE_MAX, limits.BOUNTY_SPONSOR_MAX]).toEqual([200, 100]);
    expect(limits.BOUNTY_TEXT_MAX).toEqual({ description: 50_000, deliverables: 20_000, reviewProcess: 20_000 });
    expect([limits.AGENT_NAME_MAX, limits.AGENT_DESCRIPTION_MAX]).toEqual([100, 1000]);
    expect(limits.AUDIT_ENTITY_TYPE_MAX).toBe(64);
    expect(limits.COHORT_APPLICATION_SEARCH_MAX).toBe(320);
    expect(limits.COHORT_HANDLE_INPUT_MAX).toBe(80);
  });

  it("keeps one source: the old homes re-export the same values", () => {
    expect(AUDIT_ENTITY_TYPE_MAX).toBe(limits.AUDIT_ENTITY_TYPE_MAX);
    expect(BOUNTY_TEXT_MAX).toBe(limits.BOUNTY_TEXT_MAX);
    expect(AGENT_NAME_MAX).toBe(limits.AGENT_NAME_MAX);
    expect(limits.NICKNAME_MAX).toBe(NICKNAME_MAX);
  });
});
