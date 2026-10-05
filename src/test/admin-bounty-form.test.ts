import { describe, expect, it } from "vitest";
import { getAdminBounties } from "@/lib/admin";
import { bountyToForm, emptyBountyForm, formToBounty } from "@/lib/admin-bounty-form";

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
