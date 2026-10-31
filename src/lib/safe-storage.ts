/**
 * Best-effort Web Storage access. The window may not exist (server render) and the storage may throw (blocked site data,
 * private mode, quota), so every helper swallows both: reads give `null`, writes and removals report `false` / do nothing.
 * Callers keep their own key names and value formats; this module only owns the "might be unavailable" boilerplate.
 */
export type StorageKind = "local" | "session";

function area(kind: StorageKind): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage(kind: StorageKind, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** True when the value was stored. */
export function writeStorage(kind: StorageKind, key: string, value: string): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** True when the removal went through (or there was nothing to remove from). */
export function removeStorage(kind: StorageKind, key: string): boolean {
  try {
    const storage = area(kind);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
