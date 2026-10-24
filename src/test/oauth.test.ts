// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { getTokens, setTokens } from "@/lib/api/http";
import {
  createLoginChallenge,
  exchangeLoginCodeFromLocation,
  LOGIN_VERIFIER_TTL_MS,
  LoginExchangeError,
} from "@/lib/api/oauth";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({ marker: "router" }, "", "/auth/callback");
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => vi.unstubAllGlobals());

describe("OAuth code handoff", () => {
  it("keeps the verifier in this tab and sends only its SHA-256 challenge", async () => {
    const challenge = await createLoginChallenge();
    const stored = JSON.parse(sessionStorage.getItem("ninja.oauthVerifier")!) as { verifier: string; createdAt: number };
    const verifier = stored.verifier;
    expect(Math.abs(Date.now() - stored.createdAt)).toBeLessThan(5_000);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(localStorage.getItem("ninja.oauthVerifier")).toBeNull();
  });

  it("clears the URL before exchanging the code by POST and preserves router state", async () => {
    await createLoginChallenge();
    const verifier = (JSON.parse(sessionStorage.getItem("ninja.oauthVerifier")!) as { verifier: string }).verifier;
    window.history.replaceState({ marker: "router" }, "", "/auth/callback#loginCode=test-code");
    const request = vi.fn(async (url: string, init: RequestInit) => {
      expect(window.location.hash).toBe("");
      expect(window.history.state).toEqual({ marker: "router" });
      expect(url).toBe("https://api.example/auth/exchange");
      expect(init.method).toBe("POST");
      expect(init.cache).toBe("no-store");
      expect(JSON.parse(init.body as string)).toEqual({ code: "test-code", codeVerifier: verifier });
      return Response.json({ accessToken: "test-access", refreshToken: "test-refresh" });
    });
    vi.stubGlobal("fetch", request);
    expect(await exchangeLoginCodeFromLocation("https://api.example/")).toBe(true);
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    expect(getTokens()).toEqual({ accessToken: "test-access", refreshToken: "test-refresh" });
    expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a copied callback without its original browser verifier", async () => {
    window.history.replaceState(null, "", "/auth/callback#loginCode=copied-code");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(exchangeLoginCodeFromLocation("https://api.example")).rejects.toThrow();
    expect(window.location.hash).toBe("");
    expect(request).not.toHaveBeenCalled();
    expect(getTokens().accessToken).toBeNull();
  });

  it("does not install a session when exchange fails", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/auth/callback#loginCode=expired-code");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(exchangeLoginCodeFromLocation("https://api.example")).rejects.toThrow();
    expect(window.location.hash).toBe("");
    expect(getTokens().refreshToken).toBeNull();
  });

  it("leaves ordinary anchors untouched", async () => {
    window.history.replaceState(null, "", "/#faq");
    expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(false);
    expect(window.location.hash).toBe("#faq");
  });

  it("ignores legacy token fragments instead of installing a session from the URL", async () => {
    window.history.replaceState(null, "", "/?from=login#accessToken=planted&refreshToken=planted");
    expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(false);
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });

  it("accepts the localized callback route", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/ko/auth/callback#loginCode=test-code");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ accessToken: "test-access", refreshToken: "test-refresh" })));
    expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(true);
    expect(window.location.hash).toBe("");
    expect(getTokens().refreshToken).toBe("test-refresh");
  });

  it.each(["/en/notices#loginCode=planted", "/en/bounties#error=access_denied", "/#loginCode=planted&error=x"])(
    "leaves login fragments alone outside the callback route: %s",
    async (url) => {
      setTokens("current-access", "current-refresh");
      await createLoginChallenge();
      window.history.replaceState(null, "", url);
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(false);
      expect(window.location.hash).toBe(`#${url.split("#")[1]}`);
      expect(request).not.toHaveBeenCalled();
      expect(getTokens()).toEqual({ accessToken: "current-access", refreshToken: "current-refresh" });
      expect(sessionStorage.getItem("ninja.oauthVerifier")).not.toBeNull();
    },
  );

  it("reports whether an exchange was actually attempted", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#error=access_denied");
    const denied = await exchangeLoginCodeFromLocation("https://api.example").catch((caught: unknown) => caught);
    expect(denied).toBeInstanceOf(LoginExchangeError);
    expect((denied as LoginExchangeError).attempted).toBe(false);

    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=expired-code");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const failed = await exchangeLoginCodeFromLocation("https://api.example").catch((caught: unknown) => caught);
    expect(failed).toBeInstanceOf(LoginExchangeError);
    expect((failed as LoginExchangeError).attempted).toBe(true);
  });
});

describe("API auth adapter login handoff", () => {
  const me = { id: "u1", nickname: "ninja", onboardingStep: 4, onboardingCompleted: true, isAdmin: false };

  it("keeps the current session when a page outside the callback carries an error fragment", async () => {
    setTokens("current-access", "current-refresh");
    window.history.replaceState(null, "", "/en/bounties#error=access_denied");
    const request = vi.fn(async (url: string) => (url.endsWith("/auth/me") ? Response.json(me) : new Response(null, { status: 500 })));
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(getTokens()).toEqual({ accessToken: "current-access", refreshToken: "current-refresh" });
    expect(window.location.hash).toBe("#error=access_denied");
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.example/auth/me"]);
  });

  it("restores the current session when the callback carries a planted code without this tab's verifier", async () => {
    setTokens("current-access", "current-refresh");
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = vi.fn(async (url: string) => (url.endsWith("/auth/me") ? Response.json(me) : new Response(null, { status: 500 })));
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    // No exchange was attempted: the planted code is ignored and the existing session is re-read once.
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.example/auth/me"]);
    expect(adapter.getSnapshot().user?.handle).toBe("ninja");
    expect(getTokens()).toEqual({ accessToken: "current-access", refreshToken: "current-refresh" });
  });

  it("clears the session only after an attempted exchange fails", async () => {
    setTokens("current-access", "current-refresh");
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=expired-code");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe("PKCE verifier hygiene", () => {
  const me = { id: "u1", nickname: "ninja", onboardingStep: 4, onboardingCompleted: true, isAdmin: false };

  afterEach(() => vi.useRealTimers());

  it("does not exchange with a verifier older than the TTL and removes it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await createLoginChallenge();
    vi.setSystemTime(Date.now() + LOGIN_VERIFIER_TTL_MS + 1);
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=late-code");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const error = await exchangeLoginCodeFromLocation("https://api.example").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LoginExchangeError);
    expect((error as LoginExchangeError).attempted).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
  });

  it("still exchanges inside the TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await createLoginChallenge();
    vi.setSystemTime(Date.now() + LOGIN_VERIFIER_TTL_MS - 1_000);
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=code");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ accessToken: "a", refreshToken: "r" })));
    expect(await exchangeLoginCodeFromLocation("https://api.example")).toBe(true);
  });

  it.each(["legacy-plain-string", "{\"verifier\":\"\"}", "{\"verifier\":\"v\"}", "not json {"])(
    "treats a malformed stored verifier as absent: %s",
    async (raw) => {
      sessionStorage.setItem("ninja.oauthVerifier", raw);
      window.history.replaceState(null, "", "/en/auth/callback#loginCode=code");
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      await expect(exchangeLoginCodeFromLocation("https://api.example")).rejects.toMatchObject({ attempted: false });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("drops the verifier when a non-callback page initializes after sign-in started", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/bounties");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
  });

  it("keeps the verifier for the callback page that consumes it", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=good-code");
    const request = vi.fn(async (url: string) =>
      url.endsWith("/auth/exchange") ? Response.json({ accessToken: "new-access", refreshToken: "new-refresh" }) : Response.json(me));
    vi.stubGlobal("fetch", request);
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(request.mock.calls[0][0]).toBe("https://api.example/auth/exchange");
  });

  it("a planted #loginCode after an abandoned sign-in neither exchanges nor clears the current session", async () => {
    setTokens("current-access", "current-refresh");
    await createLoginChallenge();
    // The user backs out of Google consent and lands on an ordinary page: the verifier is dropped.
    window.history.replaceState(null, "", "/en/bounties");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(me)));
    const abandoned = createApiAuthAdapter("https://api.example");
    abandoned.initialize?.();
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    await vi.waitFor(() => expect(abandoned.getSnapshot().status).toBe("signed-in"));

    // Later a link plants a code on the callback route.
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = vi.fn(async (url: string) => (url.endsWith("/auth/me") ? Response.json(me) : new Response(null, { status: 500 })));
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.example/auth/me"]);
    expect(getTokens()).toEqual({ accessToken: "current-access", refreshToken: "current-refresh" });
  });

  it("a planted #loginCode with only a stale verifier keeps the current session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setTokens("current-access", "current-refresh");
    await createLoginChallenge();
    vi.setSystemTime(Date.now() + LOGIN_VERIFIER_TTL_MS + 60_000);
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = vi.fn(async (url: string) => (url.endsWith("/auth/me") ? Response.json(me) : new Response(null, { status: 500 })));
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter("https://api.example");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.example/auth/me"]);
    expect(getTokens()).toEqual({ accessToken: "current-access", refreshToken: "current-refresh" });
  });
});
