import { describe, expect, it } from "vitest";
import { getAdminBounties } from "@/lib/admin";
import { bountyToForm, emptyBountyForm, formToBounty, validateBountyForm, type BountyFormValues } from "@/lib/admin-bounty-form";

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

  it("trims blank deliverable lines", () => {
    const form = { ...emptyBountyForm(), deadline: "2026-07-14T23:59", deliverables: " Repo \n\n Demo " };
    expect(formToBounty(form, { slug: "", coverImage: null }).deliverables).toEqual(["Repo", "Demo"]);
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
