"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type AdminListLoadState = "loading" | "ready" | "failed";

/**
 * A manager's record list: `initial` (the mock fixtures; empty in api mode, where the page renders before any read) plus the read after
 * mount and every re-read after a write. `loadState` tells "nothing loaded yet / the read failed" from "the BE answered empty" — without
 * it an api-mode page shows an empty table and invites creating what already exists. A failed re-read keeps the rows on screen.
 * `fetchList` and `onLoadFailed` must be stable (`useCallback`); `onLoadFailed` raises the toast.
 */
export function useAdminList<T>(fetchList: () => Promise<T[]>, initial: T[], onLoadFailed: () => void): {
  records: T[];
  setRecords: Dispatch<SetStateAction<T[]>>;
  loadState: AdminListLoadState;
  reload: () => Promise<void>;
  /** The retry button of the failed first read: back to "loading" while the read runs. */
  retry: () => void;
} {
  const [records, setRecords] = useState(initial);
  const [loadState, setLoadState] = useState<AdminListLoadState>(initial.length ? "ready" : "loading");

  const reload = useCallback(
    () => fetchList().then(
      (items) => {
        setRecords(items);
        setLoadState("ready");
      },
      () => {
        setLoadState((current) => (current === "ready" ? current : "failed"));
        onLoadFailed();
      },
    ),
    [fetchList, onLoadFailed],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const retry = useCallback(() => {
    setLoadState("loading");
    void reload();
  }, [reload]);

  return { records, setRecords, loadState, reload, retry };
}
