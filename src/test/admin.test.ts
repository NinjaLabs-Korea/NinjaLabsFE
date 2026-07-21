import { describe, expect, it } from "vitest";
import { getAdminBounties } from "@/lib/admin";
import { bounties } from "@/lib/bounties";

describe("admin bounty adapter", () => {
  it("maps iAsset price widget meta fields from the public registry", () => {
    const bounty = getAdminBounties().find(({ slug }) => slug === "iasset-price-widget");

    expect(bounty).toMatchObject({
      submissionGuide: "Submit everything reviewers need to run the widget without extra back-and-forth.\n\n- A public GitHub repository with build and test instructions\n- A preview URL demonstrating live, loading, and unavailable states\n- A README covering integration props and setup notes",
      deliverables: ["GitHub repository", "Preview URL", "README with integration notes"],
      reviewProcess: "Ninja Labs triage followed by Injective sponsor approval.",
    });
  });

  it("uses empty values for absent submission guides and deliverables", () => {
    const registryBounty = bounties.find(({ slug }) => slug === "design-system-build");
    expect(registryBounty).toBeDefined();

    const deliverables = registryBounty!.deliverables;
    const submissionGuideMarkdown = registryBounty!.submissionGuideMarkdown;
    delete registryBounty!.deliverables;
    delete registryBounty!.submissionGuideMarkdown;

    try {
      const bounty = getAdminBounties().find(({ slug }) => slug === "design-system-build");
      expect(bounty).toMatchObject({ deliverables: [], submissionGuide: "" });
    } finally {
      if (deliverables === undefined) {
        delete registryBounty!.deliverables;
      } else {
        registryBounty!.deliverables = deliverables;
      }
      if (submissionGuideMarkdown === undefined) {
        delete registryBounty!.submissionGuideMarkdown;
      } else {
        registryBounty!.submissionGuideMarkdown = submissionGuideMarkdown;
      }
    }
  });

  it("isolates returned reward and deliverables from the public registry", () => {
    const registryBounty = bounties.find(({ slug }) => slug === "iasset-price-widget");
    const bounty = getAdminBounties().find(({ slug }) => slug === "iasset-price-widget");
    expect(registryBounty).toBeDefined();
    expect(bounty).toBeDefined();

    expect(bounty!.reward).not.toBe(registryBounty!.reward);
    expect(bounty!.deliverables).not.toBe(registryBounty!.deliverables);

    bounty!.reward.amount = 0;
    bounty!.deliverables.push("Mutated admin deliverable");

    expect(registryBounty!.reward.amount).toBe(500);
    expect(registryBounty!.deliverables).toEqual(["GitHub repository", "Preview URL", "README with integration notes"]);
  });
});
