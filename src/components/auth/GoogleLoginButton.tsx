"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthActions, useFoundationMode } from "@/components/auth/FoundationProvider";
import { TurnstileWidget, type TurnstileHandle, type TurnstileStatus } from "@/components/auth/TurnstileWidget";
import { useRouter } from "@/i18n/navigation";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";
import { clearReturnPath, rememberReturnPath } from "@/lib/return-path";

type LoginState = "idle" | "pending" | "error";

type GoogleLoginButtonProps = {
  /** Cloudflare Turnstile site key from the runtime config (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Unset → no widget. */
  turnstileSiteKey?: string;
};

export function GoogleLoginButton({ turnstileSiteKey }: GoogleLoginButtonProps = {}) {
  const t = useTranslations("common.googleLogin");
  const { signIn } = useAuthActions();
  const mode = useFoundationMode();
  const router = useRouter();
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const isMock = mode === "mock";
  const pending = loginState === "pending";
  const failed = loginState === "error";
  // Mock mode never reaches the BE, so it never needs (or renders) the widget - a preview host outside the site key's
  // hostname list would otherwise leave the button disabled forever.
  const turnstileKey = isMock ? undefined : turnstileSiteKey;
  const awaitingTurnstile = Boolean(turnstileKey) && !turnstileToken;
  const buttonLabel = pending ? t("starting") : failed ? t("retry") : t("continue");

  const handleTurnstile = useCallback((_status: TurnstileStatus, token: string | null) => setTurnstileToken(token), []);

  // Back from the BE (e.g. a 400 TURNSTILE_FAILED page) restores this page from the bfcache with a spent token and a
  // pending button: start over with a fresh check.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setLoginState("idle");
      turnstileRef.current?.reset();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const handleSignIn = async (simulateFailure = false) => {
    onboardingLog("oauth.button.clicked", { mode, simulateFailure });
    setLoginState("pending");
    // `/signup?returnTo=/recruit`: come back to the page that asked for the sign-in once it (and onboarding) is done.
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    // A plain sign-in must not inherit a path left by an earlier abandoned attempt (e.g. `/recruit`).
    if (returnTo) rememberReturnPath(returnTo);
    else clearReturnPath();

    try {
      if (simulateFailure) {
        // mock 전용 모듈: 이 분기에서만 불러와 세션 미리보기 어댑터가 공용 번들에 실리지 않게 한다.
        const { simulateMockSignInFailure } = await import("@/lib/mocks/session-preview-auth-adapter");
        await simulateMockSignInFailure();
      } else {
        // api 모드: 구글 동의 화면으로 전체 페이지 리다이렉트 (Promise는 resolve되지 않음). 위젯 토큰은 BE가 1회 검증한다.
        // 토큰을 쓴 뒤 뒤로가기로 돌아오면 pageshow(bfcache) 핸들러가 위젯을 다시 돌린다.
        await signIn(turnstileToken ? { turnstileToken } : undefined);
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
        aria-label={buttonLabel}
        aria-busy={pending}
        aria-describedby="google-login-status"
        className="flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-base font-semibold text-on-inverse motion-control motion-press hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || awaitingTurnstile}
        onClick={() => void handleSignIn()}
        type="button"
      >
        {pending ? <span aria-hidden="true" className="spinner" /> : <span className="text-base font-bold">G</span>}
        {buttonLabel}
      </button>
      {turnstileKey ? <TurnstileWidget onChange={handleTurnstile} ref={turnstileRef} siteKey={turnstileKey} /> : null}
      <p className="mt-3 text-sm text-ink-muted" id="google-login-status" role="status">
        {isMock
          ? pending
            ? t("mockPending")
            : t("mockIdle")
          : t("redirectNotice")}
      </p>
      {failed ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t("failed")}
        </p>
      ) : null}
      {isMock && !pending && !failed ? (
        <button
          className="mt-3 text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => void handleSignIn(true)}
          type="button"
        >
          {t("previewFailure")}
        </button>
      ) : null}
    </div>
  );
}
