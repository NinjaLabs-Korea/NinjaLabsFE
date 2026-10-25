/**
 * Cross-tab auth notifications. No token is ever stored in Web Storage any more (the refresh token is an HttpOnly
 * cookie, the access token lives in each tab's memory), so another tab can no longer learn about a sign-out from a
 * `storage` event on a token key. Instead every API-mode tab opens a `BroadcastChannel("ninja-auth")` and posts
 * `signed-out` (explicit sign-out, or a refresh the BE rejected) and `signed-in` (a completed login, so a tab that
 * saw the session end may try a refresh again).
 *
 * Fallback without BroadcastChannel: `signed-out` writes the current timestamp to the non-secret
 * `localStorage["ninja.authEvent"]`; other tabs receive the `storage` event and treat it as a sign-out. `signed-in`
 * has no fallback (it only re-enables a refresh attempt, which a page load does anyway).
 */

export const AUTH_CHANNEL_NAME = "ninja-auth";
export const AUTH_EVENT_STORAGE_KEY = "ninja.authEvent";

export type AuthEvent = "signed-out" | "signed-in";

export type AuthEventBus = {
  broadcast: (event: AuthEvent) => void;
  /** Receives events from OTHER tabs only (a BroadcastChannel does not deliver to its own sender). */
  subscribe: (handler: (event: AuthEvent) => void) => () => void;
};

const isAuthEvent = (value: unknown): value is AuthEvent => value === "signed-out" || value === "signed-in";

/** One bus per tab (per auth adapter). Nothing is opened until the first call, so this is safe during SSR. */
export function createAuthEventBus(): AuthEventBus {
  let channel: BroadcastChannel | null | undefined;

  function getChannel(): BroadcastChannel | null {
    if (channel !== undefined) return channel;
    try {
      channel = typeof window !== "undefined" && typeof BroadcastChannel === "function"
        ? new BroadcastChannel(AUTH_CHANNEL_NAME)
        : null;
    } catch {
      channel = null;
    }
    return channel;
  }

  return {
    broadcast: (event) => {
      if (typeof window === "undefined") return;
      const current = getChannel();
      if (current) {
        try {
          current.postMessage({ type: event });
        } catch {
          // closed channel: nothing else to notify
        }
        return;
      }
      if (event !== "signed-out") return;
      try {
        window.localStorage.setItem(AUTH_EVENT_STORAGE_KEY, String(Date.now()));
      } catch {
        // storage blocked: other tabs learn about the sign-out on their next refresh
      }
    },
    subscribe: (handler) => {
      if (typeof window === "undefined") return () => {};
      const current = getChannel();
      if (current) {
        const onMessage = (message: MessageEvent<unknown>) => {
          const data = message.data;
          const type = data && typeof data === "object" && "type" in data ? data.type : null;
          if (isAuthEvent(type)) handler(type);
        };
        current.addEventListener("message", onMessage);
        return () => current.removeEventListener("message", onMessage);
      }
      const onStorage = (storage: StorageEvent) => {
        if (storage.key === AUTH_EVENT_STORAGE_KEY && storage.newValue !== null) handler("signed-out");
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
