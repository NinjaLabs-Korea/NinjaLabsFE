"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { useSingleFlight } from "@/components/ui/useSingleFlight";

export type AdminListLoadState = "loading" | "ready" | "failed";

/**
 * A manager's record list: `initial` (the mock fixtures; empty in api mode, where the page renders before any read) plus the read after
 * mount and every re-read after a write. `loadState` tells "nothing loaded yet / the read failed" from "the BE answered empty" - without
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

/**
 * Wraps an async handler so a second call is ignored while one is in flight (the ui `useSingleFlight` guard). The wrapper is stable;
 * it always runs the latest `fn`.
 */
export function useSingleFlightCallback<A extends unknown[]>(fn: (...args: A) => Promise<void>): (...args: A) => Promise<void> {
  const { run } = useSingleFlight();
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  return useCallback(async (...args: A) => {
    await run(() => latest.current(...args));
  }, [run]);
}

/** The "could not load the list" toast of a manager (stable, for `useAdminList`'s `onLoadFailed`). */
export function useLoadFailedToast(title: string, description: string): () => void {
  return useCallback(() => pushAdminToast({ variant: "danger", title, description }), [title, description]);
}

/**
 * The single-flight delete of a manager row. A double click lands before the confirm dialog closes, and every extra DELETE would answer
 * 404/409 and toast "failed". Closes the dialog, calls the API, drops the row (`keyOf`), runs `onRemoved` (e.g. reset a form that was
 * editing that row: a later save would PATCH a missing row), toasts; on failure toasts and re-reads (the row may be gone already or changed).
 */
export function useAdminRecordDelete<T>({ call, keyOf, setRecords, closeDialog, onRemoved, describeError, successToast, failedTitle, reload }: {
  call: (record: T) => Promise<unknown>;
  keyOf: (record: T) => string;
  setRecords: Dispatch<SetStateAction<T[]>>;
  closeDialog: () => void;
  onRemoved?: (record: T) => void;
  describeError: (error: unknown) => string;
  successToast: (record: T) => { title: string; description: string };
  failedTitle: string;
  reload: () => Promise<void>;
}): (record: T) => Promise<void> {
  return useSingleFlightCallback(async (record: T) => {
    closeDialog();
    try {
      await call(record);
      setRecords((current) => current.filter((item) => keyOf(item) !== keyOf(record)));
      onRemoved?.(record);
      pushAdminToast({ variant: "success", ...successToast(record) });
    } catch (error) {
      pushAdminToast({ variant: "danger", title: failedTitle, description: describeError(error) });
      void reload();
    }
  });
}
