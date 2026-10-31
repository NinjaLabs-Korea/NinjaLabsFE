"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuthActions, useAuthSnapshot, useOnboardingApi } from "@/components/auth/FoundationProvider";
import { withLocaleOf } from "@/i18n/routing";
import { ApiHttpError } from "@/lib/api/http";
import { peekReturnPath, takeReturnPath } from "@/lib/return-path";
import { ReturnPathNotice } from "@/components/signup/ReturnPathNotice";
import { getOnboardingPath } from "@/lib/api/auth-adapter";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";

const subscribe = () => () => undefined;
const getServerPath = () => null; // sessionStorage is client-only: server and hydration see no path

/** Consumes the remembered return path (if any) and leaves for it; true when it left. */
function goBackIfRemembered(): boolean {
  const path = takeReturnPath();
  if (!path) return false;
  window.location.replace(withLocaleOf(window.location.pathname, path));
  return true;
}

/**
 * Finishes onboarding on the last signup step. `children` is the "what next" menu.
 * With a remembered return path (`lib/return-path.ts`, e.g. /recruit) the menu is replaced by a short status and the
 * user is sent back there once onboarding is saved. If saving fails, the error with Retry shows above the menu and the
 * remembered page stays reachable through `ReturnPathNotice`.
 */
export function CompleteOnboarding({ children }: { children?: ReactNode }) {
  const t = useTranslations("signup.getStarted.completeError");
  const tReturn = useTranslations("signup.getStarted");
  const remembered = useSyncExternalStore(subscribe, peekReturnPath, getServerPath) !== null;
  // Latched when the path is consumed, so the status does not flip back to the menu while the page navigates away.
  const [leaving, setLeaving] = useState(false);
  const returning = remembered || leaving;
  const apiClient = useOnboardingApi();
  const auth = useAuthSnapshot();
  const { refresh } = useAuthActions();
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
  // Arriving here directly (bookmark, history) before the profile is saved: the BE answers 409 PROFILE_REQUIRED and a
  // retry could never succeed, so send the user back to the step they still owe. The session-restore redirect leaves
  // /signup/* alone, which is why this page has to do it. A snapshot without a step (mock mode) never redirects.
  const owedStep = signedIn && !alreadyCompleted && typeof auth.user.onboardingStep === "number" && auth.user.onboardingStep < 4
    ? getOnboardingPath(auth.user)
    : null;

  const complete = useCallback(() => {
    onboardingLog("onboarding.complete.started");
    return apiClient.completeOnboarding().then(
      () => {
        onboardingLog("onboarding.complete.succeeded");
        setState("done");
        if (goBackIfRemembered()) setLeaving(true);
        // The session snapshot still says "unfinished"; re-read it so the hub CTA ("My activity") and the user menu see a finished user.
        void refresh?.().catch(() => undefined);
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
  }, [apiClient, refresh]);

  useEffect(() => {
    if (owedStep) {
      window.location.replace(withLocaleOf(window.location.pathname, owedStep));
      return;
    }
    if (alreadyCompleted) {
      // No state here (the store snapshot is not reactive, so the status stays until the navigation happens).
      goBackIfRemembered();
      return;
    }
    if (!signedIn) return;
    void complete();
  }, [alreadyCompleted, complete, owedStep, signedIn]);

  const retry = () => {
    setState("pending");
    void complete();
  };

  const failed = state === "error" && !alreadyCompleted;
  if (returning && !failed) {
    return <p className="mb-6 text-center text-sm text-ink-muted" role="status">{tReturn("returning")}</p>;
  }
  if (!failed) return <>{children}</>;

  return (
    <>
    <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-tile border border-danger bg-danger-soft p-4 sm:flex-row sm:items-center" role="alert">
      <p className="text-sm text-danger">{t("message")}</p>
      <button
        className="rounded-control bg-danger px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={retry}
        type="button"
      >
        {t("retry")}
      </button>
    </div>
    <ReturnPathNotice />
    {children}
    </>
  );
}
