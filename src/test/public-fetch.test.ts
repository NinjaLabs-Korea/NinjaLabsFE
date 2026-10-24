import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime/config", () => ({
  loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "https://be.example/" }),
}));

const { fetchPublicJson, PUBLIC_FETCH_TIMEOUT_MS } = await import("@/lib/api/public");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPublicJson", () => {
  it("passes no-store and an abort signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicJson("/bounties")).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://be.example/bounties");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(PUBLIC_FETCH_TIMEOUT_MS).toBe(8000);
  });

  it("rejects when the BE hangs past the timeout", async () => {
    // AbortSignal.timeout runs on a native timer that fake timers do not control, so use a short real one.
    const real = AbortSignal.timeout.bind(AbortSignal);
    const spy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => real(20));
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
      ),
    );
    await expect(fetchPublicJson("/notices")).rejects.toMatchObject({ name: "TimeoutError" });
    expect(spy).toHaveBeenCalledWith(PUBLIC_FETCH_TIMEOUT_MS);
    spy.mockRestore();
  });

  it("still throws on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 429 })));
    await expect(fetchPublicJson("/members")).rejects.toThrow("Public API 429: /members");
  });
});
