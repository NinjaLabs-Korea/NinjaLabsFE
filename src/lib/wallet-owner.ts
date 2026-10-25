/**
 * Which signed-in user a persisted wagmi connection belongs to.
 *
 * wagmi keeps the connection in `localStorage` (`wagmi.*`) and `WagmiProvider` reconnects to it on mount, but the app
 * mounts `WalletProvider` only on the wallet pages. A sign-out, an account withdrawal or an account switch that happens
 * elsewhere (`/account`, the header menu) therefore cannot call wagmi's `disconnect()` at that moment, and the next
 * user would find the previous user's address connected. The connection is tagged with the user id that made it; the
 * guard (`components/wallet/WalletSessionGuard`) disconnects as soon as it sees a different owner or none signed in.
 *
 * The id is not a secret (it is in every API response) and no token is stored here.
 */
export const WALLET_OWNER_STORAGE_KEY = "ninja.walletOwner";

export function readWalletOwner(): string | null {
  try {
    return window.localStorage.getItem(WALLET_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeWalletOwner(userId: string | null): void {
  try {
    if (userId) window.localStorage.setItem(WALLET_OWNER_STORAGE_KEY, userId);
    else window.localStorage.removeItem(WALLET_OWNER_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the connection then cannot outlive the page either way.
  }
}

export type WalletOwnerAction = "adopt" | "disconnect" | "clear" | "none";

/**
 * What to do with the wallet connection, given the settled auth state.
 * - `adopt`: a signed-in user holds a connection nobody owns (they just connected, or it predates the marker): tag it.
 * - `disconnect`: the connection is tagged for someone else, or for a user who is no longer signed in (sign-out,
 *   withdrawal, account switch): call wagmi `disconnect()` and forget the tag.
 * - `clear`: no connection, but a stale tag for another user: forget it.
 * A signed-out visitor who connects before signing in is left alone (there is no owner to protect yet).
 */
export function walletOwnerAction({
  authReady,
  connected,
  userId,
  owner,
}: {
  authReady: boolean;
  connected: boolean;
  userId: string | null;
  owner: string | null;
}): WalletOwnerAction {
  if (!authReady) return "none";
  if (connected) {
    if (owner === null) return userId ? "adopt" : "none";
    return owner === userId ? "none" : "disconnect";
  }
  return owner !== null && owner !== userId ? "clear" : "none";
}
