import { useSyncExternalStore } from "react";

/**
 * Tab-scoped "this tab had a signed-in session" flag. `<html>` lives in `[locale]/layout`, so a locale switch remounts
 * the whole provider tree and auth restarts as `loading`; the header uses this hint to keep the signed-in user chip's
 * box (instead of the signed-out look) during that gap. It holds a boolean only: no id, nickname or token.
 */
const KEY = "ninja.session.hint";
const listeners = new Set<() => void>();

export function getSessionHint(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

export function setSessionHint(): void {
  if (getSessionHint()) return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    return;
  }
  notify();
}

export function clearSessionHint(): void {
  if (!getSessionHint()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  notify();
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
