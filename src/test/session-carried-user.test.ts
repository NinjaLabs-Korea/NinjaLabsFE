// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { AUTH_CHANNEL_NAME } from "@/lib/api/auth-events";
import { createApiHttp, getAccessToken, REFRESH_COOKIE_HINT_KEY, resetSessionState } from "@/lib/api/http";
import { parseMeResponse, readMe, type MeResponse } from "@/lib/api/me";
import { createLoginChallenge } from "@/lib/api/oauth";
import { FakeBroadcastChannel } from "./fake-broadcast-channel";

/**
 * BE 2026-10-31: a cookie-mode refresh/exchange answers `{ accessToken, user }`, where `user` is the `GET /auth/me`
 * payload of the same session. The FE uses it to skip the second round trip on a page load, and falls back to
 * `GET /auth/me` exactly as before when the field is missing (older BE) or does not pass the codec.
 */

const API = "https://api.example";
const REFRESH = "/api/auth/refresh";
const EXCHANGE = "/api/auth/exchange";
const ME_URL = `${API}/auth/me`;

const FULL_ME: MeResponse = {
  id: "u1",
  nickname: "ninja",
  email: "ninja@example.test",
  bio: "",
  tags: ["DEV"],
  onboardingStep: 4,
  onboardingCompleted: true,
  isAdmin: false,
  isMember: true,
  wallet: { address: "inj1abc", verifiedAt: "2026-10-30T00:00:00.000Z" },
  nft: { status: "MINTED", tokenId: "7" },
};
/** What `GET /auth/me` answers in these tests (a different nickname, so the source of the snapshot is visible). */
const ME_FROM_ENDPOINT: MeResponse = { ...FULL_ME, nickname: "from-me-endpoint" };

type Body = Record<string, unknown>;

/** `/api/auth/refresh` and `/api/auth/exchange` answer `body()`; `/auth/me` answers `ME_FROM_ENDPOINT` for `Bearer access`. */
function stubSession(body: () => Body, exchange?: () => Body) {
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === REFRESH) return Response.json(body());
    if (url === EXCHANGE && exchange) return Response.json(exchange());
    if (url === "/api/auth/logout") return new Response(null, { status: 204 });
    const authorization = new Headers(init?.headers).get("authorization");
    return authorization === "Bearer access" ? Response.json(ME_FROM_ENDPOINT) : new Response(null, { status: 401 });
  });
  vi.stubGlobal("fetch", request);
  return request;
}
const urls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.map(([url]) => url as string);
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSessionState();
  window.history.replaceState(null, "", "/en");
  localStorage.setItem(REFRESH_COOKIE_HINT_KEY, "1");
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});
afterEach(() => vi.unstubAllGlobals());

describe("parseMeResponse (codec for the carried user)", () => {
  it("accepts the full /auth/me shape, including a wallet without verifiedAt and no wallet/NFT at all", () => {
    expect(parseMeResponse(FULL_ME)).toBe(FULL_ME);
    expect(parseMeResponse({ ...FULL_ME, wallet: { address: "inj1abc", verifiedAt: null }, nft: { status: "PENDING", tokenId: null } })).not.toBeNull();
    expect(parseMeResponse({ ...FULL_ME, wallet: null, nft: null, tags: [] })).not.toBeNull();
  });

  it.each<[string, unknown]>([
    ["undefined (older BE)", undefined],
    ["null", null],
    ["an array", [FULL_ME]],
    ["a string", "u1"],
    ["missing id", { ...FULL_ME, id: undefined }],
    ["an empty id", { ...FULL_ME, id: "" }],
    ["missing nickname", { ...FULL_ME, nickname: undefined }],
    ["a numeric onboardingStep as a string", { ...FULL_ME, onboardingStep: "4" }],
    ["a fractional onboardingStep", { ...FULL_ME, onboardingStep: 3.5 }],
    ["onboardingCompleted as a string", { ...FULL_ME, onboardingCompleted: "true" }],
    ["missing isAdmin", { ...FULL_ME, isAdmin: undefined }],
    ["missing isMember", { ...FULL_ME, isMember: undefined }],
    ["missing email", { ...FULL_ME, email: undefined }],
    ["a null bio", { ...FULL_ME, bio: null }],
    ["tags that are not strings", { ...FULL_ME, tags: [1] }],
    ["missing tags", { ...FULL_ME, tags: undefined }],
    ["a wallet without an address", { ...FULL_ME, wallet: { verifiedAt: null } }],
    ["a missing wallet field", { ...FULL_ME, wallet: undefined }],
    ["an NFT without a status", { ...FULL_ME, nft: { tokenId: null } }],
    ["an NFT tokenId that is a number", { ...FULL_ME, nft: { status: "MINTED", tokenId: 7 } }],
  ])("rejects %s", (_label, value) => {
    expect(parseMeResponse(value)).toBeNull();
  });
});

describe("readMe with a carried user", () => {
  it("uses a valid carried user without a request, but never without a session in this tab", async () => {
    const request = stubSession(() => ({ accessToken: "access" }));
    const http = createApiHttp(API);
    await expect(readMe(http, FULL_ME)).resolves.toEqual({ me: null, unavailable: false });
    expect(request).not.toHaveBeenCalled();
    await http.initSession();
    request.mockClear();
    await expect(readMe(http, FULL_ME)).resolves.toEqual({ me: FULL_ME, unavailable: false });
    expect(request).not.toHaveBeenCalled();
  });

  it("falls back to GET /auth/me for a malformed carried user", async () => {
    const request = stubSession(() => ({ accessToken: "access" }));
    const http = createApiHttp(API);
    await http.initSession();
    request.mockClear();
    await expect(readMe(http, { id: "u1" })).resolves.toEqual({ me: ME_FROM_ENDPOINT, unavailable: false });
    expect(urls(request)).toEqual([ME_URL]);
  });
});

describe("refresh result carries the BE user", () => {
  it("returns the raw user field with ok, and nothing extra when the BE sent none", async () => {
    stubSession(() => ({ accessToken: "access", user: FULL_ME }));
    await expect(createApiHttp(API).initSession()).resolves.toEqual({ ok: true, user: FULL_ME });
    resetSessionState();
    stubSession(() => ({ accessToken: "access" }));
    await expect(createApiHttp(API).initSession()).resolves.toEqual({ ok: true });
  });
});

describe("page-load session restore: one round trip when the refresh carries the user", () => {
  it("with a user: signed in from the refresh alone, no GET /auth/me", async () => {
    const request = stubSession(() => ({ accessToken: "access", user: FULL_ME }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user).toMatchObject({ id: "u1", handle: "ninja", onboardingCompleted: true, walletAddress: "inj1abc", nftStatus: "MINTED" });
    expect(urls(request)).toEqual([REFRESH]);
    expect(getAccessToken()).toBe("access");
  });

  it("without a user (BE before this change): refresh, then GET /auth/me as before", async () => {
    const request = stubSession(() => ({ accessToken: "access" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user?.handle).toBe("from-me-endpoint");
    expect(urls(request)).toEqual([REFRESH, ME_URL]);
  });

  it("with a malformed user: falls back to GET /auth/me and shows its answer", async () => {
    const request = stubSession(() => ({ accessToken: "access", user: { id: "u1", nickname: "partial" } }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user?.handle).toBe("from-me-endpoint");
    expect(urls(request)).toEqual([REFRESH, ME_URL]);
  });

  it("an unfinished sign-up is still sent to its onboarding step from the carried user", async () => {
    window.history.replaceState(null, "", "/en/bounties");
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    const request = stubSession(() => ({ accessToken: "access", user: { ...FULL_ME, onboardingStep: 3, onboardingCompleted: false } }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en/signup/profile"));
    expect(urls(request)).toEqual([REFRESH]);
  });

  it("a sign-out that lands while the carried-user refresh is in flight wins: no signed-in snapshot, the re-planted cookie is revoked", async () => {
    let answer: (response: Response) => void = () => {};
    const request = vi.fn((url: string) => {
      if (url === REFRESH) return new Promise<Response>((resolve) => { answer = resolve; });
      return Promise.resolve(new Response(null, { status: url === "/api/auth/logout" ? 204 : 401 }));
    });
    vi.stubGlobal("fetch", request);
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(urls(request)).toEqual([REFRESH]));
    new FakeBroadcastChannel(AUTH_CHANNEL_NAME).postMessage({ type: "signed-out" });
    answer(Response.json({ accessToken: "late-access", user: FULL_ME }));
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    await nextTurn();
    expect(adapter.getSnapshot().user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(urls(request)).toEqual([REFRESH, "/api/auth/logout"]);
  });
});

describe("login exchange carries the BE user", () => {
  async function callbackWithCode() {
    vi.stubGlobal("crypto", webcrypto);
    window.history.replaceState(null, "", "/en/auth/callback");
    await createLoginChallenge();
    window.history.replaceState(null, "", "/en/auth/callback#loginCode=code");
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, replace });
    return replace;
  }

  it("with a user: the callback signs in from the exchange alone and leaves for the hub", async () => {
    const replace = await callbackWithCode();
    const request = stubSession(() => ({ accessToken: "access" }), () => ({ accessToken: "access", user: FULL_ME }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en"));
    expect(adapter.getSnapshot().user?.handle).toBe("ninja");
    expect(urls(request)).toEqual([EXCHANGE]);
  });

  it("without a user: exchange, then GET /auth/me as before", async () => {
    const replace = await callbackWithCode();
    const request = stubSession(() => ({ accessToken: "access" }), () => ({ accessToken: "access" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/en"));
    expect(adapter.getSnapshot().user?.handle).toBe("from-me-endpoint");
    expect(urls(request)).toEqual([EXCHANGE, ME_URL]);
  });
});

describe("another tab signed in: adoption uses the carried user", () => {
  it("switches to the new account from the refresh alone, and falls back to GET /auth/me without it", async () => {
    let carried: Body | undefined = { ...FULL_ME, id: "u1", nickname: "alice" };
    const request = stubSession(() => (carried ? { accessToken: "access", user: carried } : { accessToken: "access" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().user?.handle).toBe("alice"));
    const signedInElsewhere = () => new FakeBroadcastChannel(AUTH_CHANNEL_NAME).postMessage({ type: "signed-in" });

    carried = { ...FULL_ME, id: "u2", nickname: "bob" };
    request.mockClear();
    signedInElsewhere();
    await vi.waitFor(() => expect(adapter.getSnapshot().user?.handle).toBe("bob"));
    expect(urls(request)).toEqual([REFRESH]);

    carried = undefined;
    request.mockClear();
    signedInElsewhere();
    await vi.waitFor(() => expect(adapter.getSnapshot().user?.handle).toBe("from-me-endpoint"));
    expect(urls(request)).toEqual([REFRESH, ME_URL]);
  });
});
