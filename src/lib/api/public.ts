import { loadRuntimeConfig } from "@/lib/runtime/config";

/** Server-side public API fetcher used by public App Router pages. */
export async function fetchPublicJson<T>(path: string): Promise<T> {
  const config = loadRuntimeConfig();
  if (config.runtimeMode !== "api" || !config.apiUrl) {
    throw new Error("Public API is unavailable in mock mode.");
  }

  const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Public API ${response.status}: ${path}`);
  }
  return response.json() as Promise<T>;
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
