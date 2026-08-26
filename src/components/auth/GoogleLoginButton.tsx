"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions, useFoundationMode } from "@/components/auth/FoundationProvider";
import { simulateMockSignInFailure } from "@/lib/foundation/auth-adapter";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";

type LoginState = "idle" | "pending" | "error";

export function GoogleLoginButton() {
  const { signIn } = useAuthActions();
  const mode = useFoundationMode();
  const router = useRouter();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const isMock = mode === "mock";
  const pending = loginState === "pending";
  const failed = loginState === "error";

  const handleSignIn = async (simulateFailure = false) => {
    onboardingLog("oauth.button.clicked", { mode, simulateFailure });
    setLoginState("pending");

    try {
      if (simulateFailure) {
        await simulateMockSignInFailure();
      } else {
        // api 모드: 구글 동의 화면으로 전체 페이지 리다이렉트 (Promise는 resolve되지 않음)
        await signIn();
      }

      setLoginState("idle");

      if (!simulateFailure && isMock) {
        onboardingLog("onboarding.mock.redirect", { targetPath: "/signup/wallet" });
        router.push("/signup/wallet");
      }
    } catch (error) {
      onboardingLog("oauth.button.failed", onboardingErrorDetails(error));
      setLoginState("error");
    }
  };

  return (
    <div className="mt-5">
      <button
        aria-label={
          pending
            ? "Starting Google sign-in…"
            : failed
              ? "Retry Google sign-in"
              : "Continue with Google"
        }
        aria-busy={pending}
        aria-describedby="google-login-status"
        className="flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        onClick={() => void handleSignIn()}
        type="button"
      >
        <span className="text-base font-bold">G</span>
        {pending ? "Starting Google sign-in…" : failed ? "Retry Google sign-in" : "Continue with Google"}
      </button>
      <p className="mt-3 text-sm text-ink-muted" id="google-login-status" role="status">
        {isMock
          ? pending
            ? "Mock mode: starting the local sign-in preview."
            : "Mock mode: this local preview does not contact Google or create an account."
          : "You will be redirected to Google to sign in."}
      </p>
      {failed ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          Google sign-in failed. Please try again.
        </p>
      ) : null}
      {isMock && !pending && !failed ? (
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
