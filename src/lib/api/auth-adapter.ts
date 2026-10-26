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
import { pushFlash } from "@/lib/flash";
import { getOnboardingPath, HOME_PATH } from "@/lib/auth-route";
import { getOnboardingTraceId, onboardingLog } from "@/lib/onboarding-log";
import { takeReturnPath } from "@/lib/return-path";
import { stripLocale, withLocaleOf } from "@/i18n/routing";

export { getOnboardingPath };

/**
 * Pages an unfinished sign-up may stay on after a session restore: the sign-up steps themselves, and `/account`, the only
 * place to delete the account (`DELETE /users/me` works from onboarding step 2, so someone who only did the Google step
 * must be able to leave without finishing a profile or wallet first).
 */
const ONBOARDING_EXEMPT = /^\/(?:signup\/|account(?:\/|$))/;

export function shouldRedirectToOnboarding(
  user: AuthSnapshot["user"],
  pathname: string,
): string | null {
  const onboardingPath = getOnboardingPath(user);
  if (!onboardingPath || ONBOARDING_EXEMPT.test(stripLocale(pathname))) return null;
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
    setSnapshot({ status: "signed-out", user: null, reason: "session-ended" });
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

  /**
   * Another tab completed a login, so the shared cookie now belongs to whoever signed in there. This tab's in-memory
   * access token (and the user it shows) may be the previous account's: its next refresh would silently turn every
   * request into the new account's while the UI kept naming the old one. Re-read the session now and show it. A failed
   * or inconclusive probe keeps what this tab shows (the next 401 handles an actually dead session).
   */
  async function adoptOtherTabSession(): Promise<void> {
    // While this tab's own initialization is still restoring the session there is nothing stale to correct.
    const initializing = () => snapshot.status === "loading";
    if (initializing()) return;
    const refreshed = await http.initSession();
    if (!refreshed.ok) return;
    const me = await fetchMe(http);
    if (!me || initializing() || !http.hasSession()) return;
    const user = toClientUser(me);
    if (snapshot.status === "signed-in" && snapshot.user.id === user.id) return;
    onboardingLog("session.adopted", { reason: "OTHER_TAB_SIGNED_IN" });
    setSnapshot({ status: "signed-in", user });
  }

  /** After a session restore: send an unfinished onboarding to its step, and a signed-in user off the callback page. */
  function leaveCallbackOrOnboard(restored: AuthSnapshot): void {
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
    // A finished user goes back to the page that asked for the sign-in (`lib/return-path.ts`), else to their home.
    // An unfinished onboarding keeps the remembered path: the last signup step offers it.
    const targetPath = onboardingPath ?? (
      onCallback && restored.status === "signed-in"
        ? withLocaleOf(window.location.pathname, restored.user.onboardingCompleted === true ? takeReturnPath() ?? HOME_PATH : "/")
        : null
    );
    if (targetPath) {
      onboardingLog("onboarding.redirect.started", { targetPath });
      window.location.replace(targetPath);
    }
  }

  /** Re-reads `/auth/me` into the snapshot. A failed or empty read keeps what is shown (the next 401 handles a dead session). */
  async function refresh(): Promise<AuthSnapshot> {
    if (snapshot.status !== "signed-in" || !http.hasSession()) return snapshot;
    const me = await fetchMe(http);
    if (!me || snapshot.status !== "signed-in") return snapshot;
    return setSnapshot({ status: "signed-in", user: toClientUser(me) });
  }

  let bootstrapped = false;
  const initialize = () => {
    if (typeof window === "undefined") return;
    // Another tab signed out (its logout already cleared the shared cookie) or signed in (the cookie may be back).
    const unsubscribe = events.subscribe((event) => {
      if (event === "signed-in") {
        allowSessionRefresh();
        void adoptOtherTabSession().catch(() => {});
        return;
      }
      endLocalSession();
      endSignedInSession();
    });
    // The provider remounts (a locale switch changes the `[locale]` layout, React StrictMode runs effects twice): the
    // teardown drops the listener and channel of an adapter nobody renders any more, which would otherwise keep
    // re-reading the session on every other tab's sign-in. The session bootstrap below still runs once per adapter.
    const teardown = () => {
      unsubscribe();
      events.close();
    };
    if (bootstrapped) return teardown;
    bootstrapped = true;
    onboardingLog("auth.adapter.initialized", {
      path: window.location.pathname,
      hasHash: Boolean(window.location.hash),
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
    })().then(leaveCallbackOrOnboard).catch((error: unknown) => {
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
        // The restored session still has to leave the callback page (it shows a spinner for a signed-in user).
        .then((restored) => {
          leaveCallbackOrOnboard(restored);
          return restored;
        })
        .catch(() => setSnapshot({ status: "signed-out", user: null }));
    });
    return teardown;
  };

  return {
    initialize,
    http,
    refresh,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: async (options) => {
      const traceId = getOnboardingTraceId();
      const codeChallenge = await createLoginChallenge();
      const params = new URLSearchParams({ returnTo: window.location.origin, codeChallenge });
      if (traceId) params.set("trace", traceId);
      // Cloudflare Turnstile 위젯 토큰 (NEXT_PUBLIC_TURNSTILE_SITE_KEY가 있을 때만) — BE가 TURNSTILE_SECRET_KEY로 siteverify한다.
      if (options?.turnstileToken) params.set("turnstileToken", options.turnstileToken);
      onboardingLog("oauth.redirect.started", { returnOrigin: window.location.origin, turnstile: Boolean(options?.turnstileToken) });
      // `new URL` keeps this an absolute cross-origin navigation (BE -> Google), which next/no-location-assign-relative-destination cannot infer from a template literal
      window.location.assign(new URL(`${apiUrl.replace(/\/$/, "")}/auth/google?${params}`));
      // 페이지가 구글로 떠나므로 이 Promise는 결과를 낼 필요가 없다
      return new Promise<AuthSnapshot>(() => {});
    },
    signOut: async () => {
      onboardingLog("session.signout.started");
      // Signed-out is shown only after the BE confirmed the revoke: the 14-day HttpOnly cookie cannot be cleared from
      // JS, so claiming sign-out after a failed call would leave a live session behind a "signed out" header (shared
      // computers). On failure the session stays as it is, the user is told, and can press Sign out again.
      if (!(await http.revokeSession())) {
        onboardingLog("session.signout.failed");
        pushFlash("signOutFailed");
        return snapshot;
      }
      const signedOut = setSnapshot({ status: "signed-out", user: null });
      onboardingLog("session.signout.completed");
      return signedOut;
    },
  };
}
