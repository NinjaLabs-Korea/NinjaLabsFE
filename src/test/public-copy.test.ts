import { describe, expect, it } from "vitest";
import enLegal from "../../messages/en/legal.json";
import koLegal from "../../messages/ko/legal.json";
import zhLegal from "../../messages/zh/legal.json";
import enCommon from "../../messages/en/common.json";
import koCommon from "../../messages/ko/common.json";
import zhCommon from "../../messages/zh/common.json";

// The footer once repeated a Figma behaviour note ("Returning users skip Intro and land on main") that is not true of the
// site: there is no intro page to skip, and the landing page always renders.
describe.each([["en", enCommon], ["ko", koCommon], ["zh", zhCommon]] as const)("common.footer.legal (%s)", (_locale, messages) => {
  it("is the copyright line only, not a flow description", () => {
    expect(messages.footer.legal).toBe("© 2026 Ninja Labs");
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

  it("states that the public profile shows only nickname, bio, tags and completed bounties", () => {
    const paragraphs = sections.flatMap((section) => (section as { paragraphs?: string[] }).paragraphs ?? []);
    const profile = paragraphs[0] ?? "";
    expect(profile).toMatch(/completed bounties|완료한 바운티|已完成的赏金/);
    expect(profile).not.toMatch(/agent|에이전트|代理|NFT|wallet|지갑|钱包/);
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

  it("carry no edge-case spec boxes on the signup pages", () => {
    for (const [file, text] of Object.entries(files)) {
      if (/\/signup\.json$/.test(file)) {
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
