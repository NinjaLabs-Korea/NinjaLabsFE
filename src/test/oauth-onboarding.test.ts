// @vitest-environment jsdom
import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOnboardingPath, shouldRedirectToOnboarding } from "@/lib/api/auth-adapter";
import { resetSessionState } from "@/lib/api/http";
import { createLoginChallenge, exchangeLoginCodeFromLocation, isAuthCallbackPath, LOGIN_VERIFIER_TTL_MS } from "@/lib/api/oauth";
import type { ClientUser } from "@/lib/contracts/auth";

const VERIFIER_KEY = "ninja.oauthVerifier";

beforeEach(() => {
  sessionStorage.clear();
  resetSessionState();
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PKCE challenge", () => {
  it("stores a 43-char base64url verifier with its creation time and returns the unpadded S256 challenge", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T00:00:00.000Z"));
    const challenge = await createLoginChallenge();
    const stored = JSON.parse(sessionStorage.getItem(VERIFIER_KEY)!) as { verifier: string; createdAt: number };
    expect(stored.createdAt).toBe(Date.parse("2026-10-24T00:00:00.000Z"));
    expect(stored.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(stored.verifier).digest("base64url"));
    expect(challenge).not.toMatch(/[=+/]/);
  });

  it("issues a fresh verifier per sign-in attempt", async () => {
    await createLoginChallenge();
    const first = sessionStorage.getItem(VERIFIER_KEY);
    await createLoginChallenge();
    expect(sessionStorage.getItem(VERIFIER_KEY)).not.toBe(first);
  });
});

describe("verifier TTL boundaries", () => {
  async function exchangeAfter(ageMs: number) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T00:00:00.000Z"));
    await createLoginChallenge();
    vi.setSystemTime(Date.parse("2026-10-24T00:00:00.000Z") + ageMs);
    window.history.replaceState(null, "", "/ko/auth/callback#loginCode=code");
    const request = vi.fn(async () => Response.json({ accessToken: "a" }));
    vi.stubGlobal("fetch", request);
    const outcome = await exchangeLoginCodeFromLocation().then(
      () => "exchanged",
      (error: { attempted: boolean }) => (error.attempted ? "failed-after-exchange" : "refused"),
    );
    return { outcome, sent: request.mock.calls.length };
  }

  it.each([
    [0, "exchanged", 1],
    [LOGIN_VERIFIER_TTL_MS, "exchanged", 1],
    [LOGIN_VERIFIER_TTL_MS + 1, "refused", 0],
    // A verifier stamped in the future (clock moved back) is not trusted either.
    [-1, "refused", 0],
  ])("age %d ms -> %s", async (age, outcome, sent) => {
    expect(await exchangeAfter(age)).toEqual({ outcome, sent });
    expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
  });

  it("sends exactly { code, codeVerifier } to the same-origin exchange", async () => {
    const challenge = await createLoginChallenge();
    const { verifier } = JSON.parse(sessionStorage.getItem(VERIFIER_KEY)!) as { verifier: string };
    window.history.replaceState(null, "", "/auth/callback#loginCode=abc%2Bdef&state=x");
    const request = vi.fn(async () => Response.json({ accessToken: "a" }));
    vi.stubGlobal("fetch", request);
    await exchangeLoginCodeFromLocation();
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/exchange");
    expect(JSON.parse(init.body as string)).toEqual({ code: "abc+def", codeVerifier: verifier });
    expect(init.body).not.toContain(challenge);
  });
});

describe("callback path recognition", () => {
  it.each([
    ["/auth/callback", true],
    ["/en/auth/callback", true],
    ["/zh/auth/callback", true],
    ["/fr/auth/callback", false],
    ["/en/auth/callback/extra", false],
    ["/en/auth/callbacks", false],
    ["/auth/callback/", false],
    ["/en/en/auth/callback", false],
  ])("%s -> %s", (pathname, expected) => {
    expect(isAuthCallbackPath(pathname)).toBe(expected);
  });
});

describe("onboarding redirect", () => {
  const user = (over: Partial<ClientUser>): ClientUser => ({ id: "u", handle: "n", initials: "N", profileSlug: "n", ...over });

  it.each([
    [undefined, false, "/signup/wallet"],
    [1, false, "/signup/wallet"],
    [2, false, "/signup/wallet"],
    [3, false, "/signup/profile"],
    [4, false, "/signup/get-started"],
    [9, false, "/signup/get-started"],
    [2, true, null],
  ])("step %s, completed %s -> %s", (onboardingStep, onboardingCompleted, expected) => {
    expect(getOnboardingPath(user({ onboardingStep, onboardingCompleted }))).toBe(expected);
  });

  it("returns null for a signed-out visitor", () => {
    expect(getOnboardingPath(null)).toBeNull();
  });

  it.each([
    ["/ko/bounties", "/ko/signup/profile"],
    ["/bounties", "/signup/profile"],
    ["/zh/auth/callback", "/zh/signup/profile"],
    ["/ko/signup/wallet", null],
    ["/signup/get-started", null],
    // Account deletion must stay reachable before onboarding is finished.
    ["/en/account", null],
    ["/ko/account", null],
    ["/accountant", "/signup/profile"],
    // `/signup` itself is not a step page: an unfinished user who lands there is sent on to their step.
    ["/en/signup", "/en/signup/profile"],
  ])("from %s an unfinished step-3 user goes to %s", (pathname, expected) => {
    expect(shouldRedirectToOnboarding(user({ onboardingStep: 3, onboardingCompleted: false }), pathname)).toBe(expected);
  });
});
