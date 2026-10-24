import { describe, expect, it, vi } from "vitest";

// generateMetadata, layout and page each call the detail loader. The public fetch carries an abort signal, which
// opts it out of Next's fetch dedupe, so the loaders rely on React `cache()` for one BE call per request.
// Outside a React server render `cache` is a pass-through, so stand in a memoizing one and check every loader uses it.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache = <A extends unknown[], R>(fn: (...args: A) => R) => {
    const memo = new Map<string, R>();
    return (...args: A) => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as R;
    };
  };
  return { ...actual, cache };
});

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/public")>()),
  fetchPublicJson: (path: string) => fetchPublicJson(path),
  loadFromRuntime: (sources: { api: () => unknown }) => sources.api(),
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { getRuntimeBounty } = await import("@/lib/bounties");
const { getRuntimeNotice } = await import("@/lib/notices");
const { getRuntimeProfile } = await import("@/lib/members");

describe("detail loaders share one BE request per render", () => {
  it.each([
    ["bounty", () => getRuntimeBounty("b1", "en")],
    ["notice", () => getRuntimeNotice("n1")],
    ["profile", () => getRuntimeProfile("kim", "en")],
  ])("%s: metadata + layout + page → one fetch", async (_label, load) => {
    fetchPublicJson.mockReset();
    fetchPublicJson.mockRejectedValue(new Error("down"));
    const results = await Promise.allSettled([load(), load(), load()]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(fetchPublicJson).toHaveBeenCalledTimes(1);
  });
});
