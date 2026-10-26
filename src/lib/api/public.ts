import { loadRuntimeConfig } from "@/lib/runtime/config";

/** 공개 페이지 SSR이 BE를 기다리는 상한 - BE가 멈춰도 Vercel 함수가 매달리지 않게 한다. */
export const PUBLIC_FETCH_TIMEOUT_MS = 8000;

/** A non-2xx BE answer. `status` lets a detail loader tell "this id does not exist" (404) apart from an outage. */
export class PublicApiError extends Error {
  override readonly name = "PublicApiError";

  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Public API ${status}: ${path}`);
  }
}

/**
 * True only when the BE answered 404. Detail loaders turn this, and nothing else, into `undefined` → `notFound()`;
 * 5xx, network errors and the timeout must rethrow so `[locale]/error.tsx` renders instead of a false 404.
 */
export function isPublicNotFound(caught: unknown): boolean {
  return caught instanceof PublicApiError && caught.status === 404;
}

type PublicFetchOptions = {
  /**
   * Replay a failure other than a 404 to calls for the same path for this long, instead of asking the BE again.
   * See `PUBLIC_DETAIL_FETCH` for why detail loaders need it.
   */
  replayFailureMs?: number;
  /**
   * Let Next's shared Data Cache answer for this many seconds instead of asking the BE on every page view. For LIST
   * endpoints only (the bounty list alone is `ceil(total / 50)` calls per view, and every SSR page shares one egress IP
   * and therefore one per-IP BE bucket). Detail loaders stay uncached so an edited or cancelled item is never stale.
   */
  revalidateSeconds?: number;
};

/** How long a public list page may be served from the Data Cache (see `PublicFetchOptions.revalidateSeconds`). */
export const PUBLIC_LIST_REVALIDATE_SECONDS = 30;

/**
 * Options for the bounty/notice/member detail loaders. When the layout's fetch fails, Next renders an error shell in a
 * second React render (`getErrorRSCPayload` → generateMetadata again). React `cache()` does not span renders, so without
 * the replay an outage costs a second BE call, and a hung BE costs a second full timeout (16s instead of 8s).
 */
export const PUBLIC_DETAIL_FETCH: PublicFetchOptions = { replayFailureMs: 2000 };

const recentFailures = new Map<string, { error: unknown; until: number }>();

function rememberFailure(path: string, error: unknown, ms: number) {
  const now = Date.now();
  for (const [key, entry] of recentFailures) if (entry.until <= now) recentFailures.delete(key);
  recentFailures.set(path, { error, until: now + ms });
}

/**
 * Server-side public API fetcher used by public App Router pages.
 * The abort signal opts this request out of Next's per-request fetch dedupe, so callers that hit the same path from
 * generateMetadata, layout and page wrap their loader in React `cache()` instead.
 */
export async function fetchPublicJson<T>(path: string, options: PublicFetchOptions = {}): Promise<T> {
  const config = loadRuntimeConfig();
  if (config.runtimeMode !== "api" || !config.apiUrl) {
    throw new Error("Public API is unavailable in mock mode.");
  }

  const { replayFailureMs, revalidateSeconds } = options;
  if (replayFailureMs) {
    const recent = recentFailures.get(path);
    if (recent && recent.until > Date.now()) throw recent.error;
  }

  try {
    const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}${path}`, {
      ...(revalidateSeconds ? { next: { revalidate: revalidateSeconds } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(PUBLIC_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new PublicApiError(response.status, path);
    }
    return (await response.json()) as T;
  } catch (caught) {
    if (replayFailureMs && !isPublicNotFound(caught)) rememberFailure(path, caught, replayFailureMs);
    throw caught;
  }
}

type RuntimeSources<T> = {
  /** 로컬 미리보기(mock 모드)용 고정 fixture */
  mock: () => T | Promise<T>;
  /** NinjaLabsBE에서 실제로 가져오는 경로 */
  api: () => Promise<T>;
};

/**
 * 서버 데이터 조회에서 mock/api를 고르는 단일 지점.
 * 각 도메인 모듈은 두 소스만 제공하고, 런타임 모드를 직접 확인하지 않는다.
 */
export async function loadFromRuntime<T>(sources: RuntimeSources<T>): Promise<T> {
  return loadRuntimeConfig().runtimeMode === "mock" ? sources.mock() : sources.api();
}
