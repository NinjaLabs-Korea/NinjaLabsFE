"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";

/** Sign-up steps 2–4 need a backend session in API mode; mock mode keeps the screens previewable. */
export function SignupGate({ children }: { children: ReactNode }) {
  const mode = useFoundationMode();
  const auth = useAuthSnapshot();

  if (mode === "mock" || auth.status === "signed-in") return children;

  if (auth.status === "loading") {
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]" role="status">
        <p className="text-sm text-ink-muted">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
      <p className="text-sm font-semibold text-ink">Sign in to continue signing up</p>
      <p className="mt-1 text-sm text-ink-muted">Your session has ended or you have not signed in yet.</p>
      <Link
        className="mt-4 inline-block rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/signup"
      >
        Continue with Google
      </Link>
    </div>
  );
}
