"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useCohortApi } from "@/components/auth/FoundationProvider";
import type { PublicCohort } from "@/lib/cohorts";
import { readStorage, writeStorage } from "@/lib/safe-storage";

type CohortApiLike = ReturnType<typeof useCohortApi>;
type CohortRead = ReturnType<CohortApiLike["getCurrentCohort"]>;

/**
 * The hub mounts two readers at once (banner + hero secondary CTA): they share the read already in flight, so the page sends
 * one `GET /cohorts/current` (and one CORS preflight). Only concurrent callers share: the entry is dropped as soon as the
 * read settles, so `reload()` after a change always hits the network.
 */
const inFlight = new WeakMap<CohortApiLike, CohortRead>();

/**
 * The last successful answer per client. A locale switch or a client-side hop remounts the readers; starting from it keeps
 * them from flashing a placeholder while the fresh read (which still runs on every mount and replaces it) is in flight.
 */
const lastReads = new WeakMap<CohortApiLike, PublicCohort | null>();

const HINT_KEY = "ninja.cohortAccepting";

function rememberAccepting(cohort: PublicCohort | null): void {
  // storage blocked: the hint is only a layout convenience
  writeStorage("session", HINT_KEY, cohort?.acceptingApplications ? "1" : "0");
}

/**
 * Per-tab hint written on every successful read: did the last answer say a cohort accepts applications? Lets a hard reload
 * reserve the space of the recruitment card before the read lands. `null` when unknown (first visit, storage unavailable, server).
 */
export function cohortAcceptingHint(): boolean | null {
  const value = readStorage("session", HINT_KEY);
  return value === "1" ? true : value === "0" ? false : null;
}

/** The last answer this tab got from the current-cohort read, or `undefined` before the first one. */
export function lastCurrentCohort(api: CohortApiLike): PublicCohort | null | undefined {
  return lastReads.has(api) ? (lastReads.get(api) ?? null) : undefined;
}

function readCurrentCohort(api: CohortApiLike): CohortRead {
  const running = inFlight.get(api);
  if (running) return running;
  const started = api.getCurrentCohort();
  inFlight.set(api, started);
  const forget = () => {
    if (inFlight.get(api) === started) inFlight.delete(api);
  };
  started.then(forget, forget);
  return started;
}

/**
 * The current cohort as the server read it while rendering the (static) page: `undefined` when the server read failed or did
 * not happen, `null` when no cohort is open. Seeds `useCurrentCohort` so the first paint already has its final shape; the
 * browser read still runs on every mount and replaces it.
 */
const InitialCohortContext = createContext<PublicCohort | null | undefined>(undefined);

export function InitialCohortProvider({ cohort, children }: { cohort: PublicCohort | null | undefined; children: ReactNode }) {
  return createElement(InitialCohortContext.Provider, { value: cohort }, children);
}

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
  const initial = useContext(InitialCohortContext);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<CurrentCohortState>(() => {
    const last = lastCurrentCohort(api);
    const seed = last === undefined ? initial : last;
    return seed === undefined ? { status: "loading", cohort: null } : { status: "ready", cohort: seed };
  });
  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const retry = useCallback(() => {
    setState({ status: "loading", cohort: null });
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    readCurrentCohort(api).then(
      (cohort) => {
        lastReads.set(api, cohort);
        rememberAccepting(cohort);
        if (active) setState({ status: "ready", cohort });
      },
      () => active && setState((previous) => (previous.status === "ready" ? previous : { status: "failed", cohort: null })),
    );
    return () => {
      active = false;
    };
  }, [api, version]);

  return { ...state, reload, retry };
}
