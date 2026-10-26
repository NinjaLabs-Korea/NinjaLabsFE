import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ mode: "mock" as "mock" | "api", apiUrl: undefined as string | undefined }));
vi.mock("@/lib/runtime/config", () => ({
  loadRuntimeConfig: () => ({ runtimeMode: runtime.mode, apiUrl: runtime.apiUrl }),
}));

const { decodeDetailId, detailMayExist, isValidDetailId, resolveDetailRoute, validateDetailId } = await import("@/lib/detail-id");

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
    for (const garbage of ["\u0000", "", "a b", "a/b", "x".repeat(65), "<script>", "withdrawn_1a2b3c4d"]) {
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

describe("member ids are never dot segments", () => {
  // `/members/%2e%2e` decodes to ".." and `${api}/users/..` is the BE root: reject before any fetch, in the page and the proxy.
  it.each([".", "..", "...", ".ninja", "ninja.", "-ninja", "a/..", "%2e%2e"])("rejects %j in api mode", async (id) => {
    runtime.mode = "api";
    runtime.apiUrl = "https://api.ninjalabs.example";
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(isValidDetailId("members", id, "api")).toBe(false);
    await expect(validateDetailId("members", id)).resolves.toBe(false);
    await expect(detailMayExist("members", id)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes %2e%2e in the proxy route, then fails the shape check", async () => {
    expect(resolveDetailRoute("/en/members/%2e%2e")).toEqual({ locale: "en", kind: "members", id: ".." });
    runtime.mode = "api";
    await expect(detailMayExist("members", "..")).resolves.toBe(false);
  });

  it("still accepts dotted nicknames that start and end with a letter or digit", () => {
    for (const id of ["ninja.inj", "a.b.c", "x_y", "닌자.inj"]) expect(isValidDetailId("members", id, "api"), id).toBe(true);
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
    for (const pathname of ["/en/bounties", "/en/bounties/apply", "/en/bounties/", "/ko/members/", "/fr/bounties/x", "/en/nope/nope", "/en/bounties/x/y", "/bounties/x", "/en"]) {
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

  it("does not mistake Object.prototype members for fixture records in mock mode", async () => {
    // `profiles` is a plain record: `profiles["constructor"]` is a function, which would render a profile page that crashes instead of a 404.
    for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      await expect(detailMayExist("members", id), id).resolves.toBe(false);
    }
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

describe("decodeDetailId", () => {
  it("decodes the percent-encoded segment Next passes for non-ASCII nicknames so the shape check accepts it", () => {
    for (const nickname of ["김민수", "한글닉349", "éxy", "Ünal", "日本語名", "Привет", "𝐀𝐁"]) {
      const encoded = encodeURIComponent(nickname);
      expect(isValidDetailId("members", encoded, "api")).toBe(false);
      expect(isValidDetailId("members", decodeDetailId(encoded), "api")).toBe(true);
    }
  });
  it("NFC-normalises a decomposed nickname so it reaches the same page as the composed one", () => {
    const nfd = "Cafe\u0301";
    expect(isValidDetailId("members", nfd, "api")).toBe(false);
    expect(decodeDetailId(encodeURIComponent(nfd))).toBe("Caf\u00e9");
    expect(isValidDetailId("members", decodeDetailId(encodeURIComponent(nfd)), "api")).toBe(true);
    const jamo = "\u1112\u1161\u11ab"; // Hangul jamo for 한
    expect(decodeDetailId(encodeURIComponent(jamo + "x"))).toBe("\ud55cx");
    expect(resolveDetailRoute(`/en/members/${encodeURIComponent(nfd)}`)).toEqual({ locale: "en", kind: "members", id: "Caf\u00e9" });
  });
  it("leaves plain ids alone and turns an undecodable id into an empty (invalid) one", () => {
    expect(decodeDetailId("builderone")).toBe("builderone");
    expect(decodeDetailId("%E0%A4%A")).toBe("");
    expect(isValidDetailId("members", decodeDetailId("%2e%2e"), "api")).toBe(false);
  });
});
