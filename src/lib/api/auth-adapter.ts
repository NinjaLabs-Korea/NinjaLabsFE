import type { AuthAdapter, AuthSnapshot } from "@/lib/contracts/auth";
import { createAuthEventBus } from "@/lib/api/auth-events";
import {
  allowSessionRefresh,
  createApiHttp,
  discardLegacyTokens,
  endLocalSession,
  type ApiHttp,
} from "@/lib/api/http";
import {
  createLoginChallenge,
  discardLoginVerifier,
  exchangeLoginCodeFromLocation,
  isAuthCallbackPath,
  LoginExchangeError,
} from "@/lib/api/oauth";
import { fetchMe, toClientUser } from "@/lib/api/me";
import { getOnboardingTraceId, onboardingLog } from "@/lib/onboarding-log";
import { stripLocale, withLocaleOf } from "@/i18n/routing";

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
  if (!onboardingPath || stripLocale(pathname).startsWith("/signup/")) return null;
  return withLocaleOf(pathname, onboardingPath);
}

/**
 * api 모드 실제 인증 어댑터 (BE: 구글 OAuth → 자체 JWT 세션)
 *
 * - signIn: BE `/auth/google`로 전체 페이지 리다이렉트. 구글 동의 후 BE가
 *   `/auth/callback#loginCode=..`로 돌려보낸다. 코드를 지운 뒤 브라우저의
 *   verifier와 같은 출처 POST /api/auth/exchange로 교환하고(BE가 HttpOnly refresh 쿠키를 심는다)
 *   `/auth/me`로 세션을 복원한다.
 * - 그 외 페이지 로드는 `http.initSession()`이 POST /api/auth/refresh를 한 번 보내 쿠키로 세션을 복원한다
 *   (401 → signed-out, 429/5xx → signed-out으로 보이되 쿠키는 남고 다음 401에서 재시도).
 * - 탭 간 로그아웃은 `BroadcastChannel("ninja-auth")`(`lib/api/auth-events.ts`)로 전달된다.
 * - 서버 렌더 중에는 항상 "loading". 브라우저에서만 토큰/네트워크에 접근한다.
 */
export function createApiAuthAdapter(apiUrl: string): AuthAdapter & { http: ApiHttp } {
  let snapshot: AuthSnapshot = { status: "loading", user: null };
  const listeners = new Set<() => void>();
  const setSnapshot = (next: AuthSnapshot): AuthSnapshot => {
    snapshot = next;
    listeners.forEach((listener) => listener());
    return snapshot;
  };
  /** The session is gone (refresh rejected here, or another tab signed out): stop showing a signed-in UI now. */
  const endSignedInSession = () => {
    if (snapshot.status !== "signed-in") return;
    onboardingLog("session.ended", { reason: "SESSION_CLEARED" });
    setSnapshot({ status: "signed-out", user: null });
  };

  const events = createAuthEventBus();
  const http = createApiHttp(apiUrl, { onSessionEnded: endSignedInSession, broadcast: events.broadcast });

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
    // Another tab signed out (its logout already cleared the shared cookie) or signed in (the cookie may be back).
    events.subscribe((event) => {
      if (event === "signed-in") {
        allowSessionRefresh();
        return;
      }
      endLocalSession();
      endSignedInSession();
    });
    // Any page load other than the OAuth callback means the sign-in that stored a PKCE verifier was abandoned.
    if (!isAuthCallbackPath(window.location.pathname)) discardLoginVerifier();
    void (async () => {
      if (await exchangeLoginCodeFromLocation()) {
        // A fresh login supersedes any token a pre-cookie build left behind.
        discardLegacyTokens();
        events.broadcast("signed-in");
      } else {
        await http.initSession();
      }
      return restoreSession();
    })().then((restored) => {
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
      // 콜백은 로케일 경로(/en/auth/callback)로 들어오므로 로케일을 떼고 비교하고, 같은 로케일의 홈으로 보낸다.
      const onCallback = isAuthCallbackPath(window.location.pathname);
      const targetPath = onboardingPath ?? (
        onCallback && restored.status === "signed-in" ? withLocaleOf(window.location.pathname, "/") : null
      );
      if (targetPath) {
        onboardingLog("onboarding.redirect.started", { targetPath });
        window.location.replace(targetPath);
      }
    }).catch((error: unknown) => {
      // 교환을 실제로 시도했다가 실패한 경우에만 기존 세션을 끝낸다(쿠키도 폐기). `#error=`나 verifier 없는
      // `#loginCode=`(링크로 심을 수 있는 값)로는 로그인 중이던 세션을 잃지 않고 쿠키로 그대로 복원한다.
      const attempted = error instanceof LoginExchangeError && error.attempted;
      onboardingLog("oauth.exchange.failed", { attempted });
      if (attempted) {
        const signedOut = http.signOutRemote();
        const snapshotAfter = setSnapshot({ status: "signed-out", user: null });
        return signedOut.then(() => snapshotAfter);
      }
      return http.initSession()
        .then(() => restoreSession())
        .catch(() => setSnapshot({ status: "signed-out", user: null }));
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
      const codeChallenge = await createLoginChallenge();
      const params = new URLSearchParams({ returnTo: window.location.origin, codeChallenge });
      if (traceId) params.set("trace", traceId);
      onboardingLog("oauth.redirect.started", { returnOrigin: window.location.origin });
      // `new URL` keeps this an absolute cross-origin navigation (BE -> Google), which next/no-location-assign-relative-destination cannot infer from a template literal
      window.location.assign(new URL(`${apiUrl.replace(/\/$/, "")}/auth/google?${params}`));
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
