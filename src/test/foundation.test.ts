import { describe, expect, it } from "vitest";
import { createSessionPreviewAuthAdapter } from "@/lib/foundation/auth-adapter";
import { createUnavailableApiClient } from "@/lib/foundation/api-client";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { getMockFixtureSnapshot, mockFixtureSeed } from "@/lib/mocks/fixtures";
import {
  composeFoundationRuntime,
  readRuntimeConfig,
  RuntimeConfigError,
  toPublicRuntimeConfig,
} from "@/lib/runtime/config";

const validMockEnvironment = {
  NINJA_DEPLOYMENT_TIER: "test",
  NINJA_RUNTIME_MODE: "mock",
  NINJA_MOCK_SEED: "default",
  NINJA_APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1439",
};

describe("runtime configuration", () => {
  it("validates allowed deployment tier and runtime mode combinations", () => {
    expect(readRuntimeConfig(validMockEnvironment).runtimeMode).toBe("mock");
    expect(() =>
      readRuntimeConfig({ ...validMockEnvironment, NINJA_DEPLOYMENT_TIER: "staging" }),
    ).toThrow(new RuntimeConfigError("mock mode is allowed only for local and test tiers."));
    expect(() =>
      readRuntimeConfig({
        ...validMockEnvironment,
        NINJA_DEPLOYMENT_TIER: "local",
        NINJA_RUNTIME_MODE: "api",
      }),
    ).toThrow(new RuntimeConfigError("api mode is allowed only for test, staging, and production tiers."));
    expect(() =>
      readRuntimeConfig({ ...validMockEnvironment, NINJA_RUNTIME_MODE: "preview" }),
    ).toThrow(new RuntimeConfigError("NINJA_RUNTIME_MODE must be one of: mock, api."));
  });

  it("requires a supported wallet chain ID for every configured runtime tuple and validates RPC URLs", () => {
    expect(readRuntimeConfig(validMockEnvironment).wallet).toEqual({ chainId: 1439 });
    expect(
      readRuntimeConfig({
        ...validMockEnvironment,
        NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1776",
        NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: "https://rpc.ninjalabs.example",
      }).wallet,
    ).toEqual({ chainId: 1776, rpcUrl: "https://rpc.ninjalabs.example/" });
    expect(() =>
      readRuntimeConfig({ ...validMockEnvironment, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "injective-1439" }),
    ).toThrow(new RuntimeConfigError("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID must be a supported numeric chain ID."));
    expect(() =>
      readRuntimeConfig({ ...validMockEnvironment, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1" }),
    ).toThrow(new RuntimeConfigError("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID must be one of: 1439, 1776."));
    expect(() =>
      readRuntimeConfig({
        ...validMockEnvironment,
        NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: "mailto:wallet@ninjalabs.example",
      }),
    ).toThrow(
      new RuntimeConfigError(
        "NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL must be an absolute HTTP(S) URL without credentials.",
      ),
    );
  });

  it("fails closed when the required runtime tuple is empty or partial", () => {
    expect(() => readRuntimeConfig({})).toThrow(
      new RuntimeConfigError("NINJA_DEPLOYMENT_TIER is required."),
    );
    expect(() => readRuntimeConfig({ NINJA_RUNTIME_MODE: "mock" })).toThrow(
      new RuntimeConfigError("NINJA_DEPLOYMENT_TIER is required."),
    );
    expect(
      readRuntimeConfig({
        NINJA_DEPLOYMENT_TIER: "test",
        NINJA_RUNTIME_MODE: "mock",
        NINJA_MOCK_SEED: "default",
        NINJA_APP_ORIGIN: "http://localhost:3000",
      }).wallet,
    ).toBeNull();
    expect(() =>
      readRuntimeConfig({
        ...validMockEnvironment,
        NINJA_APP_ORIGIN: "https://test.ninjalabs.example/path",
      }),
    ).toThrow(
      new RuntimeConfigError(
        "NINJA_APP_ORIGIN must be an origin without a path, query, or hash.",
      ),
    );
  });

  it("composes root foundation mode and wallet props from the canonical configuration", () => {
    expect(
      composeFoundationRuntime(mockFixtureSeed.account.user, readRuntimeConfig(validMockEnvironment)),
    ).toEqual({
      foundationConfig: { mode: "mock", previewUser: mockFixtureSeed.account.user, mockSeed: "default" },
      wallet: { chainId: 1439 },
    });
  });

  it("allows explicit API tuples and never exposes their API URL publicly", () => {
    const apiConfig = readRuntimeConfig({
      NINJA_DEPLOYMENT_TIER: "test",
      NINJA_RUNTIME_MODE: "api",
      NINJA_APP_ORIGIN: "https://test.ninjalabs.example",
      NINJA_API_BASE_URL: "https://api.ninjalabs.example/v1",
      NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1439",
    });

    expect(apiConfig).toMatchObject({
      runtimeMode: "api",
      apiAvailable: true,
      apiUrl: "https://api.ninjalabs.example/v1",
    });
    expect(toPublicRuntimeConfig(apiConfig)).not.toHaveProperty("apiUrl");
    expect(toPublicRuntimeConfig(apiConfig)).not.toHaveProperty("mockSeed");
    expect(() =>
      readRuntimeConfig({
        NINJA_DEPLOYMENT_TIER: "test",
        NINJA_RUNTIME_MODE: "api",
        NINJA_APP_ORIGIN: "https://test.ninjalabs.example",
        NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1439",
      }),
    ).toThrow(new RuntimeConfigError("NINJA_API_BASE_URL is required in api mode."));
    expect(() =>
      readRuntimeConfig({
        ...validMockEnvironment,
        NINJA_API_BASE_URL: "https://api.ninjalabs.example/v1",
      }),
    ).toThrow(new RuntimeConfigError("NINJA_API_BASE_URL is allowed only in api mode."));
  });
});

describe("mock data isolation", () => {
  it("returns isolated immutable fixture snapshots", () => {
    const firstSnapshot = getMockFixtureSnapshot();
    const secondSnapshot = getMockFixtureSnapshot();

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(secondSnapshot.account).not.toBe(firstSnapshot.account);
    expect(secondSnapshot.agents).not.toBe(firstSnapshot.agents);
    expect(secondSnapshot).toEqual(mockFixtureSeed);
  });

  it("withholds private fixture data from signed-out users", async () => {
    const client = createMockApiClient();
    const signedOut = { status: "signed-out", user: null } as const;

    await expect(client.getAccount(signedOut)).resolves.toEqual({ status: "available", data: null });
    await expect(client.getApplications(signedOut)).resolves.toEqual({ status: "available", data: [] });
    await expect(client.getAgents(signedOut)).resolves.toEqual({ status: "available", data: [] });
  });

  it("keeps agent API keys masked in every fixture", () => {
    for (const agent of mockFixtureSeed.agents) {
      expect(agent.apiKeyMasked).toMatch(/^nl_live_····…[0-9a-f]{4}$/);
      expect(agent.apiKeyMasked).not.toMatch(/^nl_live_[0-9a-f]{8,}$/);
    }
  });
});

describe("placeholder adapters", () => {
  it("never returns fixture success from the API placeholder", async () => {
    const client = createUnavailableApiClient();
    const signedIn = {
      status: "signed-in",
      user: mockFixtureSeed.account.user,
    } as const;

    await expect(client.getAccount(signedIn)).resolves.toEqual({
      status: "unavailable",
      reason: "api-mode-placeholder",
    });
    await expect(client.getApplications(signedIn)).resolves.toEqual({
      status: "unavailable",
      reason: "api-mode-placeholder",
    });
    await expect(client.getAgents(signedIn)).resolves.toEqual({
      status: "unavailable",
      reason: "api-mode-placeholder",
    });
  });

  it("notifies subscribers across session-preview sign-in and sign-out", async () => {
    const adapter = createSessionPreviewAuthAdapter({
      id: "demo-user",
      handle: "demo",
      initials: "DU",
      profileSlug: "demo",
    });
    const snapshots: string[] = [];
    const unsubscribe = adapter.subscribe(() => snapshots.push(adapter.getSnapshot().status));

    await expect(adapter.signIn()).resolves.toMatchObject({ status: "signed-in" });
    await expect(adapter.signOut()).resolves.toEqual({ status: "signed-out", user: null });
    unsubscribe();
    await adapter.signIn();

    expect(snapshots).toEqual(["signed-in", "signed-out"]);
  });
});
