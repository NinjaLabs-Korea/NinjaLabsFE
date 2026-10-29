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

/**
 * Last successful answer per (read function, signed-in user key), used only by callers that pass `reuseLast`: display-only
 * reads (the cohort CTA, the home recruitment card), never data that gates an action. A locale switch or a page hop remounts
 * the readers; starting from the last answer keeps them from flashing a placeholder while the fresh read (which always runs
 * and replaces it) is in flight. The key starts with `signed-in:<id>`, so another account never sees these rows.
 */
const lastGood = new WeakMap<object, Map<string, unknown>>();

function initialState<T>(read: object, queryKey: string): AccountQueryState<T> {
  const rows = lastGood.get(read);
  if (queryKey.startsWith("signed-in:") && rows?.has(queryKey)) {
    return { loading: false, unavailable: false, reason: null, data: rows.get(queryKey) as T };
  }
  return loadingState;
}

export function useAccountQuery<T>(read: AccountQueryRead<T>, options: { reuseLast?: boolean } = {}): AccountQueryResult<T> {
  const reuseLast = options.reuseLast === true;
  const authSnapshot = useAuthSnapshot();
  const [version, setVersion] = useState(0);
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
    state: reuseLast ? initialState<T>(read, queryKey) : loadingState,
  });

  useEffect(() => {
    let active = true;

    void read(authSnapshot)
      .then((response) => {
        if (!active) {
          return;
        }

        if (reuseLast && response.status !== "unavailable") {
          const rows = lastGood.get(read) ?? new Map<string, unknown>();
          rows.set(queryKey, response.data);
          lastGood.set(read, rows);
        }
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
  }, [authSnapshot, queryKey, read, reuseLast, version]);

  return { ...(result.key === queryKey ? result.state : loadingState), refresh };
}
