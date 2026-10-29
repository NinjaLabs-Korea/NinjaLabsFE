/**
 * One-shot "flash" toast that survives a navigation (and a full reload): the page that finishes an action calls
 * `pushFlash(key)` before navigating away, and `layout/FlashToast` (rendered once by AppShell) shows it on the next
 * page and clears it. `key` is a message key under `common.flash` (`<key>.title` / `<key>.description`).
 * Storage access is best-effort: a blocked sessionStorage still delivers the flash to the current tab via the event.
 */
export const FLASH_STORAGE_KEY = "ninja.flash";
export const FLASH_EVENT = "ninja:flash";

export const flashKeys = ["accountDeleted", "signInRequired", "signOutFailed", "profileSaved"] as const;
export type FlashKey = (typeof flashKeys)[number];

/** Flashes that report a failure (rendered as a danger toast); the rest are neutral confirmations. */
export const FAILURE_FLASH_KEYS: readonly FlashKey[] = ["signOutFailed"];

const isFlashKey = (value: unknown): value is FlashKey => flashKeys.includes(value as FlashKey);

export function pushFlash(key: FlashKey): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, key);
  } catch {
    // storage blocked: the event below still reaches this tab's FlashToast
  }
  window.dispatchEvent(new CustomEvent<FlashKey>(FLASH_EVENT, { detail: key }));
}

/**
 * Leaves a flash for the NEXT page load only: writes sessionStorage without notifying the mounted FlashToast (which
 * would consume it at once). Use right before a full-page navigation (`hardNavigate`), where `pushFlash` would be
 * taken by the page that is about to be unloaded and the destination would find nothing.
 */
export function stashFlash(key: FlashKey): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, key);
  } catch {
    // storage blocked: the flash is lost, the navigation still happens
  }
}

/** Reads and clears the pending flash (unknown values are dropped). */
export function takeFlash(): FlashKey | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(FLASH_STORAGE_KEY);
    window.sessionStorage.removeItem(FLASH_STORAGE_KEY);
    return isFlashKey(value) ? value : null;
  } catch {
    return null;
  }
}
