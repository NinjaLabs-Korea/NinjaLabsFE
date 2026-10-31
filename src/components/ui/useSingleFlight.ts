"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Submit guard: `run(fn)` ignores a call while a previous one is still in flight and returns `undefined` without calling `fn`.
 * The guard is a ref (two clicks in the same tick both see the old `busy` state); `busy` mirrors it for rendering.
 * The flight lasts until the promise `fn` returns settles, so put follow-up work that must not be re-triggered (a reload) inside `fn`.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}

/** Same guard per key: different keys run in parallel, a key stays busy until its `fn` settles. */
export function useKeyedSingleFlight() {
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const run = useCallback(async <T>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));
    try {
      return await fn();
    } finally {
      inFlight.current.delete(key);
      setBusy(new Set(inFlight.current));
    }
  }, []);

  const isBusy = useCallback((key: string) => busy.has(key), [busy]);

  return { busy, isBusy, run };
}
