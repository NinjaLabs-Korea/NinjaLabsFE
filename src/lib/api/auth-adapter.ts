import type { AuthAdapter, AuthSnapshot } from "@/lib/contracts/auth";
import { captureTokensFromLocation, createApiHttp, type ApiHttp } from "@/lib/api/http";
import { fetchMe, toClientUser } from "@/lib/api/me";
import { getOnboardingTraceId, onboardingLog } from "@/lib/onboarding-log";

export function getOnboardingPath(user: AuthSnapshot["user"]): string | null {
  if (!user || user.onboardingCompleted) return null;
  const step = user.onboardingStep ?? 2;
  if (step <= 2) return "/signup/wallet";
  if (step === 3) return "/signup/profile";
  return "/signup/get-started";
}

export function shouldRedirectToOnboarding(
  user: AuthSnapshot["user"],
  pathname: string,
): string | null {
  const onboardingPath = getOnboardingPath(user);
  if (!onboardingPath || pathname.startsWith("/signup/")) return null;
  return onboardingPath;
}

/**
 * api 모드 실제 인증 어댑터 (BE: 구글 OAuth → 자체 JWT 세션)
 *
 * - signIn: BE `/auth/google`로 전체 페이지 리다이렉트. 구글 동의 후 BE가
 *   `FE#accessToken=..&refreshToken=..`로 돌려보내고, 어댑터 초기화가
 *   fragment를 수거해 `/auth/me`로 세션을 복원한다.
 * - 서버 렌더 중에는 항상 "loading" — 브라우저에서만 토큰/네트워크에 접근한다.
 */
export function createApiAuthAdapter(apiUrl: string): AuthAdapter & { http: ApiHttp } {
  const http = createApiHttp(apiUrl);

  let snapshot: AuthSnapshot = { status: "loading", user: null };
  const listeners = new Set<() => void>();
  const setSnapshot = (next: AuthSnapshot): AuthSnapshot => {
    snapshot = next;
    listeners.forEach((listener) => listener());
    return snapshot;
  };

  async function restoreSession(): Promise<AuthSnapshot> {
    onboardingLog("session.restore.started", {
      path: typeof window === "undefined" ? "server" : window.location.pathname,
      hasSession: http.hasSession(),
    });
    const me = await fetchMe(http);
    const restored = setSnapshot(
      me ? { status: "signed-in", user: toClientUser(me) } : { status: "signed-out", user: null },
    );
    onboardingLog("session.restore.completed", {
      status: restored.status,
      userId: restored.user?.id,
      onboardingStep: restored.user?.onboardingStep,
      onboardingCompleted: restored.user?.onboardingCompleted,
    });
    return restored;
  }

  let initialized = false;
  const initialize = () => {
    if (initialized || typeof window === "undefined") return;
    initialized = true;
    onboardingLog("auth.adapter.initialized", {
      path: window.location.pathname,
      hasHash: Boolean(window.location.hash),
    });
    const captured = captureTokensFromLocation();
    onboardingLog("oauth.tokens.captured", { captured });
    void restoreSession().then((restored) => {
      const onboardingPath = shouldRedirectToOnboarding(
        restored.user,
        window.location.pathname,
      );
      onboardingLog("onboarding.redirect.evaluated", {
        currentPath: window.location.pathname,
        targetPath: onboardingPath,
        onboardingStep: restored.user?.onboardingStep,
        onboardingCompleted: restored.user?.onboardingCompleted,
      });
      if (onboardingPath) {
        onboardingLog("onboarding.redirect.started", { targetPath: onboardingPath });
        window.location.replace(onboardingPath);
      }
    });
  };

  return {
    initialize,
    http,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: async () => {
      const traceId = getOnboardingTraceId();
      const params = new URLSearchParams({ returnTo: window.location.origin });
      if (traceId) params.set("trace", traceId);
      onboardingLog("oauth.redirect.started", { returnOrigin: window.location.origin });
      window.location.assign(`${apiUrl.replace(/\/$/, "")}/auth/google?${params}`);
      // 페이지가 구글로 떠나므로 이 Promise는 결과를 낼 필요가 없다
      return new Promise<AuthSnapshot>(() => {});
    },
    signOut: async () => {
      onboardingLog("session.signout.started");
      await http.signOutRemote();
      onboardingLog("session.signout.completed");
      return setSnapshot({ status: "signed-out", user: null });
    },
  };
}
