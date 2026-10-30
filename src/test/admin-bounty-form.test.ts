import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminBounties } from "@/lib/admin";
import { BOUNTY_SPONSOR_MAX, BOUNTY_TITLE_MAX } from "@/lib/input-limits";
import {
  bountyToForm,
  emptyBountyForm,
  formToBounty,
  fromLocalDateTimeInput,
  isIsoDateTime,
  toLocalDateTimeInput,
  validateBountyForm,
  type BountyFormValues,
} from "@/lib/admin-bounty-form";

describe("admin bounty form mapping", () => {
  it("round-trips an existing bounty while keeping its status", () => {
    const bounty = { ...getAdminBounties()[0], deadline: "2026-07-14T23:59:00.000Z" };
    const saved = formToBounty(bountyToForm(bounty), {
      slug: bounty.slug,
      coverImage: bounty.coverImage,
      existingStatus: bounty.status,
    });

    expect(saved).toMatchObject({
      slug: bounty.slug,
      title: bounty.title,
      reward: bounty.reward,
      deliverables: bounty.deliverables,
      status: bounty.status,
    });
  });

  it("leaves the amount empty for a bounty without a reward so its other fields can still be edited", () => {
    const bounty = { ...getAdminBounties()[0], deadline: "2020-01-01T00:00:00.000Z", reward: { amount: 0, currency: "INJ" as const } };
    const form = bountyToForm(bounty);
    expect(form.amount).toBe("");
    // Past deadline left untouched + title edited: nothing blocks the save.
    expect(validateBountyForm({ ...form, title: "Renamed" }, { now: new Date("2026-10-24T00:00:00.000Z") })).toEqual({});
    expect(formToBounty({ ...form, title: "Renamed" }, { slug: bounty.slug, coverImage: null, existingStatus: bounty.status }).reward).toEqual({ amount: 0, currency: "INJ" });
  });

  it("starts new bounties as funding only when a reward amount is set", () => {
    const base = { ...emptyBountyForm(), deadline: "2026-07-14T23:59" };
    expect(formToBounty(base, { slug: "", coverImage: null }).status).toBe("draft");
    expect(formToBounty({ ...base, amount: "10" }, { slug: "", coverImage: null }).status).toBe("funding");
  });

  it("re-sends the raw requirements string unchanged while the input is untouched, and loads the raw text (not the parsed list)", () => {
    const raw = "- Repo\n\n  - nested item\n\nClosing note";
    const bounty = { ...getAdminBounties()[0], deadline: "2026-07-14T23:59:00.000Z", requirements: raw, submissionGuide: raw, deliverables: ["- Repo", "- nested item", "Closing note"] };
    const form = bountyToForm(bounty);
    // The input shows everything stored, including the prose a bullet-only list would drop.
    expect(form.deliverables).toBe(raw);
    // Untouched: byte-identical, blank lines and indentation included.
    expect(formToBounty(form, { slug: bounty.slug, coverImage: null }).requirements).toBe(raw);
    // Edited: the typed text is saved as typed (trimmed at the ends), line breaks and prose kept.
    const edited = formToBounty({ ...form, deliverables: " Demo\n\nHow reviewers check it:\n- Docs " }, { slug: bounty.slug, coverImage: null });
    expect(edited.requirements).toBe("Demo\n\nHow reviewers check it:\n- Docs");
    expect(edited.submissionGuide).toBe(edited.requirements);
    expect(edited.deliverables).toEqual(["Demo", "How reviewers check it:", "- Docs"]);
    // New bounty.
    expect(formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59", deliverables: "Repo" }, { slug: "", coverImage: null }).requirements).toBe("Repo");
  });

  it("keeps guide prose and bullets together through a create and an edit (no field is dropped or overwritten)", () => {
    const typed = "Submit the repo link.\n- D1\n- D2";
    const created = formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59", deliverables: typed }, { slug: "", coverImage: null });
    expect(created.requirements).toBe(typed);
    const reopened = bountyToForm({ ...getAdminBounties()[0], deadline: "2026-07-14T23:59:00.000Z", requirements: created.requirements, submissionGuide: created.requirements, deliverables: created.deliverables });
    expect(reopened.deliverables).toBe(typed);
    expect(formToBounty(reopened, { slug: "x", coverImage: null }).requirements).toBe(typed);
  });

  it("empties the deadline input for a non-ISO stored value and flags it instead of accepting it silently", () => {
    const form = bountyToForm({ ...getAdminBounties()[0], deadline: "07.14" });
    expect(form.deadline).toBe("");
    expect(validateBountyForm({ ...form, title: "T", sponsor: "S", description: "D", deliverables: "R", reviewProcess: "P" }).deadline).toBe("deadlineInvalid");
    // Fixture deadlines themselves are ISO, so the mock admin table and form never hit this path.
    for (const bounty of getAdminBounties()) expect(bounty.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("trims blank deliverable lines", () => {
    const form = { ...emptyBountyForm(), deadline: "2026-07-14T23:59", deliverables: " Repo \n\n Demo " };
    expect(formToBounty(form, { slug: "", coverImage: null }).deliverables).toEqual(["Repo", "Demo"]);
  });

  it("keeps the loaded record's maxWinners and application deadline on edit, and defaults to 1 on create", () => {
    const bounty = { ...getAdminBounties()[0], deadline: "2026-07-14T23:59:00.000Z", maxWinners: 3, applicationDeadline: "2026-07-01T00:00:00.000Z" };
    const edited = formToBounty(bountyToForm(bounty), { slug: bounty.slug, coverImage: null, existingStatus: bounty.status });
    expect(edited.maxWinners).toBe(3);
    expect(edited.applicationDeadline).toBe("2026-07-01T00:00:00.000Z");
    const created = formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59" }, { slug: "", coverImage: null });
    expect(created.maxWinners).toBe(1);
    expect(created.applicationDeadline).toBeNull();
  });

  it("sends the admin's max winners on create and edit, and rejects values the BE refuses", () => {
    const form = { ...emptyBountyForm(), deadline: "2026-07-14T23:59", maxWinners: " 4 " };
    expect(formToBounty(form, { slug: "", coverImage: null }).maxWinners).toBe(4);
    for (const bad of ["", "0", "-1", "1.5", "1e2", "abc", "1001", "2147483648"]) {
      expect(validateBountyForm({ ...{ ...emptyBountyForm(), title: "T", sponsor: "S", description: "D", deliverables: "R", reviewProcess: "P", deadline: "2026-07-14T23:59" }, maxWinners: bad }, { now: new Date("2026-01-01") }).maxWinners, bad).toBe("maxWinnersInvalid");
    }
    for (const ok of ["1", "3", "1000"]) {
      expect(validateBountyForm({ ...{ ...emptyBountyForm(), title: "T", sponsor: "S", description: "D", deliverables: "R", reviewProcess: "P", deadline: "2026-07-14T23:59" }, maxWinners: ok }, { now: new Date("2026-01-01") }).maxWinners, ok).toBeUndefined();
    }
  });
});

// `process.env.TZ` is honoured by V8 at runtime, so each block really runs under that zone (see members-data.test.ts).
describe.each([
  { tz: "Asia/Seoul", local: "2026-07-14T23:59" },
  { tz: "UTC", local: "2026-07-14T14:59" },
])("deadline round-trip under TZ=$tz", ({ tz, local }) => {
  const iso = "2026-07-14T14:59:00.000Z";
  const previousTimeZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  });

  it("renders the ISO deadline with LOCAL components and parses it back to the same instant", () => {
    expect(toLocalDateTimeInput(iso)).toBe(local);
    expect(fromLocalDateTimeInput(local)).toBe(iso);
    expect(toLocalDateTimeInput("not a date")).toBe("");
  });

  it("re-sends an untouched deadline byte-identical, even with seconds the input cannot hold", () => {
    const stored = "2026-07-14T14:59:37.123Z";
    const bounty = { ...getAdminBounties()[0], deadline: stored };
    const form = bountyToForm(bounty);
    expect(form.originalSubmissionDeadline).toBe(stored);
    const saved = formToBounty(form, { slug: bounty.slug, coverImage: null, existingStatus: bounty.status });
    expect(saved.deadline).toBe(stored);
    // Saving twice still yields the same value: the round-trip is the identity, not a 9-hour drift per save.
    expect(formToBounty(bountyToForm(saved), { slug: saved.slug, coverImage: null }).deadline).toBe(stored);
  });

  it("re-sends an untouched PAST deadline unchanged and does not flag it as past", () => {
    const past = "2020-01-01T10:00:00.000Z";
    const form = { ...bountyToForm({ ...getAdminBounties()[0], deadline: past }), title: "T", sponsor: "S", description: "D", deliverables: "R", reviewProcess: "P" };
    expect(validateBountyForm(form, { now: new Date("2026-07-01T00:00:00Z") })).toEqual({});
    expect(formToBounty(form, { slug: "x", coverImage: null }).deadline).toBe(past);
  });

  it("converts an edited local value through the zone it was typed in", () => {
    const form = { ...bountyToForm({ ...getAdminBounties()[0], deadline: iso }), deadline: "2026-07-15T09:30" };
    const expected = new Date("2026-07-15T09:30").toISOString();
    expect(formToBounty(form, { slug: "x", coverImage: null }).deadline).toBe(expected);
    expect(expected).toBe(tz === "UTC" ? "2026-07-15T09:30:00.000Z" : "2026-07-15T00:30:00.000Z");
  });
});

describe("admin bounty form validation", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  const valid: BountyFormValues = {
    ...emptyBountyForm(),
    title: "Build a widget",
    sponsor: "Injective",
    deadline: "2026-07-14T23:59",
    description: "Ship a reusable widget.",
    deliverables: "Repo",
    reviewProcess: "Sponsor review",
  };

  it("accepts a complete form", () => {
    expect(validateBountyForm(valid, { now })).toEqual({});
  });

  it("flags blank required fields, including whitespace-only values", () => {
    const errors = validateBountyForm({ ...emptyBountyForm(), title: "   " }, { now });
    expect(errors).toMatchObject({
      title: "required",
      sponsor: "required",
      deadline: "required",
      description: "required",
      reviewProcess: "required",
      deliverables: "deliverablesRequired",
    });
  });

  it("rejects a past deadline on create but keeps an unchanged one on edit", () => {
    const past = { ...valid, deadline: "2020-01-01T10:00" };
    expect(validateBountyForm(past, { now }).deadline).toBe("deadlinePast");
    expect(validateBountyForm(past, { now, originalDeadline: past.deadline }).deadline).toBeUndefined();
  });

  it("enforces the BE title (200) and sponsor (100) length caps after trimming", () => {
    expect(validateBountyForm({ ...valid, title: "t".repeat(BOUNTY_TITLE_MAX) }, { now })).toEqual({});
    expect(validateBountyForm({ ...valid, title: "t".repeat(BOUNTY_TITLE_MAX + 1) }, { now }).title).toBe("titleTooLong");
    expect(validateBountyForm({ ...valid, sponsor: "s".repeat(BOUNTY_SPONSOR_MAX + 1) }, { now }).sponsor).toBe("sponsorTooLong");
    expect(validateBountyForm({ ...valid, sponsor: ` ${"s".repeat(BOUNTY_SPONSOR_MAX)} ` }, { now })).toEqual({});
  });

  it("rejects zero or negative reward amounts but allows an empty draft amount", () => {
    expect(validateBountyForm({ ...valid, amount: "0" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, amount: "-5" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, amount: "" }, { now }).amount).toBeUndefined();
  });

  it("rejects reward amounts the token cannot represent instead of letting parseUnits round them", () => {
    expect(validateBountyForm({ ...valid, currency: "USDC", amount: "1.234567" }, { now }).amount).toBeUndefined();
    expect(validateBountyForm({ ...valid, currency: "USDC", amount: "1.2345678" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, currency: "USDC", amount: "0.0000001" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, currency: "USDC", amount: "1e-9" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "0.000000000000000001" }, { now }).amount).toBeUndefined();
    // Exponent notation is refused: rewards cannot be edited after creation, and "5e" / "1e18" are typos, not amounts.
    for (const amount of ["1e3", "1E3", "5e", "1e18", "2.5e1"]) expect(validateBountyForm({ ...valid, currency: "INJ", amount }, { now }).amount, amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "1000" }, { now }).amount).toBeUndefined();
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "abc" }, { now }).amount).toBe("amountInvalid");
  });

  it("rejects amounts Number() reads as something else (hex, binary, a decimal comma) instead of sending a different reward", () => {
    for (const amount of ["0x10", "0b11", "1,5", "1.5.2", "+5", "5 INJ"]) {
      expect(validateBountyForm({ ...valid, currency: "INJ", amount }, { now }).amount, amount).toBe("amountInvalid");
    }
    // 18 significant digits do not fit a double: "0.123456789012345678" would be sent as 0.12345678901234568.
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "0.123456789012345678" }, { now }).amount).toBe("amountInvalid");
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "0.5" }, { now }).amount).toBeUndefined();
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: ".5" }, { now }).amount).toBeUndefined();
    expect(validateBountyForm({ ...valid, currency: "INJ", amount: "5." }, { now }).amount).toBeUndefined();
  });

  it("trims text fields when building the saved bounty", () => {
    const saved = formToBounty({ ...valid, title: "  Build a widget  " }, { slug: "", coverImage: null });
    expect(saved.title).toBe("Build a widget");
  });
});

describe("admin bounty form text limits (BE CreateBountyDto)", () => {
  const valid: BountyFormValues = { ...emptyBountyForm(), title: "T", sponsor: "S", deadline: "2030-01-01T10:00", description: "d", deliverables: "x", reviewProcess: "r" };
  const now = new Date("2026-10-25T00:00:00.000Z");

  it("flags description, deliverables and review process over the BE limit", () => {
    expect(validateBountyForm(valid, { now })).toEqual({});
    expect(validateBountyForm({ ...valid, description: "a".repeat(50_001) }, { now })).toEqual({ description: "tooLong" });
    expect(validateBountyForm({ ...valid, reviewProcess: "a".repeat(20_001) }, { now })).toEqual({ reviewProcess: "tooLong" });
    expect(validateBountyForm({ ...valid, deliverables: "a".repeat(20_001) }, { now })).toEqual({ deliverables: "tooLong" });
    expect(validateBountyForm({ ...valid, description: "a".repeat(50_000) }, { now })).toEqual({});
  });

  it("does not validate the reward amount while editing (it is not sent)", () => {
    expect(validateBountyForm({ ...valid, amount: "1e99999" }, { now })).toEqual({ amount: "amountInvalid" });
    expect(validateBountyForm({ ...valid, amount: "1e99999" }, { now, editing: true })).toEqual({});
  });
});

describe("isIsoDateTime", () => {
  it("accepts the microsecond timestamps Postgres json_build_object emits (review history dates)", () => {
    expect(isIsoDateTime("2026-10-25T12:34:56.123456+00:00")).toBe(true);
    expect(isIsoDateTime("2026-10-25T12:34:56.12+09:00")).toBe(true);
    expect(isIsoDateTime("2026-10-25T12:34:56.123Z")).toBe(true);
  });

  it("still rejects values V8 would guess a date for", () => {
    expect(isIsoDateTime("07.14")).toBe(false);
    expect(isIsoDateTime("2026-10-25 12:34:56")).toBe(false);
    expect(isIsoDateTime("2026-10-25T12:34:56.1234567890Z")).toBe(false);
  });
});
