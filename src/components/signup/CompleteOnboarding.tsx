"use client";

import { useEffect } from "react";
import { useFoundationApiClient } from "@/components/auth/FoundationProvider";

export function CompleteOnboarding() {
  const apiClient = useFoundationApiClient();

  useEffect(() => {
    void apiClient.completeOnboarding().catch(() => {
      // The completion page remains usable; a later authenticated visit can retry.
    });
  }, [apiClient]);

  return null;
}
