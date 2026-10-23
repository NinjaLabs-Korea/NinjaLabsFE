import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminBounties } from "@/lib/admin";
import {
  BOUNTY_SPONSOR_MAX,
  BOUNTY_TITLE_MAX,
  bountyToForm,
  emptyBountyForm,
  formToBounty,
  fromLocalDateTimeInput,
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

  it("starts new bounties as funding only when a reward amount is set", () => {
    const base = { ...emptyBountyForm(), deadline: "2026-07-14T23:59" };
    expect(formToBounty(base, { slug: "", coverImage: null }).status).toBe("draft");
    expect(formToBounty({ ...base, amount: "10" }, { slug: "", coverImage: null }).status).toBe("funding");
  });

  it("re-sends the raw requirements string unchanged while the deliverables/guide inputs are untouched", () => {
    const raw = "- Repo\n\n  - nested item\n\nClosing note";
    const bounty = { ...getAdminBounties()[0], deadline: "2026-07-14T23:59:00.000Z", requirements: raw, deliverables: ["- Repo", "- nested item", "Closing note"] };
    const form = bountyToForm(bounty);
    expect(form.deliverables).toBe("- Repo\n- nested item\nClosing note");
    // Untouched: byte-identical, blank lines and indentation included.
    expect(formToBounty(form, { slug: bounty.slug, coverImage: null }).requirements).toBe(raw);
    // Edited deliverables replace it with the entered lines.
    expect(formToBounty({ ...form, deliverables: " Demo \n\n Docs " }, { slug: bounty.slug, coverImage: null }).requirements).toBe("Demo\nDocs");
    // Only the guide edited: the guide becomes the requirements.
    expect(formToBounty({ ...form, submissionGuide: "Link the repo" }, { slug: bounty.slug, coverImage: null }).requirements).toBe("Link the repo");
    // New bounty: deliverables first, guide as the fallback.
    expect(formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59", deliverables: "Repo" }, { slug: "", coverImage: null }).requirements).toBe("Repo");
    expect(formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59", submissionGuide: "Guide only" }, { slug: "", coverImage: null }).requirements).toBe("Guide only");
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
    const edited = formToBounty(bountyToForm(bounty), { slug: bounty.slug, coverImage: null, existingStatus: bounty.status, maxWinners: bounty.maxWinners });
    expect(edited.maxWinners).toBe(3);
    expect(edited.applicationDeadline).toBe("2026-07-01T00:00:00.000Z");
    const created = formToBounty({ ...emptyBountyForm(), deadline: "2026-07-14T23:59" }, { slug: "", coverImage: null });
    expect(created.maxWinners).toBe(1);
    expect(created.applicationDeadline).toBeNull();
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

  it("accepts a submission guide in place of deliverables", () => {
    expect(validateBountyForm({ ...valid, deliverables: "", submissionGuide: "Link the repo" }, { now })).toEqual({});
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

  it("trims text fields when building the saved bounty", () => {
    const saved = formToBounty({ ...valid, title: "  Build a widget  " }, { slug: "", coverImage: null });
    expect(saved.title).toBe("Build a widget");
  });
});
