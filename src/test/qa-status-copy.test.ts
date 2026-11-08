import { describe, expect, it } from "vitest";

const messages = import.meta.glob("../../messages/{en,ko,zh}/{signup,members,account,bounties}.json", { eager: true, import: "default" }) as Record<string, Record<string, unknown>>;

describe.each(["en", "ko", "zh"])("QA status copy (%s)", (locale) => {
  const read = (namespace: string) => messages[`../../messages/${locale}/${namespace}.json`] as Record<string, Record<string, string | Record<string, string>>>;

  it("does not use NFT ownership as a static membership label", () => {
    const portfolio = read("members").profile.portfolio as Record<string, string>;
    expect(portfolio.memberSince).not.toMatch(/NFT/);
    expect(portfolio.memberSince).toContain("{date}");
  });

  it("directs linked-wallet replacement to operators instead of promising self-service editing", () => {
    const note = read("signup").getStarted.savedNote as string;
    expect(note).toMatch(/operator|운영진|运营方/i);
    expect(note).not.toMatch(/wallet and profile any time|지갑과 프로필은.*언제든|钱包和个人资料可随时/);
  });

  it("describes NFT issuance as a request, not an immediate result of wallet linking", () => {
    const wallet = read("signup").wallet.noteApi as string;
    const account = read("account").settings.wallet as Record<string, string>;
    expect(wallet).toMatch(/queued|대기열|队列/);
    expect(account.body).toMatch(/queued|대기열|队列/);
  });
});
