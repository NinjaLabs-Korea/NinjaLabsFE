import { describe, expect, it } from "vitest";
import en from "../../messages/en/agents.json";
import ko from "../../messages/ko/agents.json";
import zh from "../../messages/zh/agents.json";
import enCommon from "../../messages/en/common.json";
import koCommon from "../../messages/ko/common.json";
import zhCommon from "../../messages/zh/common.json";

// The register page shows `agents.register` copy to end users. It once carried Figma design notes ("Open: define how
// bound agents are handled when a user deletes their account") and described a public-key step the BE does not have
// (registration takes `walletAddress` only; account deletion revokes every owned agent).
describe.each([["en", en], ["ko", ko], ["zh", zh]] as const)("agents.register copy (%s)", (_locale, messages) => {
  const register = messages.register as Record<string, unknown>;

  it("states the account-deletion behaviour instead of an open question", () => {
    expect(register).not.toHaveProperty("unresolved");
    expect(register).not.toHaveProperty("unresolvedBadge");
    expect(typeof register.withdrawal).toBe("string");
    expect(typeof register.withdrawalBadge).toBe("string");
  });

  it("does not ask for a public key", () => {
    const steps = register.steps as Record<string, { heading: string }>;
    expect(steps.publicKey.heading).not.toMatch(/public key|公钥|공개 키/i);
  });
});

// The footer once repeated a Figma behaviour note ("Returning users skip Intro and land on main") that is not true of the
// site: there is no intro page to skip, and the landing page always renders.
describe.each([["en", enCommon], ["ko", koCommon], ["zh", zhCommon]] as const)("common.footer.legal (%s)", (_locale, messages) => {
  it("is the copyright line only, not a flow description", () => {
    expect(messages.footer.legal.split("·")).toHaveLength(2);
  });
});
