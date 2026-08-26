"use client";

import { useEffect } from "react";
import { useFoundationApiClient } from "@/components/auth/FoundationProvider";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";

export function CompleteOnboarding() {
  const apiClient = useFoundationApiClient();

  useEffect(() => {
    onboardingLog("onboarding.complete.started");
    void apiClient.completeOnboarding()
      .then(() => onboardingLog("onboarding.complete.succeeded"))
      .catch((error) => {
        onboardingLog("onboarding.complete.failed", onboardingErrorDetails(error));
        // The completion page remains usable; a later authenticated visit can retry.
      });
  }, [apiClient]);

  return null;
}
