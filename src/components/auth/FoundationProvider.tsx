"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  AccountApi,
  AdminApi,
  AgentApi,
  ApiClient,
  BountyApi,
  OnboardingApi,
  WalletApi,
} from "@/lib/contracts/api";
import type { AuthAdapter, AuthSnapshot } from "@/lib/contracts/auth";
import { createApiApiClient } from "@/lib/api/api-client";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";

export type { FoundationConfig } from "@/lib/runtime/config";
import type { FoundationConfig } from "@/lib/runtime/config";

type FoundationContextValue = {
  adapter: AuthAdapter;
  apiClient: ApiClient;
  mode: FoundationConfig["mode"];
};

const FoundationContext = createContext<FoundationContextValue | null>(null);

type MockFoundationConfig = Extract<FoundationConfig, { mode: "mock" }>;

// api 모드: BE(NinjaLabsBE)에 실제 연결. 어댑터와 클라이언트가 토큰 저장소를 공유한다.
function createApiFoundation(apiUrl: string): FoundationContextValue {
  const adapter = createApiAuthAdapter(apiUrl);
  return { adapter, apiClient: createApiApiClient(adapter.http), mode: "api" };
}

// mock 모드: 세션 미리보기 어댑터와 fixture 기반 클라이언트는 이 분기에서만 동적으로 불러온다.
// 정적으로 import하면 fixture(preview 사용자, 가짜 API 키)가 모든 페이지의 클라이언트 번들에 실린다.
async function loadMockFoundation(config: MockFoundationConfig): Promise<FoundationContextValue> {
  const [{ createSessionPreviewAuthAdapter }, { createMockApiClient }] = await Promise.all([
    import("@/lib/foundation/auth-adapter"),
    import("@/lib/mocks/api-client"),
  ]);
  return {
    adapter: createSessionPreviewAuthAdapter(config.previewUser),
    apiClient: createMockApiClient(config.mockSeed),
    mode: "mock",
  };
}

const pendingSnapshot: AuthSnapshot = { status: "loading", user: null };
const noopUnsubscribe = () => {};

/**
 * Stand-in until the mock modules arrive: the snapshot stays `loading`, sign-in/out and every API call wait for the
 * real implementation. Methods are memoized so hooks keyed on `apiClient.getX` identity do not re-run every render.
 */
function createPendingFoundation(ready: Promise<FoundationContextValue>): FoundationContextValue {
  const methods = new Map<PropertyKey, (...args: unknown[]) => Promise<unknown>>();
  const apiClient = new Proxy({} as ApiClient, {
    get: (_target, property) => {
      let method = methods.get(property);
      if (!method) {
        method = async (...args: unknown[]) => {
          const { apiClient: client } = await ready;
          const implementation = client[property as keyof ApiClient] as (...a: unknown[]) => unknown;
          return implementation(...args);
        };
        methods.set(property, method);
      }
      return method;
    },
  });
  return {
    adapter: {
      getSnapshot: () => pendingSnapshot,
      subscribe: () => noopUnsubscribe,
      signIn: async () => (await ready).adapter.signIn(),
      signOut: async () => (await ready).adapter.signOut(),
    },
    apiClient,
    mode: "mock",
  };
}

type FoundationState = { value: FoundationContextValue; ready: Promise<FoundationContextValue> | null };

function createInitialState(config: FoundationConfig): FoundationState {
  if (config.mode === "api") return { value: createApiFoundation(config.apiUrl), ready: null };
  const ready = loadMockFoundation(config);
  return { value: createPendingFoundation(ready), ready };
}

export function FoundationProvider({
  children,
  config,
}: Readonly<{
  children: ReactNode;
  config: FoundationConfig;
}>) {
  const [state, setState] = useState(() => createInitialState(config));
  const { value, ready } = state;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    ready.then(
      (loaded) => {
        if (active) setState({ value: loaded, ready: null });
      },
      (error: unknown) => {
        // A failed chunk load keeps the pending foundation (snapshot stays `loading`); callers awaiting it see the error.
        console.error("FoundationProvider: failed to load the mock foundation.", error);
      },
    );
    return () => {
      active = false;
    };
  }, [ready]);

  useEffect(() => {
    value.adapter.initialize?.();
  }, [value]);

  return <FoundationContext.Provider value={value}>{children}</FoundationContext.Provider>;
}

function useFoundationContext(): FoundationContextValue {
  const context = useContext(FoundationContext);

  if (!context) {
    throw new Error("Auth hooks must be used within FoundationProvider.");
  }

  return context;
}

// The server always renders auth as `loading` (no tokens there). Hydration must see that same value: a Suspense
// boundary that hydrates after the provider's effect has already restored the session (streamed page bodies do)
// would otherwise read `signed-out`/`signed-in` and mismatch the server HTML (React #418).
const getServerAuthSnapshot = (): AuthSnapshot => pendingSnapshot;

export function useAuthSnapshot(): AuthSnapshot {
  const { adapter } = useFoundationContext();

  return useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, getServerAuthSnapshot);
}

export function useAuthActions(): Pick<AuthAdapter, "signIn" | "signOut"> {
  const { adapter } = useFoundationContext();

  return { signIn: adapter.signIn, signOut: adapter.signOut };
}

// 컴포넌트는 필요한 API 조각만 받는다. 구현체(mock/api)는 FoundationProvider가 고른다.
export const useAccountApi = (): AccountApi => useFoundationContext().apiClient;
export const useBountyApi = (): BountyApi => useFoundationContext().apiClient;
export const useAgentApi = (): AgentApi => useFoundationContext().apiClient;
export const useWalletApi = (): WalletApi => useFoundationContext().apiClient;
export const useOnboardingApi = (): OnboardingApi => useFoundationContext().apiClient;
export const useAdminApi = (): AdminApi => useFoundationContext().apiClient;

export function useFoundationMode(): FoundationConfig["mode"] {
  return useFoundationContext().mode;
}
