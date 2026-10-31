// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSessionHint, getMemberHint, getSessionHint, setMemberHint, setSessionHint } from "@/lib/foundation/session-hint";

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
