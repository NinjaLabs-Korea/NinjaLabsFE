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

// The wallet step shows two short lines; protocol detail lives in a collapsed disclosure and stays jargon free.
describe("sign-up wallet step copy", () => {
  it.each(["en", "ko", "zh"])("keeps protocol jargon out of the visible %s steps", (locale) => {
    const messages = JSON.parse(readFileSync(`messages/${locale}/signup.json`, "utf8")) as { wallet: Record<string, unknown> };
    expect(JSON.stringify(messages.wallet.steps)).not.toMatch(/EIP-191|personal_sign|부모|父 |parent/i);
    expect(messages.wallet).toHaveProperty("moreDetails");
    expect(messages.wallet).not.toHaveProperty("whatHappens");
  });
});
