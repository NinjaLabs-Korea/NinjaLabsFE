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
  /** Re-reads from the API (after a mutation) without touching the auth snapshot; keeps the current data while loading. */
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

        setResult({
          key: queryKey,
          state:
            response.status === "unavailable"
              ? { loading: false, unavailable: true, reason: response.reason, data: null }
              : { loading: false, unavailable: false, reason: null, data: response.data },
        });
      });

    return () => {
      active = false;
    };
  }, [authSnapshot, queryKey, read, version]);

  return { ...(result.key === queryKey ? result.state : loadingState), refresh };
}
