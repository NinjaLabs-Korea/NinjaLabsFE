import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "@/lib/api/codecs";
import { isReservedNickname, isValidNickname, NICKNAME, validateNickname } from "@/lib/nickname";
import { BE_NICKNAME_ACCEPTED, BE_NICKNAME_REJECTED } from "./be-validator-fixtures";
import { isHttpUrl, isMediaPath, isSitePath } from "@/lib/url-rules";

/**
 * FE ↔ BE validator parity. The case tables below are copied VERBATIM from NinjaLabsBE (branch fix/wiki-audit-findings):
 *   - `src/common/validation/url.spec.ts`  (isHttpUrl / isMediaPath / isSitePath / isSafeUrl)
 *   - `src/users/users.dto.spec.ts`        (CompleteProfileDto nickname / isSavableNickname)
 * Each table keeps the BE expectation, so a drift in either repo shows up as a failing row here. When a BE table
 * changes, paste the new rows here unchanged; do not "fix" an expectation to make the FE pass.
 */

const mediaPath = "/media/11111111-1111-4111-8111-111111111111";

describe("BE url.spec.ts tables against FE url-rules", () => {
  it("isHttpUrl accepts http(s) URLs with a protocol, including localhost previews", () => {
    expect(isHttpUrl("https://ninjalabs.xyz/bounties/1")).toBe(true);
    expect(isHttpUrl("http://localhost:3000/media/x")).toBe(true);
    expect(isHttpUrl("https://github.com/org/repo?tab=readme#top")).toBe(true);
  });

  it.each([
    "ninjalabs.xyz", "ftp://ninjalabs.xyz", "javascript:alert(1)", "data:text/html,hi", "//ninjalabs.xyz",
    mediaPath, "", "   ", "https://", `https://x.y/${"a".repeat(2048)}`, 42, null, undefined,
  ])("isHttpUrl rejects %p", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it.each([
    "https:ninjalabs.xyz", "https:/ninjalabs.xyz", "https:///ninjalabs.xyz", "HTTPS:\\\\ninjalabs.xyz", "http:ninjalabs.xyz/x",
  ])("isHttpUrl requires // after the scheme: %p", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it.each([
    "https://user:pw@ninjalabs.xyz", "https://user@ninjalabs.xyz", "https://:pw@ninjalabs.xyz", "https://ninjalabs.xyz@evil.com/x",
    "https://@ninjalabs.xyz", "https://ninjalabs.xyz%40evil.com@evil.com",
  ])("isHttpUrl rejects userinfo: %p", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it("isHttpUrl still accepts hosts with ports, paths, queries and fragments", () => {
    expect(isHttpUrl("HTTPS://NinjaLabs.xyz:8443/a/b?c=d#e")).toBe(true);
    expect(isHttpUrl("http://127.0.0.1:3000/")).toBe(true);
  });

  it("isMediaPath accepts exactly the relative path POST /admin/media returns", () => {
    expect(isMediaPath(mediaPath)).toBe(true);
    expect(isMediaPath(mediaPath.toUpperCase())).toBe(true);
    expect(isMediaPath("/media/not-a-uuid")).toBe(false);
    expect(isMediaPath(`${mediaPath}/../x`)).toBe(false);
    expect(isMediaPath(`https://api.ninjalabs.xyz${mediaPath}`)).toBe(false);
    expect(isMediaPath("/other/11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("isSitePath accepts absolute site routes but not protocol-relative or whitespace paths", () => {
    expect(isSitePath("/bounties/helix-volume-analytics")).toBe(true);
    expect(isSitePath("/")).toBe(true);
    expect(isSitePath("/bounties/")).toBe(true);
    expect(isSitePath("/bounties?page=2&q=a%20b#top")).toBe(true);
    expect(isSitePath("/users/%EB%8B%8C%EC%9E%90")).toBe(true);
    expect(isSitePath("/a/.hidden/b.c/..d/e..")).toBe(true);
    expect(isSitePath(mediaPath)).toBe(true);
    expect(isSitePath("//evil.com/x")).toBe(false);
    expect(isSitePath("bounties/x")).toBe(false);
    expect(isSitePath("/bounties/x y")).toBe(false);
    expect(isSitePath("/x\\y")).toBe(false);
    expect(isSitePath("")).toBe(false);
  });

  it.each([
    ["percent-encoded slash", "/bounties%2f..%2fadmin"],
    ["percent-encoded slash (upper)", "/bounties%2F..%2Fadmin"],
    ["percent-encoded backslash", "/x%5cy"],
    ["percent-encoded backslash (upper)", "/x%5Cy"],
    ["encoded slash in the query", "/x?next=%2f%2fevil.com"],
    ["NUL", "/x\u0000y"],
    ["encoded NUL", "/x%00y"],
    ["other control char", "/x\u001fy"],
    ["DEL", "/x\u007fy"],
    ["encoded CR LF", "/x%0d%0aSet-Cookie:a=b"],
    ["dot-dot segment", "/bounties/../admin"],
    ["trailing dot-dot", "/bounties/.."],
    ["single-dot segment", "/./admin"],
    ["encoded dot-dot", "/bounties/%2e%2e/admin"],
    ["half-encoded dot-dot", "/bounties/.%2E/admin"],
    ["path-parameter dot-dot", "/bounties/..;/admin"],
    ["path-parameter dot-dot with value", "/bounties/..;jsessionid=1/admin"],
    ["encoded path-parameter dot-dot", "/bounties/%2e%2e%3b/admin"],
    ["malformed percent encoding", "/bounties/%zz"],
    ["truncated percent encoding", "/bounties/%2"],
    ["too long", `/${"a".repeat(2048)}`],
  ])("isSitePath rejects %s: %p", (_label, value) => {
    expect(isSitePath(value)).toBe(false);
  });
});

/**
 * BE `isSafeUrl` (the lenient PATCH rule) has no FE validator: the FE never writes with it. What it guards on the FE side
 * is rendering - `safeHttpUrl` decides whether an admin-entered value becomes an href/src. The invariant: anything the BE
 * refuses to store even under its most lenient rule is never rendered by the FE either. (The FE is deliberately
 * stricter on the accept side: legacy bare hosts and dot segments are stored but not rendered.) "too long" and the
 * non-string rows are left out: rendering a long same-origin path is harmless and `safeHttpUrl` is typed for strings.
 */
describe("BE isSafeUrl reject table against FE safeHttpUrl (render side at least as strict)", () => {
  it.each([
    ["javascript scheme", "javascript:alert(1)"],
    ["javascript scheme, mixed case", "JavaScript:alert(1)"],
    ["data scheme", "data:text/html,hi"],
    ["vbscript scheme", "vbscript:msgbox(1)"],
    ["other scheme", "ftp://ninjalabs.xyz/x"],
    ["protocol-relative", "//evil.com/x"],
    ["protocol-relative via backslash", "/\\evil.com/x"],
    ["host without a dot (reads as a scheme)", "localhost:3000/x"],
    ["bare host with whitespace", "cdn.example/a b.png"],
    ["bare host with a backslash", "cdn.example\\evil"],
    ["bare host with userinfo", "user@cdn.example/x"],
    ["numeric last label", "127.0.0.1/x"],
    ["userinfo", "https://ninjalabs.xyz@evil.com/x"],
    ["no host", "https://"],
    ["NUL", "/x\u0000y"],
    ["newline", "https://ninjalabs.xyz/\nx"],
    ["tab before scheme", "\tjavascript:alert(1)"],
    ["leading space", " /uploads/x.png"],
    ["empty", ""],
  ])("does not render %s: %p", (_label, value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });

  it.each(["https://user:pw@ninjalabs.xyz/x", "https://:pw@ninjalabs.xyz", "http://user@ninjalabs.xyz"])(
    "does not render any userinfo form either: %p",
    (value) => {
      expect(safeHttpUrl(value)).toBeNull();
    },
  );

  it.each(["https://ninjalabs.xyz/bounties/1", "http://localhost:3000/x", "HTTPS://cdn.example/a.png?x=1#y", mediaPath, "/uploads/legacy-cover.png", "/", "/bounties?page=2"])(
    "still renders the BE-accepted value %p unchanged",
    (value) => {
      expect(safeHttpUrl(value)).toBe(value);
    },
  );
});

describe("BE users.dto.spec.ts tables against FE nickname rule", () => {
  it("accepts unicode letters/digits with _ . - and trims surrounding whitespace", () => {
    expect(isValidNickname("ninja_dev")).toBe(true);
    expect(isValidNickname("닌자.개발자-01")).toBe(true);
    expect(isValidNickname("  ninja  ")).toBe(true);
  });

  it.each(["a", "n".repeat(51), "ninja dev", "ninja@dev", "ninja/dev", "ninja<b>", "   ", "​​"])(
    "rejects nickname %p (length 2..50, no whitespace or symbols beyond _ . -)",
    (nickname) => {
      expect(validateNickname(nickname)).not.toBeNull();
    },
  );

  it.each([".ninja", "ninja.", "-ninja", "ninja-", "_ninja", "ninja_", "..", "...", "--", "-.", ".-", "_-_", ".a", "a."])(
    "rejects nickname %p (must start and end with a letter or digit; no dot/dash-only values)",
    (nickname) => {
      expect(validateNickname(nickname)).not.toBeNull();
    },
  );

  it.each(["a.b", "a-b", "a_b", "ninja-dev", "n.i.n.j.a", "닌자.개발자", "01", "me2", "admin1", "newbie", "edits"])(
    "accepts nickname %p (letters/digits at both ends)",
    (nickname) => {
      expect(validateNickname(nickname)).toBeNull();
      expect(NICKNAME.test(nickname)).toBe(true);
    },
  );

  it.each(["me", "ME", "Me", "check-nickname", "Check-Nickname", "admin", "ADMIN", "new", "New", "edit", "EDIT", "  me  "])(
    "rejects the reserved route word %p (case-insensitive)",
    (nickname) => {
      expect(isReservedNickname(nickname)).toBe(true);
      expect(validateNickname(nickname)).toBe("reserved");
    },
  );

  // BE `isSavableNickname` = exactly what CompleteProfileDto accepts; the FE validator must agree on every row.
  it.each(["ninja", " ninja ", "ab", "n".repeat(50), "닌자_빌더", "a.b-c_d"])("isSavableNickname accepts %p, so does the FE", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });

  it.each(["", " ", "a", "n".repeat(51), ".ninja", "ninja-", "has space", "Admin", " me "])("isSavableNickname rejects %p, so does the FE", (nickname) => {
    expect(isValidNickname(nickname)).toBe(false);
  });

  // BE nickname rule: a nickname ending in a static-file extension (the proxy matcher's group, `/\.(…)$/i`) is rejected.
  it.each(["ninja.js", "ninja.JSON", "ninja.css", "ninja.Woff2"])("rejects nickname %p (ends in a static-file extension)", (nickname) => {
    expect(validateNickname(nickname)).toBe("staticExtension");
  });

  it.each(["ninja.inj", "ninja.jsx", "ninjajs"])("accepts nickname %p (not a static-file extension)", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });
});

describe("BE nickname fixtures (shared table) against NICKNAME and validateNickname", () => {
  it.each(BE_NICKNAME_REJECTED)("validateNickname rejects %j", (nickname) => {
    expect(validateNickname(nickname)).not.toBeNull();
  });
  it.each(BE_NICKNAME_ACCEPTED)("validateNickname accepts %j", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });
});
