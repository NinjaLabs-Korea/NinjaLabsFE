import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Sign-up copy is read by users: design-review and product-analytics notes must not leak into it.
const INTERNAL_NOTE = /funnel|drop-?off|the team monitors|퍼널|이탈|转化漏斗|流失/i;

describe("sign-up profile copy", () => {
  it.each(["en", "ko", "zh"])("has no internal product notes in %s", (locale) => {
    const messages = JSON.parse(readFileSync(`messages/${locale}/signup.json`, "utf8")) as { profile: Record<string, unknown> };
    expect(JSON.stringify(messages.profile)).not.toMatch(INTERNAL_NOTE);
    // The team's own spam-control rationale ("why everything is required") is not user-facing copy.
    expect(JSON.stringify(messages.profile)).not.toMatch(/spam|스팸|垃圾/i);
    expect(messages.profile).not.toHaveProperty("requirements");
    expect(messages.profile).not.toHaveProperty("whyRequired");
  });
});
