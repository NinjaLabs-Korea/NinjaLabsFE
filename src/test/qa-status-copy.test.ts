import { describe, expect, it } from "vitest";

const messages = import.meta.glob("../../messages/{en,ko,zh}/{members,bounties}.json", { eager: true, import: "default" }) as Record<string, Record<string, unknown>>;

describe.each(["en", "ko", "zh"])("QA status copy (%s)", (locale) => {
  const read = (namespace: string) => messages[`../../messages/${locale}/${namespace}.json`] as Record<string, Record<string, string | Record<string, string>>>;

  it("does not use NFT ownership as a static membership label", () => {
    const portfolio = read("members").profile.portfolio as Record<string, string>;
    expect(portfolio.memberSince).not.toMatch(/NFT/);
    expect(portfolio.memberSince).toContain("{date}");
  });
});
