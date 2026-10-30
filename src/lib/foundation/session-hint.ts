import { useSyncExternalStore } from "react";
import { readStorage, removeStorage, writeStorage } from "@/lib/safe-storage";

// Not the same as `lib/api/http.ts` REFRESH_COOKIE_HINT_KEY: that one is a localStorage hint that a refresh cookie may exist;
// this one is a sessionStorage hint that THIS tab was signed in (keeps the header chip across a locale remount).

/**
 * Tab-scoped "this tab had a signed-in session" flag. `<html>` lives in `[locale]/layout`, so a locale switch remounts
 * the whole provider tree and auth restarts as `loading`; the header uses this hint to keep the signed-in user chip's
 * box (instead of the signed-out look) during that gap. It holds a boolean only: no id, nickname or token.
 */
const KEY = "ninja.session.hint";
const listeners = new Set<() => void>();

export function getSessionHint(): boolean {
  return readStorage("session", KEY) === "1";
}

function notify() {
  for (const listener of listeners) listener();
}

export function setSessionHint(): void {
  if (getSessionHint()) return;
  if (writeStorage("session", KEY, "1")) notify();
}

export function clearSessionHint(): void {
  if (!getSessionHint()) return;
  if (removeStorage("session", KEY)) notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The server and the hydration pass render `false` (same as a hard load); a client-side remount reads the real value.
const getServerSnapshot = () => false;

export function useSessionHint(): boolean {
  return useSyncExternalStore(subscribe, getSessionHint, getServerSnapshot);
}
