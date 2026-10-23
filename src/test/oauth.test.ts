// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { getTokens, setTokens } from "@/lib/api/http";
import { createLoginChallenge, exchangeLoginCodeFromLocation, LoginExchangeError } from "@/lib/api/oauth";

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
    const verifier = sessionStorage.getItem("ninja.oauthVerifier")!;
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(localStorage.getItem("ninja.oauthVerifier")).toBeNull();
  });

  it("clears the URL before exchanging the code by POST and preserves router state", async () => {
    await createLoginChallenge();
    const verifier = sessionStorage.getItem("ninja.oauthVerifier");
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
