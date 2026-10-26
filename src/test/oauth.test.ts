// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { getAccessToken, installSession, resetSessionState } from "@/lib/api/http";
import { FakeBroadcastChannel } from "./fake-broadcast-channel";
import {
  createLoginChallenge,
  exchangeLoginCodeFromLocation,
  getLoginCallbackError,
  LOGIN_VERIFIER_TTL_MS,
  LoginExchangeError,
} from "@/lib/api/oauth";

const API = "https://api.example";
const REFRESH = "/api/auth/refresh";
const EXCHANGE = "/api/auth/exchange";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSessionState();
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
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
      // Same-origin cookie mode: the rewrite proxies it to the BE, which sets the HttpOnly refresh cookie.
      expect(url).toBe(EXCHANGE);
      expect(init.method).toBe("POST");
      expect(init.cache).toBe("no-store");
      expect(init.credentials).toBe("include");
      expect(new Headers(init.headers).get("x-ninja-session")).toBe("cookie");
      expect(JSON.parse(init.body as string)).toEqual({ code: "test-code", codeVerifier: verifier });
      return Response.json({ accessToken: "test-access" });
    });
    vi.stubGlobal("fetch", request);
    expect(await exchangeLoginCodeFromLocation()).toBe(true);
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    expect(getAccessToken()).toBe("test-access");
    // Only the non-secret session hint is written.
    expect({ ...localStorage }).toEqual({ "ninja.session": "1" });
    expect(await exchangeLoginCodeFromLocation()).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a copied callback without its original browser verifier", async () => {
    window.history.replaceState(null, "", "/auth/callback#loginCode=copied-code");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(exchangeLoginCodeFromLocation()).rejects.toThrow();
    expect(window.location.hash).toBe("");
    expect(request).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it("does not install a session when exchange fails", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/auth/callback#loginCode=expired-code");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(exchangeLoginCodeFromLocation()).rejects.toThrow();
    expect(window.location.hash).toBe("");
    expect(getAccessToken()).toBeNull();
  });

  it("leaves ordinary anchors untouched", async () => {
    window.history.replaceState(null, "", "/#faq");
    expect(await exchangeLoginCodeFromLocation()).toBe(false);
    expect(window.location.hash).toBe("#faq");
  });

  it("ignores legacy token fragments instead of installing a session from the URL", async () => {
    window.history.replaceState(null, "", "/?from=login#accessToken=planted&refreshToken=planted");
    expect(await exchangeLoginCodeFromLocation()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  it("accepts the localized callback route", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/ko/auth/callback#loginCode=test-code");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ accessToken: "test-access" })));
    expect(await exchangeLoginCodeFromLocation()).toBe(true);
    expect(window.location.hash).toBe("");
    expect(getAccessToken()).toBe("test-access");
  });

  it.each(["/en/notices#loginCode=planted", "/en/bounties#error=access_denied", "/#loginCode=planted&error=x"])(
    "leaves login fragments alone outside the callback route: %s",
    async (url) => {
      installSession("current-access");
      await createLoginChallenge();
      window.history.replaceState(null, "", url);
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      expect(await exchangeLoginCodeFromLocation()).toBe(false);
      expect(window.location.hash).toBe(`#${url.split("#")[1]}`);
      expect(request).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe("current-access");
      expect(sessionStorage.getItem("ninja.oauthVerifier")).not.toBeNull();
    },
  );

  it("reports whether an exchange was actually attempted", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#error=access_denied");
    const denied = await exchangeLoginCodeFromLocation().catch((caught: unknown) => caught);
    expect(denied).toBeInstanceOf(LoginExchangeError);
    expect((denied as LoginExchangeError).attempted).toBe(false);

    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=expired-code");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const failed = await exchangeLoginCodeFromLocation().catch((caught: unknown) => caught);
    expect(failed).toBeInstanceOf(LoginExchangeError);
    expect((failed as LoginExchangeError).attempted).toBe(true);
  });
});

const me = { id: "u1", nickname: "ninja", onboardingStep: 4, onboardingCompleted: true, isAdmin: false };

/**
 * The browser still holds the refresh cookie of the current session: `/api/auth/refresh` answers with a new access
 * token, `/auth/me` with the user, the exchange (if any) with `exchange`, everything else 500.
 */
function stubCurrentSession(exchange: () => Response = () => new Response(null, { status: 500 }), user: object = me) {
  // That earlier sign-in left the non-secret session hint behind (it makes the page load try the refresh).
  localStorage.setItem("ninja.session", "1");
  const request = vi.fn(async (url: string) => {
    if (url === REFRESH) return Response.json({ accessToken: "current-access" });
    if (url === EXCHANGE) return exchange();
    if (url === `${API}/auth/me`) return Response.json(user);
    return new Response(null, { status: url === "/api/auth/logout" ? 204 : 500 });
  });
  vi.stubGlobal("fetch", request);
  return request;
}

const urls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.map(([url]) => url as string);

describe("callback #error codes", () => {
  it("remembers a mapped #error code, ignores unmapped ones and forgets it when a new sign-in starts", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#error=TURNSTILE_UNAVAILABLE");
    await expect(exchangeLoginCodeFromLocation()).rejects.toMatchObject({ attempted: false });
    expect(window.location.hash).toBe("");
    expect(getLoginCallbackError()).toBe("TURNSTILE_UNAVAILABLE");
    await createLoginChallenge();
    expect(getLoginCallbackError()).toBeNull();

    window.history.replaceState(null, "", "/en/auth/callback#error=AUTH_FAILED");
    await expect(exchangeLoginCodeFromLocation()).rejects.toBeInstanceOf(LoginExchangeError);
    expect(getLoginCallbackError()).toBeNull();
  });
});

describe("API auth adapter login handoff", () => {
  it("keeps the current session when a page outside the callback carries an error fragment", async () => {
    window.history.replaceState(null, "", "/en/bounties#error=access_denied");
    const request = stubCurrentSession();
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(getAccessToken()).toBe("current-access");
    expect(window.location.hash).toBe("#error=access_denied");
    expect(urls(request)).toEqual([REFRESH, `${API}/auth/me`]);
  });

  it("restores the current session when the callback carries a planted code without this tab's verifier", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = stubCurrentSession();
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    // No exchange was attempted: the planted code is ignored and the existing cookie session is restored once.
    expect(urls(request)).toEqual([REFRESH, `${API}/auth/me`]);
    // The callback page only shows a spinner for a signed-in user, so the restored session must leave it.
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en/home"));
    expect(adapter.getSnapshot().user?.handle).toBe("ninja");
    expect(getAccessToken()).toBe("current-access");
  });

  it("sends a finished user back to the page that asked for the sign-in, once", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    sessionStorage.setItem("ninja.returnTo", "/recruit");
    stubCurrentSession();
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en/recruit"));
    expect(sessionStorage.getItem("ninja.returnTo")).toBeNull();
  });

  it("keeps the remembered page for an unfinished sign-up, which goes to its onboarding step first", async () => {
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    sessionStorage.setItem("ninja.returnTo", "/recruit");
    stubCurrentSession(undefined, { ...me, onboardingStep: 3, onboardingCompleted: false });
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en/signup/profile"));
    expect(sessionStorage.getItem("ninja.returnTo")).toBe("/recruit");
  });

  it("re-reads the signed-in user on demand (after onboarding completes) and keeps the old snapshot when the read fails", async () => {
    window.history.replaceState(null, "", "/en/bounties");
    const request = stubCurrentSession(undefined, { ...me, onboardingStep: 4, onboardingCompleted: false });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user?.onboardingCompleted).toBe(false);
    request.mockImplementation(async (url: string) => (url === `${API}/auth/me` ? Response.json({ ...me, onboardingStep: 4, onboardingCompleted: true }) : new Response(null, { status: 500 })));
    expect((await adapter.refresh?.())?.user?.onboardingCompleted).toBe(true);
    request.mockImplementation(async () => new Response(null, { status: 503 }));
    expect((await adapter.refresh?.())?.user?.onboardingCompleted).toBe(true);
  });

  it("a failed exchange never revokes the session already in the shared cookie (second tab, duplicate link)", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=expired-code");
    const request = stubCurrentSession(() => new Response(null, { status: 401 }));
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(urls(request)).not.toContain("/api/auth/logout");
    expect(getAccessToken()).toBe("current-access");
  });

  it("a failed exchange without any session ends signed-out and sends no logout", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=expired-code");
    const request = vi.fn(async (_url: string) => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    expect(request.mock.calls.map(([url]) => url)).not.toContain("/api/auth/logout");
  });

  it("a successful exchange drops legacy tokens and tells other tabs a session exists again", async () => {
    localStorage.setItem("ninja.accessToken", "old-access");
    localStorage.setItem("ninja.refreshToken", "old-refresh");
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=good-code");
    const request = stubCurrentSession(() => Response.json({ accessToken: "new-access", refreshToken: "ignored-refresh" }));
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const otherTab = new FakeBroadcastChannel("ninja-auth");
    const received: unknown[] = [];
    otherTab.addEventListener("message", (event) => received.push((event as MessageEvent).data));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(urls(request)).toEqual([EXCHANGE, `${API}/auth/me`]);
    expect(getAccessToken()).toBe("new-access");
    expect({ ...localStorage }).toEqual({ "ninja.session": "1" });
    expect(received).toEqual([{ type: "signed-in" }]);
  });
});

describe("PKCE verifier hygiene", () => {
  afterEach(() => vi.useRealTimers());

  it("does not exchange with a verifier older than the TTL and removes it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await createLoginChallenge();
    vi.setSystemTime(Date.now() + LOGIN_VERIFIER_TTL_MS + 1);
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=late-code");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const error = await exchangeLoginCodeFromLocation().catch((caught: unknown) => caught);
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
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ accessToken: "a" })));
    expect(await exchangeLoginCodeFromLocation()).toBe(true);
  });

  it.each(["legacy-plain-string", "{\"verifier\":\"\"}", "{\"verifier\":\"v\"}", "not json {"])(
    "treats a malformed stored verifier as absent: %s",
    async (raw) => {
      sessionStorage.setItem("ninja.oauthVerifier", raw);
      window.history.replaceState(null, "", "/en/auth/callback#loginCode=code");
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      await expect(exchangeLoginCodeFromLocation()).rejects.toMatchObject({ attempted: false });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("drops the verifier when a non-callback page initializes after sign-in started", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/bounties");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
  });

  it("keeps the verifier for the callback page that consumes it", async () => {
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=good-code");
    const request = stubCurrentSession(() => Response.json({ accessToken: "new-access" }));
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(request.mock.calls[0][0]).toBe(EXCHANGE);
  });

  it("a planted #loginCode after an abandoned sign-in neither exchanges nor clears the current session", async () => {
    await createLoginChallenge();
    // The user backs out of Google consent and lands on an ordinary page: the verifier is dropped.
    window.history.replaceState(null, "", "/en/bounties");
    stubCurrentSession();
    const abandoned = createApiAuthAdapter(API);
    abandoned.initialize?.();
    expect(sessionStorage.getItem("ninja.oauthVerifier")).toBeNull();
    await vi.waitFor(() => expect(abandoned.getSnapshot().status).toBe("signed-in"));

    // Later a link plants a code on the callback route (a fresh page load).
    resetSessionState();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = stubCurrentSession(() => Response.json({ accessToken: "attacker-access" }));
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(urls(request)).toEqual([REFRESH, `${API}/auth/me`]);
    expect(getAccessToken()).toBe("current-access");
  });

  it("a planted #loginCode with only a stale verifier keeps the current session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await createLoginChallenge();
    vi.setSystemTime(Date.now() + LOGIN_VERIFIER_TTL_MS + 60_000);
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=planted");
    const request = stubCurrentSession(() => Response.json({ accessToken: "attacker-access" }));
    vi.stubGlobal("location", { ...window.location, replace: vi.fn() });
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(urls(request)).toEqual([REFRESH, `${API}/auth/me`]);
    expect(getAccessToken()).toBe("current-access");
  });
});
