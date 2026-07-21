"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions, useFoundationMode } from "@/components/auth/FoundationProvider";
import { simulateMockSignInFailure } from "@/lib/foundation/auth-adapter";

type LoginState = "idle" | "pending" | "error";

export function GoogleLoginButton() {
  const { signIn } = useAuthActions();
  const mode = useFoundationMode();
  const router = useRouter();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const unavailable = mode === "api";
  const pending = loginState === "pending";
  const failed = loginState === "error";

  const handleSignIn = async (simulateFailure = false) => {
    setLoginState("pending");

    try {
      if (simulateFailure) {
        await simulateMockSignInFailure();
      } else {
        await signIn();
      }

      setLoginState("idle");

      if (!simulateFailure) {
        router.push("/signup/wallet");
      }
    } catch {
      setLoginState("error");
    }
  };

  return (
    <div className="mt-5">
      <button
        aria-label={
          unavailable
            ? "Google sign-in unavailable"
            : pending
              ? "Starting mock sign-in…"
              : failed
                ? "Retry mock sign-in"
                : "Google sign-in preview"
        }
        aria-busy={pending}
        aria-describedby="google-login-status"
        className="flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={unavailable || pending}
        onClick={unavailable ? undefined : () => void handleSignIn()}
        type="button"
      >
        <span className="text-base font-bold">G</span>
        {unavailable
          ? "Google sign-in unavailable"
          : pending
            ? "Starting mock sign-in…"
            : failed
              ? "Retry mock sign-in"
              : "Google sign-in preview"}
      </button>
      <p className="mt-3 text-sm text-ink-muted" id="google-login-status" role="status">
        {unavailable
          ? "API mode: Google sign-in is unavailable pending backend integration."
          : pending
            ? "Mock mode: starting the local sign-in preview."
            : "Mock mode: this local preview does not contact Google or create an account."}
      </p>
      {failed ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          Mock Google sign-in failed. No request was made; retry the local preview.
        </p>
      ) : null}
      {!unavailable && !pending && !failed ? (
        <button
          className="mt-3 text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => void handleSignIn(true)}
          type="button"
        >
          Preview failed sign-in
        </button>
      ) : null}
    </div>
  );
}
