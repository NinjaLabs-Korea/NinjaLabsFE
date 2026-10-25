/**
 * BE(NinjaLabsBE) HTTP 전송 계층 — cookie 세션 모드.
 *
 * - refresh 토큰은 JS가 절대 만지지 않는다: BE가 `ninja_rt` HttpOnly; Secure; SameSite=Strict; Path=/api/auth
 *   쿠키로 심는다. `/api/auth/*`는 `next.config.ts` rewrite로 BE `/auth/*`에 프록시되므로 브라우저 입장에서는
 *   FE와 같은 출처(first-party) 쿠키다. exchange/refresh/logout만 이 같은 출처 경로로 `credentials: "include"` +
 *   `X-Ninja-Session: cookie`(CSRF 방어용 opt-in 헤더)를 붙여 보낸다. 나머지 API 호출은 지금처럼 BE 출처로
 *   직접 `Authorization: Bearer <accessToken>`을 붙인다.
 * - access token(15분 JWT)은 이 모듈의 메모리에만 있다. localStorage/sessionStorage에 어떤 토큰도 쓰지 않는다.
 *   새로 고침/새 탭은 `initSession()`이 `POST /api/auth/refresh`를 한 번 보내 복원한다(쿠키 있으면 200, 없으면 401).
 * - 401을 받으면 refresh를 1회 시도한다. refresh가 401/403일 때만 세션을 끝내고, 429·5xx·네트워크 오류는
 *   `REFRESH_UNAVAILABLE`로 실패시키고 쿠키(서버 세션)는 그대로 둔다 — 다음 401에서 다시 시도한다.
 * - refresh는 탭 간에도 직렬화한다(Web Locks `ninja.auth.refresh`, 없으면 탭 안 single-flight만). 쿠키 저장소는
 *   탭이 공유하므로 직렬화된 두 번째 탭은 이미 회전된 쿠키를 보내 경쟁 401을 받지 않는다(락이 없을 때의 경쟁은
 *   BE의 30초 reuse grace가 흡수한다). access token은 탭마다 메모리에 있으므로 각 탭은 자기 refresh를 한다.
 * - 로그아웃(`signOutRemote`, `endLocalSession`)은 `sessionEpoch`를 올린다. 진행 중이던 refresh가 끝나도 epoch가
 *   바뀌었으면 새 access token을 버리고, 그 응답이 다시 심은 쿠키는 best-effort `POST /api/auth/logout`으로 폐기한다.
 * - 1회성 마이그레이션: 예전 빌드가 남긴 `localStorage["ninja.refreshToken"]`이 있으면 `initSession()`이 그 값을
 *   refresh 본문에 실어 보내(BE가 쿠키를 심는다) 결과와 무관하게 `ninja.accessToken`/`ninja.refreshToken`을 지운다.
 * - 세션 힌트: `localStorage["ninja.session"] = "1"`은 비밀이 아닌 "이 브라우저에 세션이 있었을 수 있다" 표시다.
 *   교환/refresh 성공 시 쓰고, 로그아웃·refresh 401/403·다른 탭 로그아웃(`endLocalSession`) 시 지운다.
 *   `initSession()`은 힌트가 없으면 refresh를 보내지 않고 바로 signed-out으로 끝낸다(익명 방문마다 401 + BE per-IP
 *   예산 소모 방지). 예외: 레거시 `ninja.refreshToken`이 있으면(마이그레이션) 또는 `/auth/callback`에서는 시도한다.
 *   힌트는 권한 판단에 절대 쓰지 않는다 — refresh를 "시도할지"만 정한다. 서버가 거절하면 힌트도 지운다.
 * - 서버 렌더 중에는 어떤 저장소/네트워크 접근도 하지 않는다.
 */

import { getOnboardingTraceId, onboardingLog } from "@/lib/onboarding-log";
import { stripLocale } from "@/i18n/routing";

/** Same-origin prefix that `next.config.ts` rewrites to `${NINJA_API_BASE_URL}/auth`. */
export const AUTH_PROXY_PATH = "/api/auth";
/** Opt-in header the BE requires on every cookie-mode auth request (a cross-site form or simple request cannot set it). */
export const SESSION_MODE_HEADER = "x-ninja-session";
export const SESSION_MODE_VALUE = "cookie";
/** Keys written by builds before cookie mode; read once for migration and then deleted. */
export const LEGACY_ACCESS_TOKEN_KEY = "ninja.accessToken";
export const LEGACY_REFRESH_TOKEN_KEY = "ninja.refreshToken";
const REFRESH_LOCK = "ninja.auth.refresh";
/** Non-secret "a session may exist" hint (never a token, never used for authorization). */
export const SESSION_HINT_KEY = "ninja.session";

/**
 * What this tab knows about the refresh cookie (it cannot read it). `absent` after a rejected refresh or a sign-out:
 * later 401s do not trigger a refresh (which could otherwise re-plant a cookie racing the logout). `unknown` at start
 * and after another tab signed in.
 */
type CookieState = "unknown" | "present" | "absent";

let accessToken: string | null = null;
let cookieState: CookieState = "unknown";
/** Bumped by every local session end; a refresh that resolves after a sign-out must not re-plant the session. */
let sessionEpoch = 0;

const isBrowser = () => typeof window !== "undefined";

/** Deletes the pre-cookie-mode token keys (also called after a fresh login, which supersedes them). */
export function discardLegacyTokens(): void {
  try {
    if (!isBrowser()) return;
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // storage unavailable: nothing could have been stored either
  }
}

/** BE OAuth returns to `/auth/callback` (the locale proxy makes it `/<locale>/auth/callback`, fragment kept). */
export function isAuthCallbackPath(pathname: string): boolean {
  return stripLocale(pathname) === "/auth/callback";
}

function writeSessionHint(present: boolean): void {
  try {
    if (!isBrowser()) return;
    if (present) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage unavailable: the next page load simply skips (or keeps) the refresh attempt
  }
}

/** True when this browser may hold a refresh cookie. Only decides whether to try a refresh; never trusted. */
export function hasSessionHint(): boolean {
  try {
    return isBrowser() && window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function readLegacyRefreshToken(): string | null {
  try {
    return isBrowser() ? window.localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** A login exchange succeeded: the access token stays in memory, the BE already set the refresh cookie. */
export function installSession(token: string): void {
  accessToken = token;
  cookieState = "present";
  writeSessionHint(true);
}

/** This tab's session is over (local sign-out, or another tab signed out). Does not call the BE. */
export function endLocalSession(): void {
  sessionEpoch += 1;
  accessToken = null;
  cookieState = "absent";
  writeSessionHint(false);
}

/** Another tab signed in: the shared cookie jar may hold a session again, so the next 401 may refresh. */
export function allowSessionRefresh(): void {
  if (cookieState === "absent") cookieState = "unknown";
}

/** Back to the page-load state (tests only; a real page load starts here). */
export function resetSessionState(): void {
  sessionEpoch += 1;
  accessToken = null;
  cookieState = "unknown";
}

/**
 * Upper bound for one cookie-mode auth request (exchange / refresh / logout). The refresh runs under a cross-tab Web
 * Lock: without a bound, one request stuck on a hung BE would hold the lock and freeze every tab's session restore and
 * every 401 retry. A timeout surfaces like any network failure (`unavailable`: the cookie stays, the next 401 retries).
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Upper bound for one authenticated BE call. Without it a BE that accepted the connection and never answers leaves the
 * session restore (`GET /auth/me`) pending forever - the header stays on "loading" and every guarded view never
 * resolves. A timeout surfaces as a network failure (`unavailableReason` -> `network-error`, views offer a retry).
 * Uploads (`fetchForm`, up to 5 MiB on a slow link) get a longer bound.
 */
export const API_REQUEST_TIMEOUT_MS = 30_000;
export const API_UPLOAD_TIMEOUT_MS = 120_000;

/** Headers + credentials for a same-origin cookie-mode auth request. */
export function cookieAuthInit(body: unknown): RequestInit {
  const traceId = getOnboardingTraceId();
  return {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      [SESSION_MODE_HEADER]: SESSION_MODE_VALUE,
      ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
    },
    body: JSON.stringify(body),
  };
}

/** Runs `task` under the cross-tab refresh lock when the Web Locks API exists; otherwise inline. */
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = isBrowser() ? window.navigator.locks : undefined;
  if (!locks) return task();
  let started = false;
  try {
    return await locks.request(REFRESH_LOCK, async () => {
      started = true;
      return task();
    });
  } catch (error) {
    // The lock itself was unusable (e.g. inactive document): fall back to the in-memory single-flight.
    if (started) throw error;
    return task();
  }
}

/**
 * 401 codes that say nothing about the session: the wallet/agent signature check answers `INVALID_SIGNATURE` as a 401
 * even though the access token was fine. Refreshing and replaying those would rotate the refresh token for nothing and
 * let a throttled refresh (`REFRESH_UNAVAILABLE`) replace the real answer. Every other 401 is the BE's session guard
 * (`MISSING_BEARER_TOKEN` / `INVALID_ACCESS_TOKEN`) or an unreadable body, and still refreshes.
 */
const NON_SESSION_401_CODES: readonly string[] = ["INVALID_SIGNATURE"];

async function isSessionExpiry(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const body = (await res.clone().json().catch(() => null)) as { message?: unknown } | null;
  return !(typeof body?.message === "string" && NON_SESSION_401_CODES.includes(body.message));
}

export class ApiHttpError extends Error {
  /**
   * @param details Nest ValidationPipe의 `message[]` 원문 (`code === "VALIDATION_FAILED"`일 때만 비어 있지 않다).
   *   `lib/api/validation.ts validationFieldsFromMessages`가 속성 이름을 뽑아 필드 힌트로 바꾼다. 화면에 원문을 그대로 쓰지 말 것.
   */
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: readonly string[] = [],
  ) {
    super(`API ${status}: ${code}`);
    this.name = "ApiHttpError";
  }
}

/** Nest ValidationPipe sends `message` as a string[]; collapse it so `code` is always a string and keep the array as `details`. */
export async function toApiHttpError(res: Response): Promise<ApiHttpError> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  const message = body?.message;
  if (Array.isArray(message)) {
    return new ApiHttpError(res.status, "VALIDATION_FAILED", message.filter((item): item is string => typeof item === "string"));
  }
  return new ApiHttpError(res.status, typeof message === "string" && message ? message : "UNKNOWN_ERROR");
}

export type ApiHttp = {
  /** 인증 헤더를 붙여 요청. 401이면 refresh 회전 후 1회 재시도. */
  fetchJson: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  fetchForm: <T>(path: string, form: FormData) => Promise<T>;
  /** True while this tab holds an access token (after a login exchange or a successful refresh). */
  hasSession: () => boolean;
  /** Page-load restore: legacy migration if needed, then one `POST /api/auth/refresh` (skipped without the session hint). */
  initSession: () => Promise<RefreshResult>;
  signOutRemote: () => Promise<void>;
};

/**
 * refresh 결과. `rejected`(401/403)만 세션을 끝낸다; `unavailable`은 쿠키를 유지하고 다음 401에서 재시도한다;
 * `signed-out`은 refresh 도중 로그아웃되어 새 토큰을 버린 경우; `no-session`은 이 탭이 이미 세션 종료를 안 경우다.
 */
export type RefreshResult =
  | { ok: true }
  | { ok: false; reason: "no-session" | "rejected" | "signed-out" }
  | { ok: false; reason: "unavailable"; status: number };

export type ApiHttpOptions = {
  /** A request's refresh failed and this tab holds no access token: this tab's session is over. */
  onSessionEnded?: () => void;
  /** Cross-tab notification hook (`lib/api/auth-events.ts`): sign-out and rejected refresh post `signed-out`. */
  broadcast?: (event: "signed-out" | "signed-in") => void;
};

export function createApiHttp(apiUrl: string, options: ApiHttpOptions = {}): ApiHttp {
  const base = apiUrl.replace(/\/$/, "");
  let refreshing: Promise<RefreshResult> | null = null;

  async function rawFetch(path: string, init?: { method?: string; body?: unknown }) {
    const token = accessToken;
    const traceId = getOnboardingTraceId();
    return fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: {
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  }

  async function rawFormFetch(path: string, form: FormData) {
    const token = accessToken;
    const traceId = getOnboardingTraceId();
    return fetch(`${base}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
      },
      body: form,
      signal: AbortSignal.timeout(API_UPLOAD_TIMEOUT_MS),
    });
  }

  function postLogout(): Promise<void> {
    // 서버 세션 폐기는 best-effort. 실패해도 로컬 로그아웃은 완료된 상태. 쿠키는 BE가 지운다(Set-Cookie 만료).
    return fetch(`${AUTH_PROXY_PATH}/logout`, cookieAuthInit({}))
      .then((response) => onboardingLog("session.logout.completed", { status: response.status }))
      .catch(() => onboardingLog("session.logout.failed", { reason: "NETWORK_ERROR" }));
  }

  /** 락 안에서 실행되는 실제 회전. `migrate`면 락 안에서 레거시 refresh 토큰을 다시 읽는다(다른 탭이 이미 옮겼을 수 있다). */
  async function performRefresh(epoch: number, migrate: boolean): Promise<RefreshResult> {
    const legacyToken = migrate ? readLegacyRefreshToken() : null;
    try {
      onboardingLog("http.refresh.requested", { migrate: legacyToken !== null });
      const res = await fetch(`${AUTH_PROXY_PATH}/refresh`, cookieAuthInit(legacyToken ? { refreshToken: legacyToken } : {}));
      if (res.status === 401 || res.status === 403) {
        // refresh 쿠키가 없음·만료·폐기됨: 이 탭의 세션은 끝났다.
        onboardingLog("http.refresh.failed", { status: res.status, reason: "REJECTED" });
        writeSessionHint(false);
        if (sessionEpoch === epoch) {
          const hadSession = accessToken !== null || cookieState === "present";
          endLocalSession();
          // A page-load probe without a cookie is not news for the other tabs; a session that just died is.
          if (hadSession) options.broadcast?.("signed-out");
        }
        return { ok: false, reason: "rejected" };
      }
      if (!res.ok) {
        // 429/5xx: BE 쪽 일시 장애. 세션을 끝내면 throttle 한 번에 전원이 로그아웃된다.
        onboardingLog("http.refresh.failed", { status: res.status, reason: "UNAVAILABLE" });
        return { ok: false, reason: "unavailable", status: res.status };
      }
      const body: unknown = await res.json();
      const token = body && typeof body === "object" && "accessToken" in body && typeof body.accessToken === "string"
        ? body.accessToken
        : "";
      if (!token) {
        onboardingLog("http.refresh.failed", { status: res.status, reason: "INVALID_RESPONSE" });
        return { ok: false, reason: "unavailable", status: res.status };
      }
      if (sessionEpoch !== epoch) {
        // refresh 도중 로그아웃됨: 새 access token을 버리고, 이 응답이 다시 심은 쿠키도 서버에서 폐기한다.
        onboardingLog("http.refresh.discarded", { reason: "SIGNED_OUT" });
        void postLogout();
        return { ok: false, reason: "signed-out" };
      }
      accessToken = token;
      cookieState = "present";
      writeSessionHint(true);
      onboardingLog("http.refresh.succeeded", { status: res.status });
      return { ok: true };
    } catch {
      onboardingLog("http.refresh.failed", { status: 0, reason: "NETWORK_ERROR" });
      return { ok: false, reason: "unavailable", status: 0 };
    } finally {
      // 마이그레이션은 1회성: 결과와 무관하게 레거시 토큰을 지운다(실패하면 사용자는 다시 로그인한다).
      if (migrate) discardLegacyTokens();
    }
  }

  /** refresh 회전: 동시 401은 하나의 refresh만 수행하도록 합쳐진다 (탭 안은 single-flight, 탭 간은 락) */
  function refreshSession(migrate = false): Promise<RefreshResult> {
    if (refreshing) return refreshing;
    if (cookieState === "absent") {
      onboardingLog("http.refresh.skipped", { reason: "NO_SESSION" });
      return Promise.resolve({ ok: false, reason: "no-session" });
    }
    const epoch = sessionEpoch;
    refreshing = withRefreshLock(() => performRefresh(epoch, migrate)).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /**
   * 401 뒤 refresh를 1회 시도하고 재시도 여부를 돌려준다. refresh 자체가 일시 장애면
   * 원 요청의 401 대신 `REFRESH_UNAVAILABLE`(refresh 응답 status)로 던져, 호출부가
   * 세션 만료와 구분할 수 있게 한다.
   */
  async function retryAfterRefresh(sentToken: string | null): Promise<boolean> {
    // A sibling request already refreshed while this one was in flight: its 401 only says the token it carried is
    // stale. Replay with the newer token instead of rotating the refresh cookie (and spending its 10/min budget) again.
    if (accessToken !== null && accessToken !== sentToken) return true;
    const refresh = await refreshSession();
    if (refresh.ok) return true;
    if (refresh.reason === "unavailable") throw new ApiHttpError(refresh.status, "REFRESH_UNAVAILABLE");
    if (accessToken === null) options.onSessionEnded?.();
    return false;
  }

  return {
    hasSession: () => accessToken !== null,

    initSession: () => {
      if (readLegacyRefreshToken() === null) {
        // A stray legacy access token alone is useless (and a secret at rest): drop it without a migration call.
        discardLegacyTokens();
        if (!hasSessionHint() && !(isBrowser() && isAuthCallbackPath(window.location.pathname))) {
          // No hint: this browser never completed a sign-in (or signed out). Do not probe the cookie.
          onboardingLog("http.refresh.skipped", { reason: "NO_SESSION_HINT" });
          if (!refreshing) cookieState = "absent";
          return Promise.resolve({ ok: false, reason: "no-session" });
        }
        return refreshSession(false);
      }
      return refreshSession(true);
    },

    fetchJson: async <T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      onboardingLog("http.request.started", { method: init?.method ?? "GET", path });
      const sentToken = accessToken;
      let res = await rawFetch(path, init);
      onboardingLog("http.response.received", { path, status: res.status, attempt: 1 });
      if ((await isSessionExpiry(res)) && (await retryAfterRefresh(sentToken))) {
        res = await rawFetch(path, init);
        onboardingLog("http.response.received", { path, status: res.status, attempt: 2 });
      }
      if (!res.ok) {
        throw await toApiHttpError(res);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },

    fetchForm: async <T>(path: string, form: FormData): Promise<T> => {
      onboardingLog("http.request.started", { method: "POST", path });
      const sentToken = accessToken;
      let res = await rawFormFetch(path, form);
      onboardingLog("http.response.received", { path, status: res.status, attempt: 1 });
      if ((await isSessionExpiry(res)) && (await retryAfterRefresh(sentToken))) {
        res = await rawFormFetch(path, form);
        onboardingLog("http.response.received", { path, status: res.status, attempt: 2 });
      }
      if (!res.ok) {
        throw await toApiHttpError(res);
      }
      return (await res.json()) as T;
    },

    signOutRemote: async () => {
      endLocalSession();
      options.broadcast?.("signed-out");
      onboardingLog("session.logout.requested");
      // Always sent: this tab cannot see whether the HttpOnly cookie exists.
      await postLogout();
    },
  };
}
