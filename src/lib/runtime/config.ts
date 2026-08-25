import type { ClientUser } from "@/lib/contracts/auth";

const deploymentTiers = ["local", "test", "staging", "production"] as const;
const runtimeModes = ["mock", "api"] as const;
const injectiveEvmChainIds = [1439, 1776] as const;

export type DeploymentTier = (typeof deploymentTiers)[number];
export type RuntimeMode = (typeof runtimeModes)[number];
export type WalletChainId = (typeof injectiveEvmChainIds)[number];

export type WalletConfig = {
  chainId: WalletChainId;
  rpcUrl?: string;
};

export type PublicRuntimeConfig = {
  deploymentTier: DeploymentTier;
  runtimeMode: RuntimeMode;
  origin: string;
  mockAvailable: boolean;
  apiAvailable: boolean;
  wallet: WalletConfig | null;
};

export type RuntimeConfig = PublicRuntimeConfig & {
  apiUrl?: string;
  mockSeed?: string;
};

export type RuntimeEnvironment = {
  NINJA_DEPLOYMENT_TIER?: string;
  NINJA_RUNTIME_MODE?: string;
  NINJA_APP_ORIGIN?: string;
  NINJA_API_BASE_URL?: string;
  NINJA_MOCK_SEED?: string;
  NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID?: string;
  NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL?: string;
};

export type FoundationConfig =
  | {
      mode: "mock";
      previewUser: ClientUser;
      mockSeed: string;
    }
  | {
      mode: "api";
      apiUrl: string;
    };

export type FoundationRuntimeComposition = {
  foundationConfig: FoundationConfig;
  wallet: WalletConfig | null;
};

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(`Invalid runtime configuration: ${message}`);
    this.name = "RuntimeConfigError";
  }
}

function required(environment: RuntimeEnvironment, name: keyof RuntimeEnvironment): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new RuntimeConfigError(`${name} is required.`);
  }

  return value;
}

function parseChoice<T extends readonly string[]>(
  value: string,
  name: string,
  choices: T,
): T[number] {
  if (!choices.includes(value)) {
    throw new RuntimeConfigError(`${name} must be one of: ${choices.join(", ")}.`);
  }

  return value as T[number];
}

function parseHttpUrl(value: string, name: string, requireOriginOnly: boolean): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new RuntimeConfigError(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new RuntimeConfigError(`${name} must be an absolute HTTP(S) URL without credentials.`);
  }

  if (requireOriginOnly && (url.pathname !== "/" || url.search || url.hash)) {
    throw new RuntimeConfigError(`${name} must be an origin without a path, query, or hash.`);
  }

  return requireOriginOnly ? url.origin : url.toString();
}

function requireHttps(value: string, name: string): string {
  if (new URL(value).protocol !== "https:") {
    throw new RuntimeConfigError(`${name} must use HTTPS.`);
  }
  return value;
}
function optionalValue(environment: RuntimeEnvironment, name: keyof RuntimeEnvironment): string | undefined {
  return environment[name]?.trim() || undefined;
}


function parseWalletConfig(environment: RuntimeEnvironment): WalletConfig | null {
  const chainIdValue = optionalValue(environment, "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID");
  const rpcUrl = optionalValue(environment, "NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL");

  if (!chainIdValue) {
    if (rpcUrl) {
      throw new RuntimeConfigError(
        "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID is required when NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL is supplied.",
      );
    }
    return null;
  }

  if (!/^\d+$/.test(chainIdValue)) {
    throw new RuntimeConfigError(
      "NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID must be a supported numeric chain ID.",
    );
  }

  const chainId = Number(chainIdValue);
  if (!Number.isSafeInteger(chainId) || !injectiveEvmChainIds.includes(chainId as WalletChainId)) {
    throw new RuntimeConfigError("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID must be one of: 1439, 1776.");
  }

  return {
    chainId: chainId as WalletChainId,
    ...(rpcUrl
      ? { rpcUrl: parseHttpUrl(rpcUrl, "NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL", false) }
      : {}),
  };
}


export function readRuntimeConfig(environment: RuntimeEnvironment): RuntimeConfig {

  const deploymentTier = parseChoice(
    required(environment, "NINJA_DEPLOYMENT_TIER"),
    "NINJA_DEPLOYMENT_TIER",
    deploymentTiers,
  );
  const runtimeMode = parseChoice(
    required(environment, "NINJA_RUNTIME_MODE"),
    "NINJA_RUNTIME_MODE",
    runtimeModes,
  );
  const mockAvailable = deploymentTier === "local" || deploymentTier === "test";
  const apiAvailable = deploymentTier !== "local";

  if (runtimeMode === "mock" && !mockAvailable) {
    throw new RuntimeConfigError("mock mode is allowed only for local and test tiers.");
  }

  if (runtimeMode === "api" && !apiAvailable) {
    throw new RuntimeConfigError("api mode is allowed only for test, staging, and production tiers.");
  }

  const origin = parseHttpUrl(
    required(environment, "NINJA_APP_ORIGIN"),
    "NINJA_APP_ORIGIN",
    true,
  );
  const apiUrl = optionalValue(environment, "NINJA_API_BASE_URL");
  const mockSeed = optionalValue(environment, "NINJA_MOCK_SEED");

  if (runtimeMode === "mock") {
    const originHostname = new URL(origin).hostname;
    if (originHostname !== "localhost" && originHostname !== "127.0.0.1" && originHostname !== "::1") {
      throw new RuntimeConfigError("mock mode requires a localhost NINJA_APP_ORIGIN.");
    }
    if (!mockSeed) {
      throw new RuntimeConfigError("NINJA_MOCK_SEED is required in mock mode.");
    }
    if (apiUrl) {
      throw new RuntimeConfigError("NINJA_API_BASE_URL is allowed only in api mode.");
    }
  } else {
    requireHttps(origin, "NINJA_APP_ORIGIN");
    if (mockSeed) {
      throw new RuntimeConfigError("NINJA_MOCK_SEED is allowed only in mock mode.");
    }
    if (!apiUrl) {
      throw new RuntimeConfigError("NINJA_API_BASE_URL is required in api mode.");
    }
  }

  return {
    deploymentTier,
    runtimeMode,
    origin,
    mockAvailable,
    apiAvailable,
    wallet: parseWalletConfig(environment),
    ...(apiUrl
      ? {
          apiUrl: requireHttps(
            parseHttpUrl(apiUrl, "NINJA_API_BASE_URL", false),
            "NINJA_API_BASE_URL",
          ),
        }
      : {}),
    ...(mockSeed ? { mockSeed } : {}),
  };
}

export function loadRuntimeConfig(): RuntimeConfig {
  return readRuntimeConfig({
    NINJA_DEPLOYMENT_TIER: process.env.NINJA_DEPLOYMENT_TIER,
    NINJA_RUNTIME_MODE: process.env.NINJA_RUNTIME_MODE,
    NINJA_APP_ORIGIN: process.env.NINJA_APP_ORIGIN,
    NINJA_API_BASE_URL: process.env.NINJA_API_BASE_URL,
    NINJA_MOCK_SEED: process.env.NINJA_MOCK_SEED,
    NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID: process.env.NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID,
    NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL: process.env.NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL,
  });
}

export function composeFoundationRuntime(
  previewUser: ClientUser,
  config = loadRuntimeConfig(),
): FoundationRuntimeComposition {
  return {
    foundationConfig:
      config.runtimeMode === "mock"
        ? { mode: "mock", previewUser, mockSeed: config.mockSeed! }
        : { mode: "api", apiUrl: config.apiUrl! },
    wallet: config.wallet ? { ...config.wallet } : null,
  };
}

export function toPublicRuntimeConfig(config: RuntimeConfig): PublicRuntimeConfig {
  return {
    deploymentTier: config.deploymentTier,
    runtimeMode: config.runtimeMode,
    origin: config.origin,
    mockAvailable: config.mockAvailable,
    apiAvailable: config.apiAvailable,
    wallet: config.wallet ? { ...config.wallet } : null,
  };
}