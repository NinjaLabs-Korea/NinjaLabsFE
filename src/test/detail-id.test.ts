import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ mode: "mock" as "mock" | "api", apiUrl: undefined as string | undefined }));
vi.mock("@/lib/runtime/config", () => ({
  loadRuntimeConfig: () => ({ runtimeMode: runtime.mode, apiUrl: runtime.apiUrl }),
}));

const { detailMayExist, isValidDetailId, resolveDetailRoute, validateDetailId } = await import("@/lib/detail-id");

const uuid = "4f2c3f0e-9d2a-4a5b-8c6d-1e2f3a4b5c6d";

afterEach(() => {
  runtime.mode = "mock";
  runtime.apiUrl = undefined;
  vi.unstubAllGlobals();
});

describe("detail id shape", () => {
  it("accepts fixture slugs in mock mode and rejects garbage before any lookup", () => {
    expect(isValidDetailId("bounties", "iasset-price-widget", "mock")).toBe(true);
    expect(isValidDetailId("members", "jaemin", "mock")).toBe(true);
    for (const garbage of ["\u0000", "", "Does-Not-Exist", "ninja.inj", "a b", "../x", "x".repeat(65), uuid.toUpperCase()]) {
      expect(isValidDetailId("bounties", garbage, "mock"), JSON.stringify(garbage)).toBe(false);
    }
  });

  it("requires a UUID for bounties and notices and a nickname for members in api mode", () => {
    expect(isValidDetailId("bounties", uuid, "api")).toBe(true);
    expect(isValidDetailId("notices", uuid.toUpperCase(), "api")).toBe(true);
    expect(isValidDetailId("bounties", "does-not-exist", "api")).toBe(false);
    expect(isValidDetailId("notices", "\u0000", "api")).toBe(false);
    for (const nickname of ["ninja.inj", "first.last", "jaemin", "닌자", "a_b-c"]) {
      expect(isValidDetailId("members", nickname, "api"), nickname).toBe(true);
    }
    for (const garbage of ["\u0000", "", "a b", "a/b", "x".repeat(65), "<script>"]) {
      expect(isValidDetailId("members", garbage, "api"), JSON.stringify(garbage)).toBe(false);
    }
  });

  it("follows the runtime mode", async () => {
    runtime.mode = "mock";
    await expect(validateDetailId("bounties", "iasset-price-widget")).resolves.toBe(true);
    await expect(validateDetailId("bounties", "Does-Not-Exist")).resolves.toBe(false);
    runtime.mode = "api";
    await expect(validateDetailId("bounties", uuid)).resolves.toBe(true);
    await expect(validateDetailId("bounties", "iasset-price-widget")).resolves.toBe(false);
  });
});

describe("resolveDetailRoute (proxy)", () => {
  it("parses only /[locale]/<kind>/[id] and decodes the id", () => {
    expect(resolveDetailRoute("/en/bounties/does-not-exist")).toEqual({ locale: "en", kind: "bounties", id: "does-not-exist" });
    expect(resolveDetailRoute("/ko/members/ninja.inj")).toEqual({ locale: "ko", kind: "members", id: "ninja.inj" });
    expect(resolveDetailRoute("/en/bounties/%00")).toEqual({ locale: "en", kind: "bounties", id: "\u0000" });
    expect(resolveDetailRoute("/en/bounties/%E0%A4%A")).toEqual({ locale: "en", kind: "bounties", id: "" });
  });

  it("ignores lists, static siblings, unknown locales and deeper paths", () => {
    for (const pathname of ["/en/bounties", "/en/bounties/apply", "/fr/bounties/x", "/en/nope/nope", "/en/bounties/x/y", "/bounties/x", "/en"]) {
      expect(resolveDetailRoute(pathname), pathname).toBeNull();
    }
  });
});

describe("detailMayExist (proxy)", () => {
  it("answers from the fixture registries in mock mode", async () => {
    await expect(detailMayExist("bounties", "iasset-price-widget")).resolves.toBe(true);
    await expect(detailMayExist("bounties", "does-not-exist")).resolves.toBe(false);
    await expect(detailMayExist("members", "jaemin")).resolves.toBe(true);
    await expect(detailMayExist("members", "does-not-exist")).resolves.toBe(false);
    await expect(detailMayExist("notices", "july-bounty-sponsor-review-call")).resolves.toBe(true);
    await expect(detailMayExist("notices", "\u0000")).resolves.toBe(false);
  });

  it("in api mode checks the shape only and never calls the BE from the proxy", async () => {
    runtime.mode = "api";
    runtime.apiUrl = "https://api.ninjalabs.example";
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(detailMayExist("bounties", uuid)).resolves.toBe(true);
    await expect(detailMayExist("bounties", "does-not-exist")).resolves.toBe(false);
    // A well-formed nickname may or may not exist: the page's notFound() decides, not a per-request HEAD probe.
    await expect(detailMayExist("members", "ghost")).resolves.toBe(true);
    await expect(detailMayExist("members", "ninja.inj")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rewrites reserved route words under /members to the not-found path in api mode", async () => {
    runtime.mode = "api";
    for (const reserved of ["me", "ME", "check-nickname", "admin", "new", "edit"]) {
      expect(isValidDetailId("members", reserved, "api"), reserved).toBe(false);
      await expect(detailMayExist("members", reserved), reserved).resolves.toBe(false);
    }
    expect(isValidDetailId("members", "me2", "api")).toBe(true);
  });
});
