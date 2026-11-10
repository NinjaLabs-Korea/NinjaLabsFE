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
    expect(readRuntimeConfig({ ...mockEnv, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "   " })).not.toHaveProperty("turnstileSiteKey");
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
    });
    expect(composeFoundationRuntime(user, readRuntimeConfig({ ...mockEnv, NINJA_MOCK_SEED: "empty" })).foundationConfig).toEqual({
      mode: "mock",
      previewUser: user,
      mockSeed: "empty",
    });
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

  it(".env.production is a valid production api tuple and names no wallet chain or RPC", () => {
    const env = parseEnvFile(".env.production");
    expect(readRuntimeConfig(env)).toMatchObject({ deploymentTier: "production", runtimeMode: "api" });
    expect(Object.keys(env).filter((key) => /INJECTIVE|WALLETCONNECT/.test(key))).toEqual([]);
  });

  it(".env.example is a valid local mock tuple and names no wallet chain or RPC", () => {
    const env = parseEnvFile(".env.example");
    expect(readRuntimeConfig(env)).toMatchObject({ deploymentTier: "local", runtimeMode: "mock", mockSeed: "default" });
    expect(Object.keys(env).filter((key) => /INJECTIVE|WALLETCONNECT/.test(key))).toEqual([]);
  });
});
