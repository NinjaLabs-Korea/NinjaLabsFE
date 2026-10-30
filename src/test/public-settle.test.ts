import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api", apiUrl: "https://be.example/" }) }));

const { settle } = await import("@/lib/api/public");

describe("settle", () => {
  it("passes a resolved value through", async () => {
    await expect(settle(Promise.resolve([1, 2]), [])).resolves.toEqual({ value: [1, 2], unavailable: false });
  });

  it("turns a rejected promise into the fallback and flags it unavailable", async () => {
    const fallback: number[] = [];
    const result = await settle(Promise.reject(new Error("down")), fallback);
    expect(result).toEqual({ value: fallback, unavailable: true });
    expect(result.value).toBe(fallback);
  });

  it("loads several sources in parallel without one failure taking the others down", async () => {
    const [a, b] = await Promise.all([settle(Promise.resolve("ok"), ""), settle(Promise.reject(new Error("x")), "")]);
    expect([a, b]).toEqual([{ value: "ok", unavailable: false }, { value: "", unavailable: true }]);
  });
});
