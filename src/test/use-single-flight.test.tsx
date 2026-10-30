// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyedSingleFlight, useSingleFlight } from "@/components/ui/useSingleFlight";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSingleFlight", () => {
  it("runs fn once for rapid calls and flips busy", async () => {
    const { result } = renderHook(() => useSingleFlight());
    const gate = deferred();
    const fn = vi.fn(() => gate.promise);
    let calls: Promise<unknown>[] = [];
    act(() => {
      calls = [result.current.run(fn), result.current.run(fn), result.current.run(fn)];
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => {
      gate.resolve();
      await Promise.all(calls);
    });
    expect(result.current.busy).toBe(false);
    await act(async () => {
      await result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases after a rejection", async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await expect(result.current.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    });
    expect(result.current.busy).toBe(false);
    const fn = vi.fn(async () => "ok");
    await act(async () => {
      await result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("useKeyedSingleFlight", () => {
  it("keeps a key busy until fn (including the reload) resolves, other keys run in parallel", async () => {
    const { result } = renderHook(() => useKeyedSingleFlight());
    const reload = deferred();
    const fnA = vi.fn(async () => {
      await reload.promise;
    });
    const fnB = vi.fn(async () => undefined);
    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.run("a", fnA);
      void result.current.run("a", fnA);
      void result.current.run("b", fnB);
    });
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isBusy("a")).toBe(true);
    expect(result.current.isBusy("b")).toBe(false);
    await act(async () => {
      void result.current.run("a", fnA);
    });
    expect(fnA).toHaveBeenCalledTimes(1);
    await act(async () => {
      reload.resolve();
      await first;
    });
    expect(result.current.isBusy("a")).toBe(false);
  });
});
