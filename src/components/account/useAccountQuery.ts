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

export function useAccountQuery<T>(read: AccountQueryRead<T>): AccountQueryResult<T> {
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
    state: loadingState,
  });

  useEffect(() => {
    let active = true;

    void read(authSnapshot)
      .then((response) => {
        if (!active) {
          return;
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
  }, [authSnapshot, queryKey, read, version]);

  return { ...(result.key === queryKey ? result.state : loadingState), refresh };
}
