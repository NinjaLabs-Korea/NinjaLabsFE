/**
 * One-shot "flash" toast that survives a navigation (and a full reload): the page that finishes an action calls
 * `pushFlash(key)` before navigating away, and `layout/FlashToast` (rendered once by AppShell) shows it on the next
 * page and clears it. `key` is a message key under `common.flash` (`<key>.title` / `<key>.description`).
 * Storage access is best-effort: a blocked sessionStorage still delivers the flash to the current tab via the event.
 */
export const FLASH_STORAGE_KEY = "ninja.flash";
export const FLASH_EVENT = "ninja:flash";

export const flashKeys = ["accountDeleted"] as const;
export type FlashKey = (typeof flashKeys)[number];

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
