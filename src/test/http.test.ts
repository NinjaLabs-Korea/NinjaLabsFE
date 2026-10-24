// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { AUTH_CHANNEL_NAME, AUTH_EVENT_STORAGE_KEY } from "@/lib/api/auth-events";
import {
  ApiHttpError,
  createApiHttp,
  endLocalSession,
  getAccessToken,
  installSession,
  resetSessionState,
} from "@/lib/api/http";
import { FakeBroadcastChannel } from "./fake-broadcast-channel";

const API = "https://api.example";
const REFRESH = "/api/auth/refresh";
const LOGOUT = "/api/auth/logout";
const me = { id: "u1", nickname: "ninja", onboardingStep: 4, onboardingCompleted: true, isAdmin: false };

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** /auth/me answers 401 unless it carries `Bearer fresh-access`; /api/auth/refresh answers `refresh`. */
function stubRefreshFlow(refresh: Handler, extra?: Handler) {
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === REFRESH) return refresh(url, init);
    if (extra && !url.startsWith(API)) return extra(url, init);
    const authorization = new Headers(init?.headers).get("authorization");
    return authorization === "Bearer fresh-access" ? Response.json(me) : new Response(null, { status: 401 });
  });
  vi.stubGlobal("fetch", request);
  return request;
}

const urls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.map(([url]) => url as string);
const refreshCalls = (request: ReturnType<typeof vi.fn>) => request.mock.calls.filter(([url]) => url === REFRESH);

/** Every key Web Storage holds must be non-secret: no token-shaped value is ever written. */
function expectNoTokensInStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)!;
      expect(key).not.toMatch(/token/i);
      expect(storage.getItem(key)).not.toMatch(/access|refresh/);
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSessionState();
  window.history.replaceState(null, "", "/en/bounties");
  // Node's real BroadcastChannel would deliver asynchronously to adapters left over from earlier tests.
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});
afterEach(() => {
  expectNoTokensInStorage();
  vi.unstubAllGlobals();
});

describe("cookie-mode refresh request", () => {
  it("posts {} to the same-origin /api/auth/refresh with credentials and the session header, keeping the token in memory", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const http = createApiHttp(API);
    await expect(http.initSession()).resolves.toEqual({ ok: true });
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(REFRESH);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("x-ninja-session")).toBe("cookie");
    expect(JSON.parse(String(init.body))).toEqual({});
    expect(getAccessToken()).toBe("fresh-access");
    expect(http.hasSession()).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("sends API calls cross-origin with the Bearer access token and no cookie credentials", async () => {
    installSession("fresh-access");
    const request = stubRefreshFlow(() => new Response(null, { status: 500 }));
    await expect(createApiHttp(`${API}/`).fetchJson("/auth/me")).resolves.toMatchObject({ id: "u1" });
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/auth/me`);
    expect(init.credentials).toBeUndefined();
    expect(new Headers(init.headers).get("x-ninja-session")).toBeNull();
  });

  it("ignores a refreshToken in the refresh body (older BE) and never stores it", async () => {
    stubRefreshFlow(() => Response.json({ accessToken: "fresh-access", refreshToken: "leaked-refresh" }));
    await createApiHttp(API).initSession();
    expect(getAccessToken()).toBe("fresh-access");
    expect(JSON.stringify({ ...localStorage })).not.toContain("leaked-refresh");
  });
});

describe("API refresh rotation", () => {
  it("refreshes and retries the request once after a 401", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const http = createApiHttp(API);
    await expect(http.fetchJson<{ id: string }>("/auth/me")).resolves.toMatchObject({ id: "u1" });
    expect(getAccessToken()).toBe("fresh-access");
    expect(urls(request)).toEqual([`${API}/auth/me`, REFRESH, `${API}/auth/me`]);
  });

  it.each([401, 403])("ends the session when /api/auth/refresh answers %i", async (status) => {
    installSession("stale-access");
    stubRefreshFlow(() => new Response(null, { status }));
    const http = createApiHttp(API);
    const error = await http.fetchJson("/auth/me").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(http.hasSession()).toBe(false);
  });

  it("does not refresh again after the session was rejected", async () => {
    const request = stubRefreshFlow(() => new Response(null, { status: 401 }));
    const http = createApiHttp(API);
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls(request)).toHaveLength(1);
  });

  it.each([429, 500, 503])("keeps the access token when /api/auth/refresh answers %i and reports REFRESH_UNAVAILABLE", async (status) => {
    installSession("stale-access");
    const request = stubRefreshFlow(() => new Response(null, { status }));
    const http = createApiHttp(API);
    const error = await http.fetchJson("/auth/me").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status, code: "REFRESH_UNAVAILABLE" });
    expect(getAccessToken()).toBe("stale-access");
    expect(urls(request)).toEqual([`${API}/auth/me`, REFRESH]);
  });

  it("keeps the session when /api/auth/refresh is unreachable", async () => {
    installSession("stale-access");
    stubRefreshFlow(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 0, code: "REFRESH_UNAVAILABLE" });
    expect(getAccessToken()).toBe("stale-access");
  });

  it("merges concurrent 401s into a single refresh", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const http = createApiHttp(API);
    await Promise.all([http.fetchJson("/auth/me"), http.fetchJson("/auth/me")]);
    expect(refreshCalls(request)).toHaveLength(1);
  });

  it("refreshes once on a 401 from fetchForm and retries the upload with the new access token", async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === REFRESH) return Response.json({ accessToken: "fresh-access" });
      const authorization = new Headers(init?.headers).get("authorization");
      return authorization === "Bearer fresh-access" && init?.body instanceof FormData
        ? Response.json({ url: "/media/x.png" })
        : new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", request);
    const form = new FormData();
    form.set("file", new Blob(["x"]), "x.png");
    await expect(createApiHttp(API).fetchForm<{ url: string }>("/admin/media", form)).resolves.toEqual({ url: "/media/x.png" });
    expect(urls(request)).toEqual([`${API}/admin/media`, REFRESH, `${API}/admin/media`]);
  });

  it("keeps the new access token when the retried request answers 401 again", async () => {
    const request = vi.fn(async (url: string) =>
      url === REFRESH
        ? Response.json({ accessToken: "fresh-access" })
        : new Response(JSON.stringify({ message: "FORBIDDEN_SCOPE" }), { status: 401 }),
    );
    vi.stubGlobal("fetch", request);
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 401, code: "FORBIDDEN_SCOPE" });
    expect(getAccessToken()).toBe("fresh-access");
    expect(urls(request)).toEqual([`${API}/auth/me`, REFRESH, `${API}/auth/me`]);
  });
});

describe("legacy localStorage migration", () => {
  it("sends the legacy refresh token once in the body, then deletes both legacy keys", async () => {
    localStorage.setItem("ninja.accessToken", "old-access");
    localStorage.setItem("ninja.refreshToken", "old-refresh");
    const request = stubRefreshFlow(() => {
      // The keys are still there while the BE converts the token into the cookie.
      expect(localStorage.getItem("ninja.refreshToken")).toBe("old-refresh");
      return Response.json({ accessToken: "fresh-access" });
    });
    await expect(createApiHttp(API).initSession()).resolves.toEqual({ ok: true });
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(REFRESH);
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("x-ninja-session")).toBe("cookie");
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "old-refresh" });
    expect(localStorage.getItem("ninja.accessToken")).toBeNull();
    expect(localStorage.getItem("ninja.refreshToken")).toBeNull();
    expect(getAccessToken()).toBe("fresh-access");
  });

  it.each([401, 500])("deletes the legacy keys even when the migration answers %i", async (status) => {
    localStorage.setItem("ninja.accessToken", "old-access");
    localStorage.setItem("ninja.refreshToken", "old-refresh");
    stubRefreshFlow(() => new Response(null, { status }));
    const result = await createApiHttp(API).initSession();
    expect(result.ok).toBe(false);
    expect(localStorage.getItem("ninja.accessToken")).toBeNull();
    expect(localStorage.getItem("ninja.refreshToken")).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("drops a stray legacy access token and probes the cookie with an empty body", async () => {
    localStorage.setItem("ninja.accessToken", "old-access");
    const request = stubRefreshFlow(() => new Response(null, { status: 401 }));
    await createApiHttp(API).initSession();
    expect(JSON.parse(String((request.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({});
    expect(localStorage.getItem("ninja.accessToken")).toBeNull();
  });

  it("a second tab that waited for the lock uses the cookie the first tab's migration planted", async () => {
    stubWebLocks();
    localStorage.setItem("ninja.refreshToken", "old-refresh");
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    await Promise.all([createApiHttp(API).initSession(), createApiHttp(API).initSession()]);
    const bodies = refreshCalls(request).map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toEqual([{ refreshToken: "old-refresh" }, {}]);
    Reflect.deleteProperty(window.navigator, "locks");
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

  it("serializes refreshes through the Web Lock so two tabs never race the same cookie", async () => {
    const locks = stubWebLocks();
    let inFlight = 0;
    let maxInFlight = 0;
    const request = stubRefreshFlow(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return Response.json({ accessToken: "fresh-access" });
    });
    // Two tabs share the cookie jar but not the in-memory single-flight (each needs its own access token).
    const tabA = createApiHttp(API);
    const tabB = createApiHttp(API);
    await expect(Promise.all([tabA.fetchJson("/auth/me"), tabB.fetchJson("/auth/me")])).resolves.toHaveLength(2);
    expect(locks.mock.calls.map(([name]) => name)).toEqual(["ninja.auth.refresh", "ninja.auth.refresh"]);
    expect(refreshCalls(request)).toHaveLength(2);
    expect(maxInFlight).toBe(1);
  });

  it("dedupes concurrent refreshes inside one tab even with the lock", async () => {
    stubWebLocks();
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const http = createApiHttp(API);
    await Promise.all([http.fetchJson("/auth/me"), http.fetchJson("/auth/me"), http.fetchJson("/auth/me")]);
    expect(refreshCalls(request)).toHaveLength(1);
  });
});

describe("API refresh vs sign-out", () => {
  it("discards an access token from a refresh that resolves after sign-out and revokes the re-planted cookie", async () => {
    let resolveRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    const request = stubRefreshFlow(() => refreshResponse, (url) =>
      url === LOGOUT ? new Response(null, { status: 204 }) : new Response(null, { status: 404 }));
    const http = createApiHttp(API);
    const pending = http.fetchJson("/auth/me");
    await vi.waitFor(() => expect(refreshCalls(request)).toHaveLength(1));

    await http.signOutRemote();
    expect(getAccessToken()).toBeNull();

    resolveRefresh(Response.json({ accessToken: "fresh-access" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(http.hasSession()).toBe(false);
    const logouts = request.mock.calls.filter(([url]) => url === LOGOUT) as Array<[string, RequestInit]>;
    expect(logouts).toHaveLength(2);
    for (const [, init] of logouts) {
      expect(init.credentials).toBe("include");
      expect(new Headers(init.headers).get("x-ninja-session")).toBe("cookie");
      expect(JSON.parse(String(init.body))).toEqual({});
    }
  });

  it("treats a local session end during refresh the same way", async () => {
    let resolveRefresh!: (response: Response) => void;
    const request = stubRefreshFlow(() => new Promise<Response>((resolve) => { resolveRefresh = resolve; }),
      () => new Response(null, { status: 204 }));
    const http = createApiHttp(API);
    const pending = http.fetchJson("/auth/me");
    await vi.waitFor(() => expect(refreshCalls(request)).toHaveLength(1));
    endLocalSession();
    resolveRefresh(Response.json({ accessToken: "fresh-access" }));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
  });

  it("does not refresh after sign-out, so a racing refresh cannot re-plant the cookie", async () => {
    installSession("fresh-access");
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }), () => new Response(null, { status: 204 }));
    const http = createApiHttp(API);
    await http.signOutRemote();
    await expect(http.fetchJson("/bounties/mine")).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls(request)).toHaveLength(0);
  });
});

describe("API auth adapter session restore", () => {
  it("restores the session through the init refresh and then /auth/me", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(adapter.getSnapshot().user?.handle).toBe("ninja");
    expect(urls(request)).toEqual([REFRESH, `${API}/auth/me`]);
  });

  it("is signed-out after a 401 init refresh without calling /auth/me", async () => {
    const request = stubRefreshFlow(() => new Response(null, { status: 401 }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    expect(urls(request)).toEqual([REFRESH]);
  });

  it.each([429, 503])("ends signed-out when the init refresh answers %i and retries the refresh on the next action", async (status) => {
    let refreshStatus = status;
    const request = stubRefreshFlow(() =>
      refreshStatus === 200 ? Response.json({ accessToken: "fresh-access" }) : new Response(null, { status: refreshStatus }));
    const adapter = createApiAuthAdapter(API);
    expect(adapter.getSnapshot().status).toBe("loading");
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
    expect(adapter.http.hasSession()).toBe(false);
    expect(urls(request)).toEqual([REFRESH]);

    // The BE recovered: the next authenticated call's 401 tries the cookie again instead of giving up.
    refreshStatus = 200;
    await expect(adapter.http.fetchJson("/auth/me")).resolves.toMatchObject({ id: "u1" });
    expect(refreshCalls(request)).toHaveLength(2);
  });

  it("does not crash when the init refresh is unreachable", async () => {
    stubRefreshFlow(() => Promise.reject(new TypeError("Failed to fetch")));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-out"));
  });

  it("migrates a legacy refresh token during initialize and never leaves tokens in localStorage", async () => {
    localStorage.setItem("ninja.accessToken", "old-access");
    localStorage.setItem("ninja.refreshToken", "old-refresh");
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    expect(JSON.parse(String((request.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ refreshToken: "old-refresh" });
    expect(localStorage.length).toBe(0);
  });

  it("signs out through the same-origin logout and leaves nothing in storage", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }), () => new Response(null, { status: 204 }));
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    await expect(adapter.signOut()).resolves.toEqual({ status: "signed-out", user: null });
    expect(urls(request)).toContain(LOGOUT);
    expect(getAccessToken()).toBeNull();
  });
});

describe("API auth adapter cross-tab sign-out", () => {
  async function signedInTab() {
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    return adapter;
  }

  it("moves another tab to signed-out through BroadcastChannel('ninja-auth') on sign-out", async () => {
    const request = stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }), () => new Response(null, { status: 204 }));
    const tabA = await signedInTab();
    const tabB = await signedInTab();
    const listener = vi.fn();
    tabB.subscribe(listener);
    await tabA.signOut();
    expect(FakeBroadcastChannel.instances.map((channel) => channel.name)).toEqual([AUTH_CHANNEL_NAME, AUTH_CHANNEL_NAME]);
    expect(tabB.getSnapshot()).toEqual({ status: "signed-out", user: null });
    expect(listener).toHaveBeenCalled();
    // The receiving tab dropped its access token and does not refresh into the revoked cookie.
    await expect(tabB.http.fetchJson("/bounties/mine")).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls(request)).toHaveLength(2);
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toBeNull();
  });

  it("moves another tab to signed-out when this tab's refresh is rejected mid-session", async () => {
    let reject = false;
    stubRefreshFlow(() => (reject ? new Response(null, { status: 401 }) : Response.json({ accessToken: "fresh-access" })));
    const tabA = await signedInTab();
    const tabB = await signedInTab();
    reject = true;
    installSession("expired-access");
    await expect(tabA.http.fetchJson("/bounties/mine")).rejects.toMatchObject({ status: 401 });
    expect(tabA.getSnapshot().status).toBe("signed-out");
    expect(tabB.getSnapshot().status).toBe("signed-out");
  });

  it("does not broadcast a sign-out for a signed-out page-load probe", async () => {
    let answer = 200;
    stubRefreshFlow(() => (answer === 200 ? Response.json({ accessToken: "fresh-access" }) : new Response(null, { status: answer })));
    const tabA = await signedInTab();
    answer = 401;
    // A new tab starts with fresh module state (the tests share one module instance between "tabs").
    resetSessionState();
    const tabB = createApiAuthAdapter(API);
    tabB.initialize?.();
    await vi.waitFor(() => expect(tabB.getSnapshot().status).toBe("signed-out"));
    expect(tabA.getSnapshot().status).toBe("signed-in");
  });

  it("ignores unrelated channel messages", async () => {
    stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const tab = await signedInTab();
    new FakeBroadcastChannel(AUTH_CHANNEL_NAME).postMessage({ type: "something-else" });
    new FakeBroadcastChannel(AUTH_CHANNEL_NAME).postMessage("signed-out");
    expect(tab.getSnapshot().status).toBe("signed-in");
  });

  it("falls back to a timestamp-only storage event when BroadcastChannel is unavailable", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }), () => new Response(null, { status: 204 }));
    const tabA = await signedInTab();
    const tabB = await signedInTab();
    await tabA.signOut();
    const value = localStorage.getItem(AUTH_EVENT_STORAGE_KEY);
    expect(value).toMatch(/^\d+$/);
    // jsdom does not fire `storage` in the same document; deliver what another tab would receive.
    window.dispatchEvent(new StorageEvent("storage", { key: AUTH_EVENT_STORAGE_KEY, oldValue: null, newValue: value }));
    expect(tabB.getSnapshot().status).toBe("signed-out");
  });

  it("ignores unrelated storage keys in the fallback", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    stubRefreshFlow(() => Response.json({ accessToken: "fresh-access" }));
    const tab = await signedInTab();
    window.dispatchEvent(new StorageEvent("storage", { key: "ninja.locale", newValue: "ko" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(tab.getSnapshot().status).toBe("signed-in");
  });
});

describe("API auth adapter session end without reload", () => {
  async function signedInAdapter(handler: Handler) {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `${API}/auth/me`) return Response.json(me);
      return handler(url, init);
    });
    vi.stubGlobal("fetch", request);
    installSession("fresh-access");
    const adapter = createApiAuthAdapter(API);
    adapter.initialize?.();
    await vi.waitFor(() => expect(adapter.getSnapshot().status).toBe("signed-in"));
    return { adapter, request };
  }

  it.each([401, 403])("moves to signed-out as soon as a mid-session refresh is rejected with %i", async (status) => {
    let initDone = false;
    const { adapter } = await signedInAdapter((url) => {
      if (url === REFRESH) {
        if (!initDone) {
          initDone = true;
          return Response.json({ accessToken: "fresh-access" });
        }
        return new Response(null, { status });
      }
      return new Response(null, { status: 401 });
    });
    await expect(adapter.http.fetchJson("/bounties/mine")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(adapter.getSnapshot()).toEqual({ status: "signed-out", user: null });
  });

  it("stays signed-in when the refresh is only throttled", async () => {
    let initDone = false;
    const { adapter } = await signedInAdapter((url) => {
      if (url === REFRESH) {
        if (!initDone) {
          initDone = true;
          return Response.json({ accessToken: "fresh-access" });
        }
        return new Response(null, { status: 429 });
      }
      return new Response(null, { status: 401 });
    });
    await expect(adapter.http.fetchJson("/bounties/mine")).rejects.toMatchObject({ code: "REFRESH_UNAVAILABLE" });
    expect(adapter.getSnapshot().status).toBe("signed-in");
  });
});
