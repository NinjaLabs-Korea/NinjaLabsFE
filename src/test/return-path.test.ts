// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearReturnPath, isReturnPath, peekReturnPath, rememberReturnPath, takeReturnPath } from "@/lib/return-path";

afterEach(() => window.sessionStorage.clear());

describe("return path", () => {
  it("accepts same-site paths only", () => {
    for (const ok of ["/recruit", "/bounties/x?y=1", "/home"]) expect(isReturnPath(ok), ok).toBe(true);
    for (const bad of ["", "recruit", "//evil.test", "https://evil.test/recruit", "/\\evil", "/a b", "/bounties%0d%0a", "/x%0A", "/x%5Cevil", "/signup", "/signup/wallet", "/auth/callback", "/api/auth/refresh", `/${"x".repeat(250)}`, null, 5]) {
      expect(isReturnPath(bad), String(bad)).toBe(false);
    }
  });

  it("remembers a valid path for this tab, ignores an invalid one, and take() consumes it", () => {
    rememberReturnPath("//evil.test");
    expect(peekReturnPath()).toBeNull();
    rememberReturnPath("/recruit");
    expect(peekReturnPath()).toBe("/recruit");
    expect(takeReturnPath()).toBe("/recruit");
    expect(peekReturnPath()).toBeNull();
  });

  it("drops a leading locale segment so the locale-aware router does not prepend it twice", () => {
    for (const [given, stored] of [["/en/bounties", "/bounties"], ["/ko/bounties/x?y=1", "/bounties/x?y=1"], ["/zh", "/"], ["/en/signup", null], ["/entry", "/entry"]] as const) {
      clearReturnPath();
      rememberReturnPath(given);
      expect(peekReturnPath(), given).toBe(stored);
    }
  });

  it("never returns a planted storage value that is not a safe path", () => {
    window.sessionStorage.setItem("ninja.returnTo", "https://evil.test");
    expect(peekReturnPath()).toBeNull();
    rememberReturnPath("/recruit");
    clearReturnPath();
    expect(peekReturnPath()).toBeNull();
  });
});
