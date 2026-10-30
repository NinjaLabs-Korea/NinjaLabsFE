import { describe, expect, it } from "vitest";
import { isHttpUrl, isHttpUrlOrMediaPath, isHttpUrlOrSitePath, isMediaPath, isPublicHttpUrl, isPublicHttpUrlOrMediaPath, isPublicHttpUrlOrSitePath, isSitePath, urlErrorKind } from "@/lib/url-rules";

// Same probe cases as NinjaLabsBE `src/common/validation/url.spec.ts` - keep the two files in step.
describe("URL field validators (mirror of BE url.ts)", () => {
  const mediaPath = "/media/11111111-1111-4111-8111-111111111111";

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

  it("isHttpUrl rejects whitespace inside the URL like validator.js isURL", () => {
    expect(isHttpUrl("https://ninjalabs.xyz/a b")).toBe(false);
    expect(isHttpUrl("https://ninjalabs.xyz/<x>")).toBe(false);
  });

  // validator.js isFQDN/isIP host rules, checked on the raw string (`new URL` would normalize some of these into valid hosts).
  it.each([
    ["trailing-dot host", "https://ninjalabs.xyz./x"],
    ["underscore label", "https://my_host.ninjalabs.xyz"],
    ["leading hyphen label", "https://-ninjalabs.xyz"],
    ["trailing hyphen label", "https://ninjalabs-.xyz"],
    ["port 0", "https://ninjalabs.xyz:0/"],
    ["IPv4 shorthand", "http://1.2.3/"],
    ["hex IPv4 shorthand", "http://0x7f.1/"],
    ["two-part IPv4 shorthand", "http://127.1/"],
    ["numeric last label", "http://ninjalabs.123/"],
    ["full-width letters", "https://ｎinjalabs.xyz"],
    ["label longer than 63", `https://${"a".repeat(64)}.xyz`],
    ["backslash in host", "http://exa\\mple.com/"],
    ["backslash after host", "https://ninjalabs.xyz\\evil.com/x"],
    ["empty label", "https://ninjalabs..xyz"],
    ["percent-encoded host", "https://ninja%41labs.xyz"],
  ])("isHttpUrl rejects %s like validator.js: %p", (_label, value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it.each([
    "http://localhost",
    "http://[::1]:3000/",
    "https://xn--80ak6aa92e.com/",
    "https://例え.jp/",
    "https://sub.ninjalabs.xyz:65535/",
    `https://${"a".repeat(63)}.xyz`,
    "http://10.0.0.1/",
  ])("isHttpUrl still accepts %p", (value) => {
    expect(isHttpUrl(value)).toBe(true);
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

  it("composes the DTO-level rules the admin forms use", () => {
    expect(isHttpUrlOrMediaPath(mediaPath)).toBe(true);
    expect(isHttpUrlOrMediaPath("/bounties/x")).toBe(false);
    expect(isHttpUrlOrSitePath("/bounties/x")).toBe(true);
    expect(isHttpUrlOrSitePath("//evil.com")).toBe(false);
    expect(isHttpUrlOrSitePath("https://ninjalabs.xyz")).toBe(true);
  });
});

// Same probe cases as NinjaLabsBE `url.spec.ts` isPublicHttpUrl: links the public pages open must not point at private hosts.
describe("isPublicHttpUrl (mirror of BE isPublicHttpUrl)", () => {
  it.each(["https://ninjalabs.xyz/x", "http://8.8.8.8/", "https://[2606:4700::1111]/", "https://sub.example.co.kr:8443/a?b=c"])("accepts %p", (value) => {
    expect(isPublicHttpUrl(value)).toBe(true);
  });

  it.each([
    "http://10.0.0.1/x", "http://127.0.0.1:8080/", "https://localhost/", "http://192.168.1.5/", "http://172.16.0.1/", "http://169.254.169.254/",
    "http://0.0.0.0/", "http://100.64.0.1/", "http://2130706433/", "https://foo.localhost/", "https://printer.local/", "https://intranet/",
    "https://[::1]/", "https://[fe80::1]/", "https://[fd00::1]/", "ftp://example.com", "javascript:alert(1)", `https://x.example/${"a".repeat(2048)}`, "", 5,
  ])("rejects %p", (value) => {
    expect(isPublicHttpUrl(value)).toBe(false);
  });

  it("image and highlight-link rules use the public host rule too", () => {
    const media = "/media/11111111-1111-4111-8111-111111111111";
    expect(isPublicHttpUrlOrMediaPath("http://localhost:3000/x.png")).toBe(false);
    expect(isPublicHttpUrlOrMediaPath(media)).toBe(true);
    expect(isPublicHttpUrlOrSitePath("http://10.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrlOrSitePath("/bounties/x")).toBe(true);
  });

  it("urlErrorKind separates a malformed URL from a well-formed private one", () => {
    expect(urlErrorKind("http://10.0.0.1/x")).toBe("publicUrl");
    expect(urlErrorKind("javascript:alert(1)")).toBe("urlInvalid");
  });
});
