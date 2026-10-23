/**
 * BE(NinjaLabsBE) HTTP 전송 계층.
 *
 * - 로그인 토큰은 POST /auth/exchange 응답 본문으로만 받는다 (lib/api/oauth.ts).
 *   URL fragment로 토큰을 받는 경로는 없다 — 링크로 세션을 심는 공격면을 만들지 않는다.
 * - access token은 15분 JWT, refresh는 회전(rotation) 방식. 401을 받으면
 *   refresh로 재발급을 1회 시도한다. refresh가 401/403으로 거부될 때만 세션을
 *   비우고, 429·5xx·네트워크 오류 같은 일시 장애에서는 토큰을 그대로 둔 채
 *   `REFRESH_UNAVAILABLE`로 실패시킨다 (BE throttle 버킷이 공유될 때 대량 로그아웃 방지).
 * - 저장소는 localStorage(사용 불가 환경 대비 try/catch). 서버 렌더 중에는
 *   어떤 저장소/네트워크 접근도 하지 않는다.
 * - refresh는 탭 간에도 직렬화한다(Web Locks `ninja.auth.refresh`, 없으면 인스턴스 내
 *   single-flight만). BE가 refresh 토큰을 조건부 UPDATE로 회전시키므로 두 탭이 같은 토큰으로
 *   refresh하면 진 쪽이 401을 받는다: 락 안에서 저장소를 다시 읽어 이미 회전됐으면 네트워크를
 *   건너뛰고, 401이어도 저장된 토큰이 우리가 보낸 것일 때만 세션을 비운다.
 * - `clearTokens()`(로그아웃 포함)는 `sessionEpoch`를 올린다. 진행 중이던 refresh가 끝나도
 *   epoch가 바뀌었으면 새 토큰을 심지 않고 best-effort로 `/auth/logout`에 넘겨 폐기한다.
 */

import { getOnboardingTraceId, onboardingLog } from "@/lib/onboarding-log";

const ACCESS_KEY = "ninja.accessToken";
const REFRESH_KEY = "ninja.refreshToken";
const REFRESH_LOCK = "ninja.auth.refresh";

/** Bumped by every `clearTokens()`; a refresh that resolves after a sign-out must not re-plant tokens. */
let sessionEpoch = 0;

const isBrowser = () => typeof window !== "undefined";

function storageGet(key: string): string | null {
  try {
    return isBrowser() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (!isBrowser()) return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage가 막힌 환경(시크릿 모드 등)에서는 세션이 탭 수명으로 축소될 뿐이다
  }
}

export function getTokens(): { accessToken: string | null; refreshToken: string | null } {
  return { accessToken: storageGet(ACCESS_KEY), refreshToken: storageGet(REFRESH_KEY) };
}

export function setTokens(accessToken: string | null, refreshToken: string | null): void {
  storageSet(ACCESS_KEY, accessToken);
  storageSet(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  sessionEpoch += 1;
  setTokens(null, null);
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
  hasSession: () => boolean;
  signOutRemote: () => Promise<void>;
};

/**
 * refresh 결과. `rejected`(401/403)만 세션을 비운다; `unavailable`은 토큰을 유지한다;
 * `signed-out`은 refresh 도중 로그아웃되어 새 토큰을 버린 경우다.
 */
type RefreshResult =
  | { ok: true }
  | { ok: false; reason: "no-token" | "rejected" | "signed-out" }
  | { ok: false; reason: "unavailable"; status: number };

export function createApiHttp(apiUrl: string): ApiHttp {
  const base = apiUrl.replace(/\/$/, "");
  let refreshing: Promise<RefreshResult> | null = null;

  async function rawFetch(path: string, init?: { method?: string; body?: unknown }) {
    const { accessToken } = getTokens();
    const traceId = getOnboardingTraceId();
    return fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: {
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  async function rawFormFetch(path: string, form: FormData) {
    const { accessToken } = getTokens();
    const traceId = getOnboardingTraceId();
    return fetch(`${base}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
      },
      body: form,
    });
  }

  function postLogout(refreshToken: string): Promise<void> {
    const traceId = getOnboardingTraceId();
    // 서버 세션 폐기는 best-effort. 실패해도 로컬 로그아웃은 완료된 상태
    return fetch(`${base}/auth/logout`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    })
      .then((response) => onboardingLog("session.logout.completed", { status: response.status }))
      .catch(() => onboardingLog("session.logout.failed", { reason: "NETWORK_ERROR" }));
  }

  /** 락 안에서 실행되는 실제 회전. `sentToken`은 401을 받았을 때 저장돼 있던 refresh 토큰이다. */
  async function performRefresh(sentToken: string, epoch: number): Promise<RefreshResult> {
    try {
      // 락을 기다리는 동안 다른 탭이 이미 회전(또는 로그아웃)했을 수 있다: 저장소를 다시 읽는다.
      const stored = getTokens();
      if (!stored.refreshToken) {
        onboardingLog("http.refresh.skipped", { reason: "NO_REFRESH_TOKEN" });
        return { ok: false, reason: "no-token" };
      }
      if (stored.refreshToken !== sentToken) {
        onboardingLog("http.refresh.skipped", { reason: "ROTATED_ELSEWHERE" });
        return { ok: true };
      }
      onboardingLog("http.refresh.requested");
      const traceId = getOnboardingTraceId();
      const res = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...(traceId ? { "x-onboarding-trace-id": traceId } : {}),
        },
        body: JSON.stringify({ refreshToken: sentToken }),
      });
      if (res.status === 401 || res.status === 403) {
        // refresh 토큰이 만료·폐기·회전됨: 세션은 끝났다 — 단, 그 사이 다른 탭이 새 토큰을
        // 저장했다면(락 없는 환경의 경쟁) 그 탭의 세션을 지우면 안 된다.
        onboardingLog("http.refresh.failed", { status: res.status, reason: "REJECTED" });
        if (getTokens().refreshToken === sentToken) clearTokens();
        return { ok: false, reason: "rejected" };
      }
      if (!res.ok) {
        // 429/5xx: BE 쪽 일시 장애. 토큰을 지우면 throttle 한 번에 전원이 로그아웃된다.
        onboardingLog("http.refresh.failed", { status: res.status, reason: "UNAVAILABLE" });
        return { ok: false, reason: "unavailable", status: res.status };
      }
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      if (sessionEpoch !== epoch) {
        // refresh 도중 로그아웃됨: 새 세션을 심지 않고 서버에서도 폐기한다.
        onboardingLog("http.refresh.discarded", { reason: "SIGNED_OUT" });
        void postLogout(body.refreshToken);
        return { ok: false, reason: "signed-out" };
      }
      setTokens(body.accessToken, body.refreshToken);
      onboardingLog("http.refresh.succeeded", { status: res.status });
      return { ok: true };
    } catch {
      onboardingLog("http.refresh.failed", { status: 0, reason: "NETWORK_ERROR" });
      return { ok: false, reason: "unavailable", status: 0 };
    }
  }

  /** refresh 회전: 동시 401은 하나의 refresh만 수행하도록 합쳐진다 (탭 안은 single-flight, 탭 간은 락) */
  function refreshSession(): Promise<RefreshResult> {
    if (refreshing) return refreshing;
    const { refreshToken } = getTokens();
    if (!refreshToken) {
      onboardingLog("http.refresh.skipped", { reason: "NO_REFRESH_TOKEN" });
      return Promise.resolve({ ok: false, reason: "no-token" });
    }
    const epoch = sessionEpoch;
    refreshing = withRefreshLock(() => performRefresh(refreshToken, epoch)).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /**
   * 401 뒤 refresh를 1회 시도하고 재시도 여부를 돌려준다. refresh 자체가 일시 장애면
   * 원 요청의 401 대신 `REFRESH_UNAVAILABLE`(refresh 응답 status)로 던져, 호출부가
   * 세션 만료와 구분할 수 있게 한다.
   */
  async function retryAfterRefresh(): Promise<boolean> {
    const refresh = await refreshSession();
    if (refresh.ok) return true;
    if (refresh.reason === "unavailable") throw new ApiHttpError(refresh.status, "REFRESH_UNAVAILABLE");
    return false;
  }

  return {
    hasSession: () => getTokens().refreshToken !== null,

    fetchJson: async <T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      onboardingLog("http.request.started", { method: init?.method ?? "GET", path });
      let res = await rawFetch(path, init);
      onboardingLog("http.response.received", { path, status: res.status, attempt: 1 });
      if (res.status === 401 && (await retryAfterRefresh())) {
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
      let res = await rawFormFetch(path, form);
      onboardingLog("http.response.received", { path, status: res.status, attempt: 1 });
      if (res.status === 401 && (await retryAfterRefresh())) {
        res = await rawFormFetch(path, form);
        onboardingLog("http.response.received", { path, status: res.status, attempt: 2 });
      }
      if (!res.ok) {
        throw await toApiHttpError(res);
      }
      return (await res.json()) as T;
    },

    signOutRemote: async () => {
      const { refreshToken } = getTokens();
      clearTokens();
      if (!refreshToken) {
        onboardingLog("session.logout.local-only");
        return;
      }
      onboardingLog("session.logout.requested");
      await postLogout(refreshToken);
    },
  };
}
