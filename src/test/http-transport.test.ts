// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EVENT_STORAGE_KEY, createAuthEventBus } from "@/lib/api/auth-events";
import {
  allowSessionRefresh,
  ApiHttpError,
  API_REQUEST_TIMEOUT_MS,
  API_UPLOAD_TIMEOUT_MS,
  AUTH_REQUEST_TIMEOUT_MS,
  cookieAuthInit,
  createApiHttp,
  endLocalSession,
  getAccessToken,
  installSession,
  resetSessionState,
  toApiHttpError,
} from "@/lib/api/http";
import { validationFieldsFromError, validationFieldsFromMessages } from "@/lib/api/validation";
import { FakeBroadcastChannel } from "./fake-broadcast-channel";

const API = "https://api.example/";
const REFRESH = "/api/auth/refresh";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSessionState();
  FakeBroadcastChannel.instances = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, "locks");
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("toApiHttpError (Nest error bodies -> code)", () => {
  it.each([
    ["a ValidationPipe message array", json({ message: ["nickname must match", 42, "bio should not be empty"] }, 400), 400, "VALIDATION_FAILED", ["nickname must match", "bio should not be empty"]],
    ["a string message", json({ message: "NICKNAME_TAKEN", statusCode: 409 }, 409), 409, "NICKNAME_TAKEN", []],
    ["an empty string message", json({ message: "" }, 400), 400, "UNKNOWN_ERROR", []],
    ["a non-string message", json({ message: { nested: true } }, 500), 500, "UNKNOWN_ERROR", []],
    ["a non-JSON body (proxy error page)", new Response("<html>Bad gateway</html>", { status: 502 }), 502, "UNKNOWN_ERROR", []],
    ["an empty body", new Response(null, { status: 503 }), 503, "UNKNOWN_ERROR", []],
  ])("maps %s", async (_label, response, status, code, details) => {
    const error = await toApiHttpError(response);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({ status, code, details, message: `API ${status}: ${code}` });
  });
});

describe("validation field hints", () => {
  it("reads the property from class-validator messages, keeps the first message per field and skips the rest", () => {
    expect(validationFieldsFromMessages([
      "nickname must match /regex/ regular expression",
      "nickname must be longer than or equal to 2 characters",
      "reward.amount must be a numeric string",
      "bio should not be empty",
      "tags has duplicate values",
      "Something unrelated happened",
      "coverImageUrl is a reserved word",
    ])).toEqual({
      nickname: "nickname must match /regex/ regular expression",
      "reward.amount": "reward.amount must be a numeric string",
      bio: "bio should not be empty",
      tags: "tags has duplicate values",
      coverImageUrl: "coverImageUrl is a reserved word",
    });
  });

  it("only reads VALIDATION_FAILED errors", () => {
    expect(validationFieldsFromError(new ApiHttpError(400, "VALIDATION_FAILED", ["title must be a string"]))).toEqual({ title: "title must be a string" });
    expect(validationFieldsFromError(new ApiHttpError(409, "NICKNAME_TAKEN", ["title must be a string"]))).toEqual({});
    expect(validationFieldsFromError(new Error("title must be a string"))).toEqual({});
  });
});

describe("fetchJson request shape", () => {
  it("joins the base URL without a double slash, sends JSON only with a body and the bearer only with a session", async () => {
    const request = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", request);
    const http = createApiHttp(API);
    await http.fetchJson("/bounties");
    installSession("access-1");
    await http.fetchJson("/bounties/b1/applications", { method: "POST", body: { message: "m" } });

    const [firstUrl, firstInit] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstUrl).toBe("https://api.example/bounties");
    expect(firstInit).toMatchObject({ method: "GET", cache: "no-store", body: undefined });
    const firstHeaders = new Headers(firstInit.headers);
    expect(firstHeaders.has("authorization")).toBe(false);
    expect(firstHeaders.has("content-type")).toBe(false);
    // API calls are cross-origin bearer calls: never cookie credentials.
    expect(firstInit.credentials).toBeUndefined();

    const [, secondInit] = request.mock.calls[1] as unknown as [string, RequestInit];
    const secondHeaders = new Headers(secondInit.headers);
    expect(secondInit.method).toBe("POST");
    expect(secondInit.body).toBe(JSON.stringify({ message: "m" }));
    expect(secondHeaders.get("authorization")).toBe("Bearer access-1");
    expect(secondHeaders.get("content-type")).toBe("application/json");
  });

  it("returns undefined for 204 and throws the BE code for other failures without refreshing", async () => {
    const request = vi.fn(async (url: string) => {
      if (url.endsWith("/empty")) return new Response(null, { status: 204 });
      return json({ message: "FORBIDDEN_ROLE" }, 403);
    });
    vi.stubGlobal("fetch", request);
    installSession("access-1");
    const http = createApiHttp(API);
    await expect(http.fetchJson("/empty", { method: "DELETE" })).resolves.toBeUndefined();
    await expect(http.fetchJson("/admin/users")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN_ROLE" });
    expect(request.mock.calls.map(([url]) => url)).not.toContain(REFRESH);
    expect(getAccessToken()).toBe("access-1");
  });

  it("sends uploads as the raw FormData without a JSON content-type", async () => {
    const request = vi.fn(async () => json({ id: "m1", url: "/media/x" }));
    vi.stubGlobal("fetch", request);
    installSession("access-1");
    const form = new FormData();
    form.set("file", new File(["x"], "x.png"));
    await expect(createApiHttp(API).fetchForm("/admin/media", form)).resolves.toEqual({ id: "m1", url: "/media/x" });
    const [, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(form);
    expect(new Headers(init.headers).has("content-type")).toBe(false);
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer access-1");
  });

  it("cookie-mode auth requests are same-origin POSTs with credentials and the opt-in session header", () => {
    const init = cookieAuthInit({ code: "c" });
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "include", body: "{\"code\":\"c\"}" });
    expect(new Headers(init.headers).get("x-ninja-session")).toBe("cookie");
  });

  it("bounds every cookie-mode auth request so a hung BE cannot hold the cross-tab refresh lock", () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      const init = cookieAuthInit({});
      expect(timeout).toHaveBeenCalledWith(AUTH_REQUEST_TIMEOUT_MS);
      expect(init.signal).toBeInstanceOf(AbortSignal);
    } finally {
      timeout.mockRestore();
    }
  });
});

describe("authenticated request timeouts", () => {
  it("bounds JSON calls and uploads so a hung BE cannot leave a view pending forever", async () => {
    const request = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", request);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      const http = createApiHttp(API);
      await http.fetchJson("/auth/me");
      await http.fetchForm("/admin/media", new FormData());
      expect(timeout).toHaveBeenNthCalledWith(1, API_REQUEST_TIMEOUT_MS);
      expect(timeout).toHaveBeenNthCalledWith(2, API_UPLOAD_TIMEOUT_MS);
      for (const [, init] of request.mock.calls as unknown as [string, RequestInit][]) expect(init.signal).toBeInstanceOf(AbortSignal);
    } finally {
      timeout.mockRestore();
    }
  });
});

describe("refresh edge cases", () => {
  /** API answers 401 unless it carries `Bearer fresh`; refresh answers `refresh`. */
  function stub(refresh: () => Response | Promise<Response>) {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === REFRESH) return refresh();
      return new Headers(init?.headers).get("authorization") === "Bearer fresh" ? json({ ok: true }) : new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", request);
    return request;
  }
  const refreshCount = (request: ReturnType<typeof vi.fn>) => request.mock.calls.filter(([url]) => url === REFRESH).length;

  it.each([
    ["no accessToken field", { refreshToken: "only" }],
    ["an empty accessToken", { accessToken: "" }],
    ["a non-string accessToken", { accessToken: 42 }],
  ])("treats a 200 refresh with %s as unavailable and keeps the session", async (_label, body) => {
    stub(() => json(body));
    installSession("stale");
    const ended = vi.fn();
    const http = createApiHttp(API, { onSessionEnded: ended });
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 200, code: "REFRESH_UNAVAILABLE" });
    expect(getAccessToken()).toBe("stale");
    expect(ended).not.toHaveBeenCalled();
  });

  it("re-enables refresh after another tab signs in, but not before", async () => {
    const request = stub(() => json({ accessToken: "fresh" }));
    endLocalSession();
    const http = createApiHttp(API);
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(refreshCount(request)).toBe(0);
    allowSessionRefresh();
    await expect(http.fetchJson("/auth/me")).resolves.toEqual({ ok: true });
    expect(refreshCount(request)).toBe(1);
    expect(getAccessToken()).toBe("fresh");
  });

  it("broadcasts signed-out once and ends the UI session when a mid-session refresh is rejected", async () => {
    stub(() => new Response(null, { status: 401 }));
    installSession("stale");
    const ended = vi.fn();
    const broadcast = vi.fn();
    const http = createApiHttp(API, { onSessionEnded: ended, broadcast });
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 401, code: "UNKNOWN_ERROR" });
    await expect(http.fetchJson("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(broadcast.mock.calls).toEqual([["signed-out"]]);
    // The second 401 does not refresh again (the cookie is known absent) but still tells the UI the session is over.
    expect(ended).toHaveBeenCalledTimes(2);
    expect(http.hasSession()).toBe(false);
  });

  it("falls back to the in-tab single flight when the Web Lock cannot be acquired", async () => {
    const lockRequest = vi.fn(async () => {
      throw new DOMException("The document is not fully active.", "InvalidStateError");
    });
    Object.defineProperty(window.navigator, "locks", { configurable: true, value: { request: lockRequest } });
    const request = stub(() => json({ accessToken: "fresh" }));
    const http = createApiHttp(API);
    await expect(Promise.all([http.fetchJson("/auth/me"), http.fetchJson("/auth/me")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(lockRequest).toHaveBeenCalled();
    expect(refreshCount(request)).toBe(1);
  });

  it("does not run the refresh twice when it fails inside an acquired lock", async () => {
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request: vi.fn(async (_name: string, task: () => Promise<unknown>) => task()) },
    });
    const request = stub(() => {
      throw new TypeError("Failed to fetch");
    });
    installSession("stale");
    await expect(createApiHttp(API).fetchJson("/auth/me")).rejects.toMatchObject({ status: 0, code: "REFRESH_UNAVAILABLE" });
    expect(refreshCount(request)).toBe(1);
  });
});

describe("auth event bus", () => {
  it("delivers only well-formed events from other tabs and stops after unsubscribe", () => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    const tabA = createAuthEventBus();
    const tabB = createAuthEventBus();
    const received: string[] = [];
    const unsubscribe = tabB.subscribe((event) => received.push(event));
    const own: string[] = [];
    tabA.subscribe((event) => own.push(event));

    tabA.broadcast("signed-in");
    tabA.broadcast("signed-out");
    for (const data of [{ type: "hijack" }, "signed-out", null, { kind: "signed-out" }]) {
      FakeBroadcastChannel.instances[0].postMessage(data);
    }
    unsubscribe();
    tabA.broadcast("signed-out");

    expect(received).toEqual(["signed-in", "signed-out"]);
    expect(own).toEqual([]);
  });

  it("without BroadcastChannel, writes only a timestamp for signed-out and nothing for signed-in", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const bus = createAuthEventBus();
    bus.broadcast("signed-in");
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toBeNull();
    bus.broadcast("signed-out");
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toMatch(/^\d+$/);
  });

  it("swallows a closed channel and a channel constructor that throws", () => {
    vi.stubGlobal("BroadcastChannel", class {
      constructor() {
        throw new Error("blocked");
      }
    });
    const bus = createAuthEventBus();
    expect(() => bus.broadcast("signed-out")).not.toThrow();
    // Falls back to the storage path when the channel cannot be opened.
    expect(localStorage.getItem(AUTH_EVENT_STORAGE_KEY)).toMatch(/^\d+$/);

    vi.stubGlobal("BroadcastChannel", class extends FakeBroadcastChannel {
      postMessage() {
        throw new DOMException("closed", "InvalidStateError");
      }
    });
    expect(() => createAuthEventBus().broadcast("signed-out")).not.toThrow();
  });
});
