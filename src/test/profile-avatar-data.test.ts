// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public")>()),
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { AVATAR_MAX_BYTES, avatarFileProblem, toAvatarUrl } = await import("@/lib/avatar");
const { parseMeResponse, toClientUser } = await import("@/lib/api/me");
const { getChipHint, setChipHint } = await import("@/lib/foundation/session-hint");
const { getRuntimeMembers, getRuntimeProfile } = await import("@/lib/members");

const photo = "/media/0b6f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b";

describe("toAvatarUrl (lib/avatar.ts)", () => {
  it("admits only the BE `/media/<uuid>` path; anything else is no photo", () => {
    expect(toAvatarUrl(photo)).toBe(photo);
    for (const value of [undefined, null, "", 7, "/media/not-a-uuid", "https://evil.example/x.png", `${photo}?x=1`, "javascript:alert(1)", `//evil.example${photo}`]) {
      expect(toAvatarUrl(value), String(value)).toBeUndefined();
    }
  });

  it("avatarFileProblem mirrors the BE checks (type, 2 MiB, empty)", () => {
    expect(avatarFileProblem({ size: 10, type: "image/png" })).toBeNull();
    expect(avatarFileProblem({ size: AVATAR_MAX_BYTES, type: "image/webp" })).toBeNull();
    expect(avatarFileProblem({ size: AVATAR_MAX_BYTES + 1, type: "image/jpeg" })).toBe("MEDIA_FILE_TOO_LARGE");
    expect(avatarFileProblem({ size: 10, type: "image/gif" })).toBe("MEDIA_FILE_TYPE_UNSUPPORTED");
    expect(avatarFileProblem({ size: 10, type: "image/svg+xml" })).toBe("MEDIA_FILE_TYPE_UNSUPPORTED");
    expect(avatarFileProblem({ size: 0, type: "image/png" })).toBe("MEDIA_FILE_REQUIRED");
  });
});

describe("/auth/me avatarUrl (both deploy orders)", () => {
  const me = { id: "u1", nickname: "pelican", email: "p@x.y", bio: "", tags: [], onboardingStep: 4, onboardingCompleted: true, isAdmin: false, isMember: false, wallet: null, nft: null };

  it("an older BE without the field still passes the carried-user codec and maps to no photo", () => {
    expect(parseMeResponse(me)).not.toBeNull();
    expect(toClientUser(parseMeResponse(me)!)).not.toHaveProperty("avatarUrl");
  });

  it("null and a media path pass; a wrong type falls back to GET /auth/me", () => {
    expect(toClientUser(parseMeResponse({ ...me, avatarUrl: null })!)).not.toHaveProperty("avatarUrl");
    expect(toClientUser(parseMeResponse({ ...me, avatarUrl: photo })!).avatarUrl).toBe(photo);
    expect(parseMeResponse({ ...me, avatarUrl: 42 })).toBeNull();
  });

  it("an unexpected string is not trusted as an image URL", () => {
    expect(toClientUser({ ...me, avatarUrl: "https://elsewhere.example/a.png" })).not.toHaveProperty("avatarUrl");
  });
});

describe("chip hint keeps the photo path (hydration-time header photo)", () => {
  afterEach(() => window.localStorage.clear());

  it("stores and reads avatarUrl only in the /media shape, dropping anything else but keeping the chip", () => {
    window.localStorage.setItem("ninja.session", "1");
    setChipHint({ initials: "PE", handle: "Pelican", avatarUrl: photo });
    expect(JSON.parse(window.localStorage.getItem("ninja.session.chip")!)).toEqual({ initials: "PE", handle: "Pelican", avatarUrl: photo });
    expect(getChipHint()).toEqual({ initials: "PE", handle: "Pelican", avatarUrl: photo });

    setChipHint({ initials: "PE", handle: "Pelican", avatarUrl: "blob:http://x/1" });
    expect(JSON.parse(window.localStorage.getItem("ninja.session.chip")!)).toEqual({ initials: "PE", handle: "Pelican" });

    window.localStorage.setItem("ninja.session.chip", JSON.stringify({ initials: "PE", handle: "Pelican", avatarUrl: "https://evil.example/x" }));
    expect(getChipHint()).toEqual({ initials: "PE", handle: "Pelican" });
  });
});

describe("public member data carries the photo", () => {
  it("GET /members avatar_url -> Member.avatarUrl (null/absent -> none)", async () => {
    fetchPublicJson.mockResolvedValueOnce([
      { id: "1", nickname: "alpha", bio: "", member_role: "DEV", links: [], avatar_url: photo },
      { id: "2", nickname: "beta", bio: "", member_role: "OPS", links: [], avatar_url: null },
      { id: "3", nickname: "gamma", bio: "", member_role: "CORE", links: [] },
    ]);
    const members = await getRuntimeMembers();
    expect(members.map((member) => member.avatarUrl)).toEqual([photo, undefined, undefined]);
  });

  it("GET /users/:nickname avatar_url -> Profile.avatarUrl", async () => {
    fetchPublicJson.mockResolvedValueOnce({ nickname: "alpha", bio: "b", created_at: "2026-05-01T00:00:00Z", tags: [], completedBounties: [], agents: [], nfts: [], avatar_url: photo });
    expect((await getRuntimeProfile("alpha", "en"))?.avatarUrl).toBe(photo);
    fetchPublicJson.mockResolvedValueOnce({ nickname: "beta", bio: "b", created_at: "2026-05-01T00:00:00Z", tags: [], completedBounties: [], agents: [], nfts: [] });
    expect((await getRuntimeProfile("beta", "en"))?.avatarUrl).toBeUndefined();
  });
});
