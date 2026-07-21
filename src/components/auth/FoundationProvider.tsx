"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthAdapter, AuthSnapshot } from "@/lib/contracts/auth";
import {
  createSessionPreviewAuthAdapter,
  createUnavailableAuthAdapter,
} from "@/lib/foundation/auth-adapter";
import { createUnavailableApiClient } from "@/lib/foundation/api-client";
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
  return {
    adapter:
      config.mode === "mock"
        ? createSessionPreviewAuthAdapter(config.previewUser)
        : createUnavailableAuthAdapter(),
    apiClient: config.mode === "mock" ? createMockApiClient(config.mockSeed) : createUnavailableApiClient(),
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

export function useFoundationApiClient(): ApiClient {
  return useFoundationContext().apiClient;
}

export function useFoundationMode(): FoundationConfig["mode"] {
  return useFoundationContext().mode;
}
