// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { resetSessionState } from "@/lib/api/http";

beforeEach(() => {
  sessionStorage.clear();
  resetSessionState();
});
afterEach(() => vi.unstubAllGlobals());

describe("explicit sign-out", () => {
  it("clears the remembered return path and the profile draft", async () => {
    sessionStorage.setItem("ninja.returnTo", "/recruit");
    sessionStorage.setItem("ninja.profileDraft", JSON.stringify({ userId: "a", nickname: "n", bio: "b", tags: [] }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const adapter = createApiAuthAdapter("http://api.test");
    const result = await adapter.signOut();
    expect(result.status).toBe("signed-out");
    expect(sessionStorage.getItem("ninja.returnTo")).toBeNull();
    expect(sessionStorage.getItem("ninja.profileDraft")).toBeNull();
  });

  it("keeps them when the BE did not confirm the revoke", async () => {
    sessionStorage.setItem("ninja.returnTo", "/recruit");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const adapter = createApiAuthAdapter("http://api.test");
    await adapter.signOut();
    expect(sessionStorage.getItem("ninja.returnTo")).toBe("/recruit");
  });
});
