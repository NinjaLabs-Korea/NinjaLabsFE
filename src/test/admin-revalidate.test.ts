import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "http://be.test" }) }));

import { refreshPublicLists } from "@/lib/admin-revalidate";
import { publicListTagForPath } from "@/lib/api/public";

const meResponse = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  updateTag.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("refreshPublicLists", () => {
  it("expires the requested tags for an admin and checks the token against GET /auth/me", async () => {
    const fetchMock = vi.fn(() => meResponse({ isAdmin: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshPublicLists(["notices", "bounties"], "tok")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://be.test/auth/me", expect.objectContaining({ headers: { Authorization: "Bearer tok" } }));
    expect(updateTag.mock.calls).toEqual([["public:notices"], ["public:bounties"]]);
  });

  it("does nothing for a non-admin", async () => {
    vi.stubGlobal("fetch", vi.fn(() => meResponse({ isAdmin: false })));
    await expect(refreshPublicLists(["notices"], "tok")).resolves.toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("does nothing without a token, on a rejected token, or when the BE is down", async () => {
    const fetchMock = vi.fn(() => meResponse({ message: "no" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshPublicLists(["notices"], null)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(refreshPublicLists(["notices"], "bad")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(refreshPublicLists(["notices"], "tok")).resolves.toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("ignores resources that are not cached public lists", async () => {
    vi.stubGlobal("fetch", vi.fn(() => meResponse({ isAdmin: true })));
    await refreshPublicLists(["notices", "../x" as never, "users" as never], "tok");
    expect(updateTag.mock.calls).toEqual([["public:notices"]]);
  });
});

describe("publicListTagForPath", () => {
  it("tags cached list paths by resource", () => {
    expect(publicListTagForPath("/notices?sort=eventDate")).toEqual(["public:notices"]);
    expect(publicListTagForPath("/bounties")).toEqual(["public:bounties"]);
    expect(publicListTagForPath("/members")).toEqual([]);
  });
});
