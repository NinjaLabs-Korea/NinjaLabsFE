import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeFoundationRuntime, readRuntimeConfig, RuntimeConfigError, type RuntimeEnvironment } from "@/lib/runtime/config";
import { mockFixtureSeed } from "@/lib/mocks/fixtures";

const mockEnv: RuntimeEnvironment = {
  NINJA_DEPLOYMENT_TIER: "local",
  NINJA_RUNTIME_MODE: "mock",
  NINJA_MOCK_SEED: "default",
  NINJA_APP_ORIGIN: "http://localhost:3000",
};

const apiEnv: RuntimeEnvironment = {
  NINJA_DEPLOYMENT_TIER: "production",
  NINJA_RUNTIME_MODE: "api",
  NINJA_APP_ORIGIN: "https://ninjalabs.example",
  NINJA_API_BASE_URL: "https://api.ninjalabs.example",
};

const error = (message: string) => new RuntimeConfigError(message);

describe("deployment tier x runtime mode matrix", () => {
  it.each([
    ["local", "mock", null],
    ["test", "mock", null],
    ["staging", "mock", "mock mode is allowed only for local and test tiers."],
    ["production", "mock", "mock mode is allowed only for local and test tiers."],
    ["local", "api", "api mode is allowed only for test, staging, and production tiers."],
    ["test", "api", null],
    ["staging", "api", null],
    ["production", "api", null],
  ] as const)("%s + %s", (tier, mode, failure) => {
    const env = { ...(mode === "mock" ? mockEnv : apiEnv), NINJA_DEPLOYMENT_TIER: tier };
    if (failure) {
      expect(() => readRuntimeConfig(env)).toThrow(error(failure));
      return;
    }
    const config = readRuntimeConfig(env);
    expect(config).toMatchObject({
      deploymentTier: tier,
      runtimeMode: mode,
      mockAvailable: tier === "local" || tier === "test",
      apiAvailable: tier !== "local",
    });
  });

  it("rejects an unknown tier and trims surrounding whitespace from every value", () => {
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_DEPLOYMENT_TIER: "prod" })).toThrow(
      error("NINJA_DEPLOYMENT_TIER must be one of: local, test, staging, production."),
    );
    expect(readRuntimeConfig({ ...apiEnv, NINJA_DEPLOYMENT_TIER: " staging ", NINJA_API_BASE_URL: " https://api.ninjalabs.example " })).toMatchObject({
      deploymentTier: "staging",
      apiUrl: "https://api.ninjalabs.example/",
    });
    // A whitespace-only optional value counts as unset.
    expect(readRuntimeConfig({ ...mockEnv, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "   " }).wallet).toBeNull();
  });
});

describe("origin and API URL rules", () => {
  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])("mock mode accepts the loopback origin %s", (origin) => {
    expect(readRuntimeConfig({ ...mockEnv, NINJA_APP_ORIGIN: origin }).origin).toBe(origin);
  });

  it.each(["http://ninjalabs.example", "http://192.168.0.10:3000", "http://localhost.evil.example"])("mock mode refuses the non-loopback origin %s", (origin) => {
    expect(() => readRuntimeConfig({ ...mockEnv, NINJA_APP_ORIGIN: origin })).toThrow(error("mock mode requires a localhost NINJA_APP_ORIGIN."));
  });

  it("normalizes the origin and refuses paths, queries, hashes and credentials", () => {
    expect(readRuntimeConfig({ ...apiEnv, NINJA_APP_ORIGIN: "HTTPS://NinjaLabs.Example/" }).origin).toBe("https://ninjalabs.example");
    for (const origin of ["https://ninjalabs.example/app", "https://ninjalabs.example/?x=1", "https://ninjalabs.example/#top"]) {
      expect(() => readRuntimeConfig({ ...apiEnv, NINJA_APP_ORIGIN: origin }), origin).toThrow(
        error("NINJA_APP_ORIGIN must be an origin without a path, query, or hash."),
      );
    }
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_APP_ORIGIN: "https://user:pw@ninjalabs.example" })).toThrow(
      error("NINJA_APP_ORIGIN must be an absolute HTTP(S) URL without credentials."),
    );
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_APP_ORIGIN: "ninjalabs.example" })).toThrow(
      error("NINJA_APP_ORIGIN must be an absolute HTTP(S) URL."),
    );
  });

  it("requires HTTPS for the origin and the API in api mode", () => {
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_APP_ORIGIN: "http://ninjalabs.example" })).toThrow(error("NINJA_APP_ORIGIN must use HTTPS."));
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_API_BASE_URL: "http://api.ninjalabs.example" })).toThrow(error("NINJA_API_BASE_URL must use HTTPS."));
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_API_BASE_URL: "https://u:p@api.ninjalabs.example" })).toThrow(
      error("NINJA_API_BASE_URL must be an absolute HTTP(S) URL without credentials."),
    );
  });

  it("keeps mock-only and api-only values in their own mode", () => {
    expect(() => readRuntimeConfig({ ...apiEnv, NINJA_MOCK_SEED: "default" })).toThrow(error("NINJA_MOCK_SEED is allowed only in mock mode."));
    expect(() => readRuntimeConfig({ ...mockEnv, NINJA_MOCK_SEED: undefined })).toThrow(error("NINJA_MOCK_SEED is required in mock mode."));
  });

  it("hands the api foundation the parsed API URL and the mock foundation its seed", () => {
    const user = mockFixtureSeed.account.user;
    expect(composeFoundationRuntime(user, readRuntimeConfig({ ...apiEnv, NINJA_API_BASE_URL: "https://api.ninjalabs.example/v1" }))).toEqual({
      foundationConfig: { mode: "api", apiUrl: "https://api.ninjalabs.example/v1" },
      wallet: null,
    });
    expect(composeFoundationRuntime(user, readRuntimeConfig({ ...mockEnv, NINJA_MOCK_SEED: "empty" })).foundationConfig).toEqual({
      mode: "mock",
      previewUser: user,
      mockSeed: "empty",
    });
  });
});

describe("wallet chain / RPC pairing", () => {
  const wallet = (chainId: string, rpcUrl?: string) =>
    readRuntimeConfig({ ...apiEnv, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: chainId, NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: rpcUrl }).wallet;

  it.each([
    ["1439", "https://k8s.testnet.json-rpc.injective.network/"],
    ["1439", "https://testnet.sentry.evm-rpc.injective.network/"],
    ["1776", "https://sentry.evm-rpc.injective.network/"],
    ["1776", "https://mainnet.json-rpc.injective.network/"],
    // Hosts outside injective.network carry no network name: the guard cannot judge them and lets them through.
    ["1439", "https://rpc.ninjalabs.example/"],
    ["1776", "https://rpc.ninjalabs.example/"],
  ])("accepts chain %s with %s", (chainId, rpcUrl) => {
    expect(wallet(chainId, rpcUrl)).toEqual({ chainId: Number(chainId), rpcUrl });
  });

  it.each([
    ["1776", "https://k8s.testnet.json-rpc.injective.network/", "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID 1776 (mainnet) cannot use a testnet RPC URL."],
    ["1776", "https://TESTNET.rpc.ninjalabs.example/", "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID 1776 (mainnet) cannot use a testnet RPC URL."],
    ["1439", "https://mainnet.json-rpc.injective.network/", "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID 1439 (testnet) cannot use a mainnet RPC URL."],
    ["1439", "https://mainnet.rpc.ninjalabs.example/", "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID 1439 (testnet) cannot use a mainnet RPC URL."],
    // The public mainnet RPC named in .env.example has neither word in its host; it is still not a testnet endpoint.
    ["1439", "https://sentry.evm-rpc.injective.network/", "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID 1439 (testnet) cannot use a mainnet RPC URL."],
  ])("refuses chain %s with %s", (chainId, rpcUrl, message) => {
    expect(() => wallet(chainId, rpcUrl)).toThrow(error(message));
  });

  it.each(["production", "staging"] as const)("rejects an http RPC URL in api mode on the %s tier", (tier) => {
    expect(() =>
      readRuntimeConfig({ ...apiEnv, NINJA_DEPLOYMENT_TIER: tier, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1776", NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: "http://rpc.ninjalabs.example/" }),
    ).toThrow(error("NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL must use HTTPS."));
  });

  it("keeps an http RPC URL valid in api mode on the test tier", () => {
    const config = readRuntimeConfig({ ...apiEnv, NINJA_DEPLOYMENT_TIER: "test", NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: "1776", NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: "http://127.0.0.1:8545/" });
    expect(config.wallet).toEqual({ chainId: 1776, rpcUrl: "http://127.0.0.1:8545/" });
  });

  it("only judges the host, never the path", () => {
    expect(wallet("1776", "https://rpc.ninjalabs.example/testnet")).toEqual({ chainId: 1776, rpcUrl: "https://rpc.ninjalabs.example/testnet" });
  });

  it("refuses an RPC URL without a chain id", () => {
    expect(() => readRuntimeConfig({ ...mockEnv, NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: "https://k8s.testnet.json-rpc.injective.network/" })).toThrow(
      error("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID is required when NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL is supplied."),
    );
  });

  it.each(["1439.0", "-1439", "0x59f", "1 439"])("refuses the non-decimal chain id %p", (chainId) => {
    expect(() => readRuntimeConfig({ ...mockEnv, NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: chainId })).toThrow(
      error("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID must be a supported numeric chain ID."),
    );
  });
});

/** The committed env files are parsed by the same loader at build time: a bad edit must fail here, not on Vercel. */
describe("committed env files", () => {
  const parseEnvFile = (path: string): RuntimeEnvironment =>
    Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );

  it(".env.production is a valid production api tuple on the testnet chain with a testnet RPC", () => {
    const config = readRuntimeConfig(parseEnvFile(".env.production"));
    expect(config).toMatchObject({ deploymentTier: "production", runtimeMode: "api", wallet: { chainId: 1439 } });
    expect(config.wallet?.rpcUrl).toMatch(/testnet/);
  });

  it(".env.example is a valid local mock tuple", () => {
    expect(readRuntimeConfig(parseEnvFile(".env.example"))).toMatchObject({ deploymentTier: "local", runtimeMode: "mock", mockSeed: "default" });
  });
});
