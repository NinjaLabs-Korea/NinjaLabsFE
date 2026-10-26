"use client";

import { useCallback, useEffect, useState } from "react";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import type { PublicCohort } from "@/lib/cohorts";

export type CurrentCohortState =
  | { status: "loading"; cohort: null }
  | { status: "failed"; cohort: null }
  | { status: "ready"; cohort: PublicCohort | null };

/**
 * The open cohort (`GET /cohorts/current`), read in the browser so the public pages that show it (Intro banner, `/recruit`)
 * stay static. `ready` with `cohort: null` means no cohort is open; `failed` means the read itself failed (BE down).
 */
export function useCurrentCohort(): CurrentCohortState & {
  /** Re-reads in the background after a change (the page keeps showing the cohort it has; a failed re-read keeps it too). */
  reload: () => void;
  /** The retry of a failed first read: back to `loading` while it runs. */
  retry: () => void;
} {
  const api = useCohortApi();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<CurrentCohortState>({ status: "loading", cohort: null });
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const retry = useCallback(() => {
    setState({ status: "loading", cohort: null });
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    api.getCurrentCohort().then(
      (cohort) => active && setState({ status: "ready", cohort }),
      () => active && setState((previous) => (previous.status === "ready" ? previous : { status: "failed", cohort: null })),
    );
    return () => {
      active = false;
    };
  }, [api, version]);

  return { ...state, reload, retry };
}
