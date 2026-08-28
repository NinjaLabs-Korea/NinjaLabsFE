"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";

export function AdminGate({ children }: { children: ReactNode }) {
  const auth = useAuthSnapshot();
  const mode = useFoundationMode();
  if (mode === "mock") return children;

  if (auth.status !== "signed-in") {
    if (auth.status === "loading") {
      return <div className="mx-auto max-w-content px-6 py-20 text-sm text-ink-muted">Checking admin access…</div>;
    }
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">Admin sign-in required</h1><Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/signup">Sign in</Link></div>;
  }
  if (!auth.user.isAdmin) {
    return <div className="mx-auto max-w-content px-6 py-20"><h1 className="font-display text-4xl text-ink">Admin access only</h1><p className="mt-3 text-ink-muted">Your account does not have administrator permission.</p></div>;
  }
  return children;
}
