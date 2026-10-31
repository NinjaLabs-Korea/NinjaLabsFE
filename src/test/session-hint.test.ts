// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSessionHint, getChipHint, getMemberHint, setChipHint, getSessionHint, setMemberHint, setSessionHint } from "@/lib/foundation/session-hint";

describe("session hint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("sets, reads and clears a boolean flag under one key", () => {
    expect(getSessionHint()).toBe(false);
    setSessionHint();
    expect(getSessionHint()).toBe(true);
    expect(window.sessionStorage.getItem("ninja.session.hint")).toBe("1");
    clearSessionHint();
    expect(getSessionHint()).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("reads false and never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getSessionHint()).toBe(false);
    expect(() => setSessionHint()).not.toThrow();
    expect(() => clearSessionHint()).not.toThrow();
  });

  it("renders false on the server so a hard load hydrates without a mismatch", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { useSessionHint } = await import("@/lib/foundation/session-hint");
    setSessionHint();
    const Probe = () => createElement("output", null, String(useSessionHint()));
    expect(renderToString(createElement(Probe))).toContain(">false<");
  });

  it("member hint: localStorage flag read only together with the refresh-cookie hint", () => {
    window.localStorage.clear();
    setMemberHint(true);
    expect(window.localStorage.getItem("ninja.session.member")).toBe("1");
    expect(getMemberHint()).toBe(false);
    window.localStorage.setItem("ninja.session", "1");
    expect(getMemberHint()).toBe(true);
    setMemberHint(false);
    expect(getMemberHint()).toBe(false);
    expect(window.localStorage.getItem("ninja.session.member")).toBeNull();
    window.localStorage.clear();
  });
});

describe("chip hint", () => {
  const KEY = "ninja.session.chip";
  afterEach(() => window.localStorage.clear());

  it("writes display data only, reads it with the refresh-cookie hint, and clears", () => {
    setChipHint({ initials: "PE", handle: "Pelican" });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null")).toEqual({ initials: "PE", handle: "Pelican" });
    expect(getChipHint()).toBeNull();
    window.localStorage.setItem("ninja.session", "1");
    expect(getChipHint()).toEqual({ initials: "PE", handle: "Pelican" });
    setChipHint(null);
    expect(getChipHint()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("returns a stable object for the same stored value (useSyncExternalStore safety)", () => {
    window.localStorage.setItem("ninja.session", "1");
    setChipHint({ initials: "PE", handle: "Pelican" });
    expect(getChipHint()).toBe(getChipHint());
  });

  it("ignores garbage and over-long values", () => {
    window.localStorage.setItem("ninja.session", "1");
    for (const raw of ["not json", "null", "[]", '{"initials":1,"handle":"x"}', '{"initials":"","handle":"x"}', JSON.stringify({ initials: "PE", handle: "x".repeat(101) }), JSON.stringify({ initials: "P".repeat(9), handle: "x" })]) {
      window.localStorage.setItem(KEY, raw);
      expect(getChipHint()).toBeNull();
    }
  });

  it("renders null on the server", async () => {
    const { createElement } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { useChipHint } = await import("@/lib/foundation/session-hint");
    window.localStorage.setItem("ninja.session", "1");
    setChipHint({ initials: "PE", handle: "Pelican" });
    const Probe = () => createElement("output", null, String(useChipHint()));
    expect(renderToString(createElement(Probe))).toContain(">null<");
  });
});
