import { describe, expect, it } from "vitest";
import en from "../../messages/en/agents.json";
import ko from "../../messages/ko/agents.json";
import zh from "../../messages/zh/agents.json";
import enLegal from "../../messages/en/legal.json";
import koLegal from "../../messages/ko/legal.json";
import zhLegal from "../../messages/zh/legal.json";
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

  it("keeps developer wording out of the user-facing list and links to the pages that do the work", () => {
    const items = Object.values(register.verificationItems as Record<string, string>).join(" ");
    expect(items).not.toMatch(/database|1:N|데이터베이스|数据库/i);
    expect(register).not.toHaveProperty("verificationItems.failure");
    expect(register.profileNote as string).toContain("<link>");
    expect(register.withdrawal as string).toContain("<link>");
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

// The privacy policy lists what we collect and who processes it. Sign-in moved to an HttpOnly refresh cookie (access token
// in memory only) and Cloudflare Turnstile now sees every sign-in visitor; the policy once still said "tokens are kept in
// your browser's storage" and named no Cloudflare. Keep it in step with those facts.
describe.each([["en", enLegal], ["ko", koLegal], ["zh", zhLegal]] as const)("legal.privacy copy (%s)", (_locale, messages) => {
  const sections = messages.privacy.sections as Array<{ items?: string[] }>;
  const items = sections.flatMap((section) => section.items ?? []);

  it("names Cloudflare Turnstile among the service providers", () => {
    expect(items.some((item) => /Cloudflare/.test(item) && /Turnstile/.test(item))).toBe(true);
  });

  it("discloses that registered agents (name, wallet address) and Ninja NFTs appear on the public profile", () => {
    const paragraphs = sections.flatMap((section) => (section as { paragraphs?: string[] }).paragraphs ?? []);
    const profile = paragraphs.find((paragraph) => /Ninja NFT/.test(paragraph)) ?? "";
    expect(profile).toMatch(/agent|에이전트|代理/);
    expect(profile).toMatch(/wallet|지갑|钱包/);
  });

  it("does not claim sign-in tokens live in browser storage", () => {
    const access = items.find((item) => /User-Agent/.test(item)) ?? "";
    expect(access).not.toMatch(/browser's storage|브라우저 저장소|浏览器存储/);
  });
});

// Spec annotations ("Edge case: signed-in user clicks Get Started -> ...") are design notes, not product copy, and U+2014
// is banned in everything we ship. Both leaked into user-facing pages before.
describe("user-facing messages", () => {
  const files = import.meta.glob("../../messages/*/*.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

  it("contain no em dash in any locale", () => {
    const offenders = Object.entries(files).filter(([, text]) => text.includes("\u2014")).map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it("carry no edge-case spec boxes on the signup and agent register pages", () => {
    for (const [file, text] of Object.entries(files)) {
      if (/\/(signup|agents)\.json$/.test(file)) {
        expect(text, file).not.toMatch(/"edgeCases?"|"edgeCaseBadge"|"statusTitle"/);
      }
    }
  });
});

// The project rule is "no U+2014 anywhere" (code comments, admin UI strings, docs). Source files leaked it into admin dropdowns
// and review-history lines before; this keeps it out of everything under src/ and integration/.
describe("source files", () => {
  const sources = import.meta.glob(["../**/*.{ts,tsx}", "../../integration/**/*.{mjs,js,ts}"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

  it("contain no em dash", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100); // the glob really found the tree
    const offenders = Object.entries(sources).filter(([, text]) => text.includes("\u2014")).map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
