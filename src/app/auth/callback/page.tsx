"use client";

import Link from "next/link";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";

export default function AuthCallbackPage() {
  const { status } = useAuthSnapshot();
  const failed = status === "signed-out";
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <h1 className="font-display text-2xl text-ink">{failed ? "Sign-in could not be completed" : "Signing you in…"}</h1>
      <p className="mt-3 text-sm text-ink-muted" role="status">
        {failed ? "Please try signing in again in this browser tab." : "Restoring your account. You will be redirected shortly."}
      </p>
      {failed ? (
        <Link className="mt-5 inline-flex rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">
          Back to sign in
        </Link>
      ) : null}
    </div>
  );
}
