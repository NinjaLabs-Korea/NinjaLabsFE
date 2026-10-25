"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthSnapshot, useOnboardingApi } from "@/components/auth/FoundationProvider";
import { withLocaleOf } from "@/i18n/routing";
import { ApiHttpError } from "@/lib/api/http";
import { getOnboardingPath } from "@/lib/api/auth-adapter";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";

export function CompleteOnboarding() {
  const t = useTranslations("signup.getStarted.completeError");
  const apiClient = useOnboardingApi();
  const auth = useAuthSnapshot();
  const [state, setState] = useState<"pending" | "done" | "error">("pending");
  const signedIn = auth.status === "signed-in";
  const alreadyCompleted = signedIn && auth.user.onboardingCompleted === true;
  // Where the user's unfinished step lives; read by the failure handler without making `complete` change identity.
  const resumePathRef = useRef<string | null>(null);
  const resumePath = signedIn ? getOnboardingPath(auth.user) : null;
  // Declared before the completing effect, so the ref is current when its request starts.
  useEffect(() => {
    resumePathRef.current = resumePath;
  }, [resumePath]);

  const complete = useCallback(() => {
    onboardingLog("onboarding.complete.started");
    return apiClient.completeOnboarding().then(
      () => {
        onboardingLog("onboarding.complete.succeeded");
        setState("done");
      },
      (error: unknown) => {
        onboardingLog("onboarding.complete.failed", onboardingErrorDetails(error));
        // 409 PROFILE_REQUIRED: this page was opened (bookmark, typed URL) before the profile step was saved. Retrying
        // can never succeed, so send the user back to the step they are on instead of offering a dead Retry.
        const resume = resumePathRef.current;
        if (error instanceof ApiHttpError && error.code === "PROFILE_REQUIRED" && resume && resume !== "/signup/get-started") {
          window.location.assign(withLocaleOf(window.location.pathname, resume));
          return;
        }
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
      <p className="text-sm text-danger">{t("message")}</p>
      <button
        className="rounded-control bg-danger px-4 py-2 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={retry}
        type="button"
      >
        {t("retry")}
      </button>
    </div>
  );
}
