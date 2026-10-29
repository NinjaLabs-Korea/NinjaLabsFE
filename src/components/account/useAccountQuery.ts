"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import type { ApiResult, ApiUnavailable } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";

type AccountQueryState<T> = {
  loading: boolean;
  unavailable: boolean;
  /** Set with `unavailable`: `unauthorized` (session gone → sign-in prompt), `server-error`, `network-error`. */
  reason: ApiUnavailable["reason"] | null;
  data: T | null;
};

type AccountQueryResult<T> = AccountQueryState<T> & {
  /** True while a fresh read runs behind an answer remembered from an earlier mount (views may disable actions meanwhile). */
  revalidating: boolean;
  /** Re-reads from the API (after a mutation) without touching the auth snapshot; keeps the current data while loading or when the re-read fails (unless the session is gone). */
  refresh: () => void;
};

type AccountQueryRead<T> = (auth: AuthSnapshot) => Promise<ApiResult<T>>;

const loadingState = {
  loading: true,
  unavailable: false,
  reason: null,
  data: null,
} as const;

/** How long a remembered answer may seed a new mount when the caller did not pass `reuseLast`. */
const FRESH_MS = 60_000;

type Row = { data: unknown; at: number };

/**
 * Last successful answer per (read function, signed-in user key) with its timestamp. A locale switch or a page hop remounts
 * the readers; starting from the last answer keeps them from flashing a placeholder while the fresh read (which always runs
 * and replaces it) is in flight. `reuseLast: true` reuses it at any age (display-only reads); every other read reuses it only
 * when it is younger than 60 s. The key starts with `signed-in:<id>`, so another account never sees these rows, and a row set
 * is dropped when the snapshot is signed-out or another user.
 */
const lastGood = new WeakMap<object, Map<string, Row>>();
/** Every read function that has rows, so a sign-out or user switch can clear them (WeakMap cannot be iterated). */
const knownReads = new Set<WeakRef<object>>();

function remember(read: object, queryKey: string, data: unknown): void {
  let rows = lastGood.get(read);
  if (!rows) {
    rows = new Map();
    lastGood.set(read, rows);
    knownReads.add(new WeakRef(read));
  }
  rows.set(queryKey, { data, at: Date.now() });
}

/** Drops the rows of every user key except `keep` (null: all of them). */
function forgetOthers(keep: string | null): void {
  for (const ref of knownReads) {
    const read = ref.deref();
    if (!read) {
      knownReads.delete(ref);
      continue;
    }
    const rows = lastGood.get(read);
    if (!rows) continue;
    for (const key of [...rows.keys()]) if (key !== keep) rows.delete(key);
  }
}

/**
 * Concurrent readers of the same (read, user key) share one request (the hub mounts two cohort readers). Only concurrent
 * callers share: the entry is dropped as soon as the read settles, so `refresh()` always hits the network.
 */
const inFlight = new WeakMap<object, Map<string, Promise<ApiResult<unknown>>>>();

function sharedRead<T>(read: AccountQueryRead<T>, queryKey: string, auth: AuthSnapshot): Promise<ApiResult<T>> {
  let running = inFlight.get(read);
  if (!running) {
    running = new Map();
    inFlight.set(read, running);
  }
  const existing = running.get(queryKey);
  if (existing) return existing as Promise<ApiResult<T>>;
  const started = read(auth);
  running.set(queryKey, started);
  const forget = () => {
    if (running.get(queryKey) === started) running.delete(queryKey);
  };
  started.then(forget, forget);
  return started;
}

function initialState<T>(read: object, queryKey: string, reuseLast: boolean): AccountQueryState<T> {
  const row = queryKey.startsWith("signed-in:") ? lastGood.get(read)?.get(queryKey) : undefined;
  if (row && (reuseLast || Date.now() - row.at < FRESH_MS)) {
    return { loading: false, unavailable: false, reason: null, data: row.data as T };
  }
  return loadingState;
}

export function useAccountQuery<T>(read: AccountQueryRead<T>, options: { reuseLast?: boolean } = {}): AccountQueryResult<T> {
  const reuseLast = options.reuseLast === true;
  const authSnapshot = useAuthSnapshot();
  const [version, setVersion] = useState(0);
  // Revalidating only until the first fresh answer of this mount lands.
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const queryKey =
    authSnapshot.status === "signed-in"
      ? `signed-in:${authSnapshot.user.id}`
      : authSnapshot.status;
  const [result, setResult] = useState<{
    key: string;
    state: AccountQueryState<T>;
  }>({
    key: queryKey,
    state: initialState<T>(read, queryKey, reuseLast),
  });

  useEffect(() => {
    let active = true;
    // "loading" (auth still restoring after a remount) keeps the rows; signed-out or another user drops them.
    if (queryKey.startsWith("signed-in:")) forgetOthers(queryKey);
    else if (queryKey === "signed-out") forgetOthers(null);

    void sharedRead(read, queryKey, authSnapshot)
      .then((response) => {
        if (!active) {
          return;
        }

        if (response.status !== "unavailable") remember(read, queryKey, response.data);
        setSettledFor(queryKey);
        setResult((previous) => {
          // A re-read that fails (after a mutation succeeded, or a token refresh) keeps the rows already on screen for
          // the same user: replacing them with "unavailable" would make a succeeded apply/submit look failed.
          // A gone session still wins so the views can prompt for sign-in.
          if (response.status === "unavailable" && response.reason !== "unauthorized" && previous.key === queryKey && previous.state.data !== null) {
            return previous;
          }
          return {
            key: queryKey,
            state:
              response.status === "unavailable"
                ? { loading: false, unavailable: true, reason: response.reason, data: null }
                : { loading: false, unavailable: false, reason: null, data: response.data },
          };
        });
      });

    return () => {
      active = false;
    };
  }, [authSnapshot, queryKey, read, version]);

  const state = result.key === queryKey ? result.state : loadingState;
  // A seeded (remembered) answer is on screen until this mount's own read settles.
  const revalidating = !state.loading && state.data !== null && settledFor !== queryKey;
  return { ...state, revalidating, refresh };
}

/** Test hook: forgets every remembered answer (module-level reads are shared between tests). */
export function resetAccountQueryCache(): void {
  forgetOthers(null);
}
