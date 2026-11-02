import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compactField, compactTextarea, roomyField } from "@/components/ui/field-classes";
import { bountyInputClass } from "@/components/bounties/BountyActionPanels";
import { questionInputClass } from "@/components/recruit/QuestionField";

const tokens = (value: string) => value.split(/\s+/).filter(Boolean).sort();

describe("member form field recipes (ui/field-classes)", () => {
  // The class strings the four member forms carried before they shared one recipe. The look must not drift silently.
  it("roomyField keeps the padded look of the cohort, sign-up and account fields (plus the invalid border)", () => {
    const before = "mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
    expect(tokens(roomyField)).toEqual(tokens(`${before} aria-[invalid]:border-danger`));
  });

  it("compactField and compactTextarea keep the bounty panel look", () => {
    const beforeInput = "h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
    const beforeTextarea = "w-full rounded-control border border-border bg-surface px-3 py-3 text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid]:border-danger";
    expect(tokens(compactField)).toEqual(tokens(beforeInput));
    expect(tokens(compactTextarea)).toEqual(tokens(beforeTextarea));
  });

  it("the per-form names are the shared recipes, not copies", () => {
    expect(questionInputClass).toBe(roomyField);
    expect(bountyInputClass).toBe(compactField);
  });

  it("no member form spells the field recipe out again", () => {
    for (const file of ["signup/ProfileForm.tsx", "account/AccountSettingsView.tsx", "recruit/QuestionField.tsx", "recruit/CohortApplicationForm.tsx", "bounties/BountyActionPanel.tsx", "bounties/BountyActionPanels.tsx"]) {
      const source = readFileSync(`src/components/${file}`, "utf8");
      expect(source, file).not.toContain("placeholder:text-ink-placeholder");
    }
  });
});
