import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime/config", () => ({
  loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "https://be.example/" }),
}));

const { fetchPublicJson, isPublicNotFound, PublicApiError, PUBLIC_DETAIL_FETCH, PUBLIC_FETCH_TIMEOUT_MS } = await import("@/lib/api/public");

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

  it("lets a list fetch use the shared Data Cache instead of no-store when asked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchPublicJson("/bounties?page=1", { revalidateSeconds: 30 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: { revalidate: number } }];
    expect(init.next).toEqual({ revalidate: 30, tags: ["public:bounties"] }); // tagged so an admin write can expire it at once
    expect(init.cache).toBeUndefined(); // both at once makes Next warn and pick no-store
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

  it("throws a PublicApiError that carries the status, and only a 404 counts as not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 404 })));
    const notFound = await fetchPublicJson("/bounties/x").catch((caught: unknown) => caught);
    expect(notFound).toBeInstanceOf(PublicApiError);
    expect(notFound).toMatchObject({ name: "PublicApiError", status: 404, path: "/bounties/x" });
    expect(isPublicNotFound(notFound)).toBe(true);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    const outage = await fetchPublicJson("/bounties/x").catch((caught: unknown) => caught);
    expect(outage).toMatchObject({ status: 500 });
    expect(isPublicNotFound(outage)).toBe(false);
    expect(isPublicNotFound(new DOMException("timeout", "TimeoutError"))).toBe(false);
    expect(isPublicNotFound(new TypeError("fetch failed"))).toBe(false);
  });

  describe("detail failure replay (Next's error-shell render calls generateMetadata again)", () => {
    afterEach(() => vi.restoreAllMocks());

    it("replays an outage to the same path inside the window without asking the BE again", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("x", { status: 503 }));
      vi.stubGlobal("fetch", fetchMock);
      const first = await fetchPublicJson("/bounties/replay-a", PUBLIC_DETAIL_FETCH).catch((caught: unknown) => caught);
      const second = await fetchPublicJson("/bounties/replay-a", PUBLIC_DETAIL_FETCH).catch((caught: unknown) => caught);
      expect(first).toMatchObject({ status: 503 });
      expect(second).toBe(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("replays a timeout too, so a hung BE costs one timeout per request, not two", async () => {
      const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
      const fetchMock = vi.fn().mockRejectedValue(timeout);
      vi.stubGlobal("fetch", fetchMock);
      await expect(fetchPublicJson("/notices/replay-t", PUBLIC_DETAIL_FETCH)).rejects.toBe(timeout);
      await expect(fetchPublicJson("/notices/replay-t", PUBLIC_DETAIL_FETCH)).rejects.toBe(timeout);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("asks the BE again once the window has passed", async () => {
      const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      const fetchMock = vi.fn().mockResolvedValueOnce(new Response("x", { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "b" })));
      vi.stubGlobal("fetch", fetchMock);
      await expect(fetchPublicJson("/bounties/replay-w", PUBLIC_DETAIL_FETCH)).rejects.toMatchObject({ status: 500 });
      now.mockReturnValue(1_000_000 + (PUBLIC_DETAIL_FETCH.replayFailureMs ?? 0));
      await expect(fetchPublicJson("/bounties/replay-w", PUBLIC_DETAIL_FETCH)).resolves.toEqual({ id: "b" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("never replays a 404, a success, or a call without the detail options", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => new Response("x", { status: 404 }));
      vi.stubGlobal("fetch", fetchMock);
      await expect(fetchPublicJson("/users/replay-404", PUBLIC_DETAIL_FETCH)).rejects.toMatchObject({ status: 404 });
      await expect(fetchPublicJson("/users/replay-404", PUBLIC_DETAIL_FETCH)).rejects.toMatchObject({ status: 404 });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      fetchMock.mockReset().mockImplementation(async () => new Response("x", { status: 500 }));
      await expect(fetchPublicJson("/bounties")).rejects.toMatchObject({ status: 500 });
      await expect(fetchPublicJson("/bounties")).rejects.toMatchObject({ status: 500 });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ ok: 1 })));
      await fetchPublicJson("/notices/replay-ok", PUBLIC_DETAIL_FETCH);
      await fetchPublicJson("/notices/replay-ok", PUBLIC_DETAIL_FETCH);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
