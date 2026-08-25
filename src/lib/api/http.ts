/**
 * BE(NinjaLabsBE) HTTP 전송 계층.
 *
 * - 토큰 수명주기: 구글 로그인 후 BE가 `FE#accessToken=..&refreshToken=..`로
 *   리다이렉트한다. fragment는 서버로 전송되지 않으므로 로그에 남지 않는다.
 * - access token은 15분 JWT, refresh는 회전(rotation) 방식 — 401을 받으면
 *   refresh로 재발급을 1회 시도하고, 실패하면 세션을 비운다.
 * - 저장소는 localStorage(사용 불가 환경 대비 try/catch). 서버 렌더 중에는
 *   어떤 저장소/네트워크 접근도 하지 않는다.
 */

const ACCESS_KEY = "ninja.accessToken";
const REFRESH_KEY = "ninja.refreshToken";

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
  setTokens(null, null);
}

/**
 * OAuth 콜백 fragment(#accessToken=..&refreshToken=..)를 1회 수거하고
 * 주소창에서 지운다. 토큰이 있었으면 true.
 */
export function captureTokensFromLocation(): boolean {
  if (!isBrowser() || !window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");
  if (!accessToken || !refreshToken) return false;
  setTokens(accessToken, refreshToken);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API ${status}: ${code}`);
    this.name = "ApiHttpError";
  }
}

export type ApiHttp = {
  /** 인증 헤더를 붙여 요청. 401이면 refresh 회전 후 1회 재시도. */
  fetchJson: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  hasSession: () => boolean;
  signOutRemote: () => Promise<void>;
};

export function createApiHttp(apiUrl: string): ApiHttp {
  const base = apiUrl.replace(/\/$/, "");
  let refreshing: Promise<boolean> | null = null;

  async function rawFetch(path: string, init?: { method?: string; body?: unknown }) {
    const { accessToken } = getTokens();
    return fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        ...(init?.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  /** refresh 회전 — 동시 401은 하나의 refresh만 수행하도록 합쳐진다 */
  function refreshSession(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const { refreshToken } = getTokens();
        if (!refreshToken) return false;
        const res = await fetch(`${base}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          clearTokens();
          return false;
        }
        const body = (await res.json()) as { accessToken: string; refreshToken: string };
        setTokens(body.accessToken, body.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  return {
    hasSession: () => getTokens().refreshToken !== null,

    fetchJson: async <T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      let res = await rawFetch(path, init);
      if (res.status === 401 && (await refreshSession())) {
        res = await rawFetch(path, init);
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new ApiHttpError(res.status, body?.message ?? "UNKNOWN_ERROR");
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },

    signOutRemote: async () => {
      const { refreshToken } = getTokens();
      clearTokens();
      if (!refreshToken) return;
      // 서버 세션 폐기는 best-effort — 실패해도 로컬 로그아웃은 완료된 상태
      await fetch(`${base}/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    },
  };
}
