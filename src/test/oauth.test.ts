// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { captureTokensFromLocation, getTokens } from "@/lib/api/http";
import { createLoginChallenge, exchangeLoginCodeFromLocation } from "@/lib/api/oauth";

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
    expect(captureTokensFromLocation()).toBe(false);
    expect(window.location.hash).toBe("#faq");
  });

  it("still consumes old backend token callbacks during a frontend-first rollout", () => {
    window.history.replaceState({ marker: "router" }, "", "/?from=login#accessToken=old-access&refreshToken=old-refresh");
    expect(captureTokensFromLocation()).toBe(true);
    expect(window.location.href).not.toContain("Token=");
    expect(window.location.search).toBe("?from=login");
    expect(window.history.state).toEqual({ marker: "router" });
    expect(getTokens()).toEqual({ accessToken: "old-access", refreshToken: "old-refresh" });
  });

  it.each(["accessToken=partial", "refreshToken=partial", "accessToken=&refreshToken="])("removes incomplete legacy credentials: %s", (hash) => {
    window.history.replaceState(null, "", `/auth/callback#${hash}`);
    expect(captureTokensFromLocation()).toBe(false);
    expect(window.location.hash).toBe("");
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });
});
