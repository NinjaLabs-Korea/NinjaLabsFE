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
import { createSessionPreviewAuthAdapter } from "@/lib/foundation/auth-adapter";
import { createApiApiClient } from "@/lib/api/api-client";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { createMockApiClient } from "@/lib/mocks/api-client";

export type { FoundationConfig } from "@/lib/runtime/config";
import type { FoundationConfig } from "@/lib/runtime/config";

type FoundationContextValue = {
  adapter: AuthAdapter;
  apiClient: ApiClient;
  mode: FoundationConfig["mode"];
};

const FoundationContext = createContext<FoundationContextValue | null>(null);

function createFoundationContextValue(config: FoundationConfig): FoundationContextValue {
  if (config.mode === "mock") {
    return {
      adapter: createSessionPreviewAuthAdapter(config.previewUser),
      apiClient: createMockApiClient(config.mockSeed),
      mode: config.mode,
    };
  }

  // api 모드: BE(NinjaLabsBE)에 실제 연결. 어댑터와 클라이언트가 토큰 저장소를 공유한다.
  const adapter = createApiAuthAdapter(config.apiUrl);
  return {
    adapter,
    apiClient: createApiApiClient(adapter.http),
    mode: config.mode,
  };
}

export function FoundationProvider({
  children,
  config,
}: Readonly<{
  children: ReactNode;
  config: FoundationConfig;
}>) {
  const [value] = useState(() => createFoundationContextValue(config));

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

export function useAuthSnapshot(): AuthSnapshot {
  const { adapter } = useFoundationContext();

  return useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
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
