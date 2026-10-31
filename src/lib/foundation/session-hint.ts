import { useSyncExternalStore } from "react";
import { hasRefreshCookieHint } from "@/lib/api/http";
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

/**
 * Browser-scoped "the last session here was a member who finished onboarding" flag (localStorage, so a new tab or a
 * reload sees it). It lets the hub CTA show "My activity" at hydration instead of an empty box until the session restore
 * (refresh + `/auth/me`, two BE round trips) answers. Optimistic only: it is read together with the refresh-cookie hint,
 * never trusted for access (`/home` still checks the session), and a restore that ends signed out clears it, so the CTA
 * then falls back to "Get started". Boolean only, like the tab hint.
 */
const MEMBER_KEY = "ninja.session.member";

export function getMemberHint(): boolean {
  return readStorage("local", MEMBER_KEY) === "1" && hasRefreshCookieHint();
}

export function setMemberHint(member: boolean): void {
  if (readStorage("local", MEMBER_KEY) === (member ? "1" : null)) return;
  const changed = member ? writeStorage("local", MEMBER_KEY, "1") : removeStorage("local", MEMBER_KEY);
  if (changed) notify();
}

export function useMemberHint(): boolean {
  return useSyncExternalStore(subscribe, getMemberHint, getServerSnapshot);
}
