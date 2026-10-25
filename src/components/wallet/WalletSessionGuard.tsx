"use client";

import { useEffect } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { readWalletOwner, walletOwnerAction, writeWalletOwner } from "@/lib/wallet-owner";

/**
 * Keeps the wagmi connection from outliving the user who made it: disconnects on sign-out, account withdrawal and account
 * switch (see `lib/wallet-owner.ts` for why this works from a marker instead of reacting only to live events). Mounted by
 * `WalletProvider`, renders nothing. Same rule as the one-time agent key in `AgentRegisterForm`: state that belongs to a
 * session is tied to the user id.
 */
export function WalletSessionGuard() {
  const auth = useAuthSnapshot();
  const { isConnected } = useConnection();
  const disconnect = useDisconnect().mutate;
  const authReady = auth.status !== "loading";
  const userId = auth.status === "signed-in" ? auth.user.id : null;

  useEffect(() => {
    const action = walletOwnerAction({ authReady, connected: isConnected, userId, owner: readWalletOwner() });
    if (action === "adopt") writeWalletOwner(userId);
    else if (action === "disconnect") {
      disconnect();
      writeWalletOwner(null);
    } else if (action === "clear") writeWalletOwner(null);
  }, [authReady, isConnected, userId, disconnect]);

  return null;
}
