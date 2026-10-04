"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthSnapshot, useFoundationApiClient } from "@/components/auth/FoundationProvider";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";

export function CompleteOnboarding() {
  const apiClient = useFoundationApiClient();
  const auth = useAuthSnapshot();
  const [state, setState] = useState<"pending" | "done" | "error">("pending");
  const signedIn = auth.status === "signed-in";
  const alreadyCompleted = signedIn && auth.user.onboardingCompleted === true;

  const complete = useCallback(() => {
    onboardingLog("onboarding.complete.started");
    return apiClient.completeOnboarding().then(
      () => {
        onboardingLog("onboarding.complete.succeeded");
        setState("done");
      },
      (error: unknown) => {
        onboardingLog("onboarding.complete.failed", onboardingErrorDetails(error));
        setState("error");
      },
    );
  }, [apiClient]);

  useEffect(() => {
    if (!signedIn || alreadyCompleted) return;
    void complete();
  }, [alreadyCompleted, complete, signedIn]);

  const retry = () => {
    setState("pending");
    void complete();
  };

  if (state !== "error" || alreadyCompleted) return null;

  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-tile border border-danger bg-danger-soft p-4 sm:flex-row sm:items-center" role="alert">
      <p className="text-sm text-danger">We couldn’t finish saving your onboarding. Please try again.</p>
      <button
        className="rounded-control bg-danger px-4 py-2 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={retry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}
