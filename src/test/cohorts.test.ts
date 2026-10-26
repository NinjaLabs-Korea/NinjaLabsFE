import { describe, expect, it } from "vitest";
import {
  ACTIVITY_TYPES,
  INTEREST_AREAS,
  cohortApplicationQuery,
  cohortPhase,
  draftToValues,
  emptyCohortDraft,
  normalizeHandle,
  resolveCohortApplyView,
  validateCohortDraft,
  type CohortFormDraft,
  type MyCohortApplication,
  type PublicCohort,
} from "@/lib/cohorts";

const valid: CohortFormDraft = {
  displayName: "  Mina  ",
  telegram: "https://t.me/mina_builds?start=1",
  twitter: "x.com/mina_builds",
  web3Experience: "Y1_3",
  activityType: "DEVELOPER",
  activityTypeOther: "ignored",
  interestAreas: ["RESEARCHER", "DEVELOPER"],
  interestOther: "ignored",
  intro: "  I build on Injective.  ",
};

describe("normalizeHandle (mirror of the BE)", () => {
  it.each([
    ["name", "@name"],
    ["@name", "@name"],
    ["@@name", "@name"],
    ["  @name  ", "@name"],
    ["https://t.me/name", "@name"],
    ["t.me/name?start=x", "@name"],
    ["http://www.telegram.me/name/", "@name"],
    ["", ""],
    ["   ", ""],
  ])("telegram %j -> %j", (raw, expected) => {
    expect(normalizeHandle(raw, "telegram")).toBe(expected);
  });

  it.each([
    ["https://x.com/name?s=20", "@name"],
    ["https://twitter.com/name", "@name"],
    ["mobile.twitter.com/name#top", "@name"],
    ["name", "@name"],
  ])("twitter %j -> %j", (raw, expected) => {
    expect(normalizeHandle(raw, "twitter")).toBe(expected);
  });
});

describe("validateCohortDraft", () => {
  it("accepts a complete draft and the empty draft reports every required field", () => {
    expect(validateCohortDraft(valid)).toEqual({});
    expect(Object.keys(validateCohortDraft(emptyCohortDraft)).sort()).toEqual(["activityType", "displayName", "interestAreas", "intro", "telegram", "twitter", "web3Experience"]);
  });

  it("checks the handle shapes after normalization", () => {
    expect(validateCohortDraft({ ...valid, telegram: "abc" }).telegram).toBe("invalid");
    expect(validateCohortDraft({ ...valid, telegram: "1abcdef" }).telegram).toBe("invalid");
    expect(validateCohortDraft({ ...valid, twitter: "a".repeat(16) }).twitter).toBe("invalid");
    expect(validateCohortDraft({ ...valid, twitter: "has space" }).twitter).toBe("invalid");
  });

  it("requires the detail of an 'other' choice, and only then", () => {
    expect(validateCohortDraft({ ...valid, activityType: "OTHER", activityTypeOther: " " }).activityTypeOther).toBe("required");
    expect(validateCohortDraft({ ...valid, activityType: "OTHER", activityTypeOther: "Designer" }).activityTypeOther).toBeUndefined();
    expect(validateCohortDraft({ ...valid, interestAreas: ["OTHER"], interestOther: null }).interestOther).toBe("required");
    expect(validateCohortDraft({ ...valid, interestAreas: ["OTHER"], interestOther: "x".repeat(61) }).interestOther).toBe("tooLong");
    expect(validateCohortDraft({ ...valid, activityTypeOther: null }).activityTypeOther).toBeUndefined();
  });

  it("limits the name to 60 and the introduction to 1000 characters (code points, like the BE)", () => {
    expect(validateCohortDraft({ ...valid, displayName: "x".repeat(61) }).displayName).toBe("tooLong");
    expect(validateCohortDraft({ ...valid, intro: "가".repeat(1000) }).intro).toBeUndefined();
    expect(validateCohortDraft({ ...valid, intro: "가".repeat(1001) }).intro).toBe("tooLong");
    expect(validateCohortDraft({ ...valid, intro: "\u{1F600}".repeat(1000) }).intro).toBeUndefined();
    expect(validateCohortDraft({ ...valid, intro: "   " }).intro).toBe("required");
  });
});

describe("draftToValues", () => {
  it("trims, normalizes handles, drops unused 'other' details and orders the interest areas like the form", () => {
    expect(draftToValues(valid)).toEqual({
      displayName: "Mina",
      telegram: "@mina_builds",
      twitter: "@mina_builds",
      web3Experience: "Y1_3",
      activityType: "DEVELOPER",
      activityTypeOther: null,
      interestAreas: ["DEVELOPER", "RESEARCHER"],
      interestOther: null,
      intro: "I build on Injective.",
    });
  });

  it("keeps the detail when 'other' is chosen, and refuses a draft with nothing selected", () => {
    expect(draftToValues({ ...valid, activityType: "OTHER", activityTypeOther: " Designer ", interestAreas: ["OTHER"], interestOther: " UX " })).toMatchObject({ activityTypeOther: "Designer", interestOther: "UX" });
    expect(draftToValues(emptyCohortDraft)).toBeNull();
  });

  it("offers the Tally options: interest areas are the activity types without STUDENT", () => {
    expect(INTEREST_AREAS).toEqual(ACTIVITY_TYPES.filter((type) => type !== "STUDENT"));
  });
});

const cohort = (overrides: Partial<PublicCohort> = {}): PublicCohort => ({ id: "c1", name: "2nd", description: null, opensAt: null, closesAt: null, acceptingApplications: true, ...overrides });
const application = (overrides: Partial<MyCohortApplication> = {}): MyCohortApplication => ({
  ...(draftToValues(valid) as NonNullable<ReturnType<typeof draftToValues>>),
  id: "a1", cohortId: "c1", cohort: { id: "c1", name: "2nd", status: "OPEN", acceptingApplications: true },
  status: "SUBMITTED", reviewedAt: null, editable: true, withdrawable: true, createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
  ...overrides,
});

describe("resolveCohortApplyView", () => {
  it("shows the form when there is no application, and again after a withdrawal (reapply)", () => {
    expect(resolveCohortApplyView(cohort(), [])).toEqual({ kind: "form", reapply: false });
    expect(resolveCohortApplyView(cohort(), [application({ status: "WITHDRAWN" })])).toEqual({ kind: "form", reapply: true });
  });

  it("does not offer the form once the cohort stopped accepting", () => {
    expect(resolveCohortApplyView(cohort({ acceptingApplications: false }), [])).toEqual({ kind: "not-accepting" });
    expect(resolveCohortApplyView(cohort({ acceptingApplications: false }), [application({ status: "WITHDRAWN" })])).toEqual({ kind: "not-accepting" });
  });

  it("follows the application's status, and ignores applications to another cohort", () => {
    expect(resolveCohortApplyView(cohort(), [application()]).kind).toBe("submitted");
    expect(resolveCohortApplyView(cohort(), [application({ status: "ACCEPTED" })]).kind).toBe("accepted");
    expect(resolveCohortApplyView(cohort(), [application({ status: "REJECTED" })]).kind).toBe("rejected");
    expect(resolveCohortApplyView(cohort({ id: "c2" }), [application()])).toEqual({ kind: "form", reapply: false });
  });
});

describe("cohortPhase", () => {
  const now = Date.parse("2026-10-27T00:00:00.000Z");
  it("is open while accepting, upcoming before the opening time, closed otherwise", () => {
    expect(cohortPhase({ acceptingApplications: true, opensAt: null }, now)).toBe("open");
    expect(cohortPhase({ acceptingApplications: false, opensAt: "2026-11-01T00:00:00.000Z" }, now)).toBe("upcoming");
    expect(cohortPhase({ acceptingApplications: false, opensAt: "2026-10-01T00:00:00.000Z" }, now)).toBe("closed");
    expect(cohortPhase({ acceptingApplications: false, opensAt: null }, now)).toBe("closed");
  });
});

describe("cohortApplicationQuery", () => {
  it("builds the filter query shared by the table and the CSV export; blank filters are dropped", () => {
    expect(cohortApplicationQuery({})).toBe("");
    expect(cohortApplicationQuery({ status: "SUBMITTED", activityType: "KOL", interestArea: "BIZDEV", q: "  mi na " }, 2)).toBe("?status=SUBMITTED&activityType=KOL&interestArea=BIZDEV&q=mi+na&page=2");
    expect(cohortApplicationQuery({ q: "  " })).toBe("");
  });
});
