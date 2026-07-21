"use client";

import { useEffect, useState } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import type { ApiResult } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";

type AccountQueryState<T> = {
  loading: boolean;
  unavailable: boolean;
  data: T | null;
};

type AccountQueryRead<T> = (auth: AuthSnapshot) => Promise<ApiResult<T>>;

const loadingState = {
  loading: true,
  unavailable: false,
  data: null,
} as const;

export function useAccountQuery<T>(read: AccountQueryRead<T>): AccountQueryState<T> {
  const authSnapshot = useAuthSnapshot();
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
              ? { loading: false, unavailable: true, data: null }
              : { loading: false, unavailable: false, data: response.data },
        });
      });

    return () => {
      active = false;
    };
  }, [authSnapshot, queryKey, read]);

  return result.key === queryKey ? result.state : loadingState;
}
