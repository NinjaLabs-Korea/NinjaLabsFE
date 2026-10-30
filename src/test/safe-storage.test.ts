// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStorage, removeStorage, writeStorage } from "@/lib/safe-storage";

afterEach(() => vi.unstubAllGlobals());

describe("safe-storage without a window (server render)", () => {
  it("reads null and reports failed writes without throwing", () => {
    expect(readStorage("local", "k")).toBeNull();
    expect(writeStorage("session", "k", "v")).toBe(false);
    expect(removeStorage("session", "k")).toBe(false);
  });
});

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage;
}

describe("safe-storage round trip", () => {
  it("keeps local and session apart", () => {
    vi.stubGlobal("window", { localStorage: memory(), sessionStorage: memory() });
    expect(writeStorage("local", "k", "a")).toBe(true);
    expect(writeStorage("session", "k", "b")).toBe(true);
    expect(readStorage("local", "k")).toBe("a");
    expect(readStorage("session", "k")).toBe("b");
    expect(removeStorage("local", "k")).toBe(true);
    expect(readStorage("local", "k")).toBeNull();
    expect(readStorage("session", "k")).toBe("b");
  });
});

describe("safe-storage with throwing storage", () => {
  it("swallows errors from the methods", () => {
    const boom = () => {
      throw new Error("blocked");
    };
    const broken = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
    vi.stubGlobal("window", { localStorage: broken, sessionStorage: broken });
    expect(readStorage("local", "k")).toBeNull();
    expect(writeStorage("local", "k", "v")).toBe(false);
    expect(removeStorage("session", "k")).toBe(false);
  });

  it("swallows errors from the accessor itself", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(readStorage("local", "k")).toBeNull();
    expect(writeStorage("local", "k", "v")).toBe(false);
  });
});
