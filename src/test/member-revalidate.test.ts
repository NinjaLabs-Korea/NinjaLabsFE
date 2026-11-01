import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "http://be.test" }) }));

import { refreshMemberLists } from "@/lib/member-revalidate";

const meResponse = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  updateTag.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("refreshMemberLists (after a profile photo change)", () => {
  it("expires public:members for an official member, checked against GET /auth/me", async () => {
    const fetchMock = vi.fn(() => meResponse({ isMember: true, isAdmin: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshMemberLists("tok")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://be.test/auth/me", expect.objectContaining({ headers: { Authorization: "Bearer tok" } }));
    expect(updateTag.mock.calls).toEqual([["public:members"]]);
  });

  it("does nothing for a non-member, without a token, on a rejected token or when the BE is down", async () => {
    vi.stubGlobal("fetch", vi.fn(() => meResponse({ isMember: false, isAdmin: true })));
    await expect(refreshMemberLists("tok")).resolves.toBe(false);
    await expect(refreshMemberLists(null)).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(() => meResponse({ message: "no" }, 401)));
    await expect(refreshMemberLists("bad")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    await expect(refreshMemberLists("tok")).resolves.toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
