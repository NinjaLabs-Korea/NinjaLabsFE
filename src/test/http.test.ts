// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { ApiHttpError, clearTokens, createApiHttp, getTokens, setTokens } from "@/lib/api/http";

const API = "https://api.example";

/** First /auth/me answers 401; /auth/refresh answers `refresh`; a retried /auth/me succeeds. */
function stubRefreshFlow(refresh: () => Response | Promise<Response>) {
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === `${API}/auth/refresh`) return refresh();
    const authorization = new Headers(init?.headers).get("authorization");
    return authorization === "Bearer fresh-access"
      ? Response.json({ id: "u1", nickname: "ninja", onboardingStep: 4, onboardingCompleted: true, isAdmin: false })
      : new Response(null, { status: 401 });
  });
  vi.stubGlobal("fetch", request);
  return request;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setTokens("stale-access", "refresh-1");
});
afterEach(() => vi.unstubAllGlobals());

describe("API refresh rotation", () => {
  it("rotates tokens and retries the request once after a 401", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    const http = createApiHttp(API);
    await expect(http.fetchJson<{ id: string }>("/auth/me")).resolves.toMatchObject({ id: "u1" });
    expect(getTokens()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-2" });
    expect(request.mock.calls.map(([url]) => url)).toEqual([`${API}/auth/me`, `${API}/auth/refresh`, `${API}/auth/me`]);
  });

  it.each([401, 403])("clears the session when /auth/refresh rejects the refresh token with %i", async (status) => {
    stubRefreshFlow(() => new Response(null, { status }));
    const http = createApiHttp(API);
    const error = await http.fetchJson("/auth/me").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(401);
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
    expect(http.hasSession()).toBe(false);
  });

  it.each([429, 500, 503])("keeps the session when /auth/refresh answers %i and reports REFRESH_UNAVAILABLE", async (status) => {
    const request = stubRefreshFlow(() => new Response(null, { status }));
    const http = createApiHttp(API);
    const error = await http.fetchJson("/auth/me").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({ status, code: "REFRESH_UNAVAILABLE" });
    expect(getTokens()).toEqual({ accessToken: "stale-access", refreshToken: "refresh-1" });
    expect(http.hasSession()).toBe(true);
    // No retry with the same stale token.
    expect(request.mock.calls.map(([url]) => url)).toEqual([`${API}/auth/me`, `${API}/auth/refresh`]);
  });

  it("keeps the session when /auth/refresh is unreachable", async () => {
    stubRefreshFlow(() => Promise.reject(new TypeError("Failed to fetch")));
    const http = createApiHttp(API);
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 0, code: "REFRESH_UNAVAILABLE" });
    expect(getTokens()).toEqual({ accessToken: "stale-access", refreshToken: "refresh-1" });
  });

  it("merges concurrent 401s into a single refresh", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    const http = createApiHttp(API);
    await Promise.all([http.fetchJson("/auth/me"), http.fetchJson("/auth/me")]);
    expect(request.mock.calls.filter(([url]) => url === `${API}/auth/refresh`)).toHaveLength(1);
  });

  it("surfaces the original 401 without calling refresh when there is no refresh token", async () => {
    setTokens("stale-access", null);
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(request.mock.calls.map(([url]) => url)).toEqual([`${API}/auth/me`]);
  });

  it("refreshes once on a 401 from fetchForm and retries the upload with the new access token", async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API}/auth/refresh`) return Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" });
      const authorization = new Headers(init?.headers).get("authorization");
      return authorization === "Bearer fresh-access" && init?.body instanceof FormData
        ? Response.json({ url: "/media/x.png" })
        : new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", request);
    const form = new FormData();
    form.set("file", new Blob(["x"]), "x.png");
    await expect(createApiHttp(API).fetchForm<{ url: string }>("/admin/media", form)).resolves.toEqual({ url: "/media/x.png" });
    expect(getTokens()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-2" });
    expect(request.mock.calls.map(([url]) => url)).toEqual([`${API}/admin/media`, `${API}/auth/refresh`, `${API}/admin/media`]);
  });

  it("keeps the rotated tokens when the retried request answers 401 again", async () => {
    const request = vi.fn(async (url: string) =>
      url === `${API}/auth/refresh`
        ? Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" })
        : new Response(JSON.stringify({ message: "FORBIDDEN_SCOPE" }), { status: 401 }),
    );
    vi.stubGlobal("fetch", request);
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 401, code: "FORBIDDEN_SCOPE" });
    expect(getTokens()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-2" });
    expect(request.mock.calls.map(([url]) => url)).toEqual([`${API}/auth/me`, `${API}/auth/refresh`, `${API}/auth/me`]);
  });
});

/** Minimal in-process Web Locks: one holder per name, FIFO waiters - enough to serialize two "tabs". */
function stubWebLocks() {
  const queues = new Map<string, Array<() => void>>();
  const request = vi.fn(async (name: string, callback: () => Promise<unknown>) => {
    const queue = queues.get(name) ?? [];
    queues.set(name, queue);
    if (queue.length > 0) await new Promise<void>((resolve) => queue.push(resolve));
    else queue.push(() => undefined);
    try {
      return await callback();
    } finally {
      queue.shift();
      queue[0]?.();
    }
  });
  Object.defineProperty(window.navigator, "locks", { configurable: true, value: { request } });
  return request;
}

describe("API refresh across tabs", () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "locks");
  });

  it("serializes refresh through the Web Lock and lets the second tab reuse the rotated tokens", async () => {
    const locks = stubWebLocks();
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    // Two tabs share localStorage but not the in-memory single-flight.
    const tabA = createApiHttp(API);
    const tabB = createApiHttp(API);
    await expect(Promise.all([tabA.fetchJson("/auth/me"), tabB.fetchJson("/auth/me")])).resolves.toHaveLength(2);
    expect(locks).toHaveBeenCalledTimes(2);
    expect(locks.mock.calls.map(([name]) => name)).toEqual(["ninja.auth.refresh", "ninja.auth.refresh"]);
    // The loser re-read storage inside the lock, saw the rotated refresh token, and skipped the network call.
    expect(request.mock.calls.filter(([url]) => url === `${API}/auth/refresh`)).toHaveLength(1);
    expect(getTokens()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-2" });
  });

  it("does not clear the winner's rotated tokens when a racing refresh with the stale token is rejected", async () => {
    // No Web Locks: both tabs send refresh-1; the BE's conditional UPDATE accepts the first and rejects the second.
    const pendingRefreshes: Array<(response: Response) => void> = [];
    const request = stubRefreshFlow(() => new Promise<Response>((resolve) => { pendingRefreshes.push(resolve); }));
    const tabA = createApiHttp(API);
    const tabB = createApiHttp(API);
    const winner = tabA.fetchJson("/auth/me");
    const loser = tabB.fetchJson("/auth/me");
    await vi.waitFor(() => expect(pendingRefreshes).toHaveLength(2));
    pendingRefreshes[0](Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    await vi.waitFor(() => expect(getTokens().refreshToken).toBe("refresh-2"));
    pendingRefreshes[1](new Response(null, { status: 401 }));
    await expect(winner).resolves.toMatchObject({ id: "u1" });
    await expect(loser).rejects.toMatchObject({ status: 401 });
    expect(request.mock.calls.filter(([url]) => url === `${API}/auth/refresh`)).toHaveLength(2);
    // The loser's refresh-1 is no longer the stored token, so it must not wipe the winner's session.
    expect(getTokens()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-2" });
    expect(tabB.hasSession()).toBe(true);
  });

  it("still clears the session when the rejected refresh token is the one in storage", async () => {
    stubWebLocks();
    stubRefreshFlow(() => new Response(null, { status: 401 }));
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe("API refresh vs sign-out", () => {
  it("discards tokens from a refresh that resolves after sign-out and revokes them remotely", async () => {
    let resolveRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API}/auth/refresh`) return refreshResponse;
      if (url === `${API}/auth/logout`) return new Response(null, { status: 204 });
      const authorization = new Headers(init?.headers).get("authorization");
      return authorization === "Bearer fresh-access" ? Response.json({ id: "u1" }) : new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", request);
    const http = createApiHttp(API);
    const pending = http.fetchJson("/auth/me");
    await vi.waitFor(() => expect(request.mock.calls.some(([url]) => url === `${API}/auth/refresh`)).toBe(true));

    await http.signOutRemote();
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });

    resolveRefresh(Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
    expect(http.hasSession()).toBe(false);
    const logouts = request.mock.calls.filter(([url]) => url === `${API}/auth/logout`).map(([, init]) => JSON.parse(String(init?.body)));
    expect(logouts).toEqual([{ refreshToken: "refresh-1" }, { refreshToken: "refresh-2" }]);
  });

  it("treats a local clearTokens() during refresh the same way", async () => {
    let resolveRefresh!: (response: Response) => void;
    const request = stubRefreshFlow(() => new Promise<Response>((resolve) => { resolveRefresh = resolve; }));
    const http = createApiHttp(API);
    const pending = http.fetchJson("/auth/me");
    await vi.waitFor(() => expect(request.mock.calls.some(([url]) => url === `${API}/auth/refresh`)).toBe(true));
    clearTokens();
    resolveRefresh(Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getTokens()).toEqual({ accessToken: null, refreshToken: null });
  });
});

describe("API auth adapter session restore", () => {
  it("ends signed-out but keeps the refresh token when refresh is throttled during initialize", async () => {
    window.history.replaceState(null, "", "/en/bounties");
    stubRefreshFlow(() => new Response(null, { status: 429 }));
    const adapter = createApiAuthAdapter(API);
    expect(adapter.getSnapshot().status).toBe("loading");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    expect(getTokens()).toEqual({ accessToken: "stale-access", refreshToken: "refresh-1" });
    expect(adapter.http.hasSession()).toBe(true);
  });

  it("restores the session through a successful refresh", async () => {
    window.history.replaceState(null, "", "/en/bounties");
    stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "refresh-2" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user?.handle).toBe("ninja");
  });
});
