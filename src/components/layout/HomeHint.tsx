"use client";

import { useEffect } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { isFinishedUser } from "@/lib/auth-route";
import { setHomeHint } from "@/lib/home-hint";

/**
 * Keeps the `ninja_home` hint cookie in step with the session so `proxy.ts` can send a returning finished user from `/`
 * straight to `/home` (no Intro flash). Renders nothing. While the session is still being restored it leaves the hint
 * alone; a final signed-out or unfinished session clears it.
 */
export function HomeHint() {
  const snapshot = useAuthSnapshot();
  const status = snapshot.status;
  const finished = isFinishedUser(snapshot);
  useEffect(() => {
    if (status === "loading") return;
    setHomeHint(finished);
  }, [status, finished]);
  return null;
}
