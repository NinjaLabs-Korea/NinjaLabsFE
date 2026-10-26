import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { signup } from "@/lib/signup";

// Sign-up copy is read by users: design-review and product-analytics notes must not leak into it.
const INTERNAL_NOTE = /funnel|drop-?off|the team monitors|퍼널|이탈|转化漏斗|流失/i;

describe("sign-up profile copy", () => {
  it.each(["en", "ko", "zh"])("has no internal product notes in %s and every listed requirement exists", (locale) => {
    const messages = JSON.parse(readFileSync(`messages/${locale}/signup.json`, "utf8")) as { profile: { requirements: Record<string, string> } };
    for (const key of signup.profile.requirementKeys) expect(messages.profile.requirements[key]).toBeTruthy();
    expect(JSON.stringify(messages.profile)).not.toMatch(INTERNAL_NOTE);
    expect(Object.keys(messages.profile.requirements)).toEqual([...signup.profile.requirementKeys]);
  });
});
