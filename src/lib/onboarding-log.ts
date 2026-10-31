import { shortAddress } from "@/lib/format";
import { readStorage, writeStorage } from "@/lib/safe-storage";

const TRACE_KEY = "ninja.onboardingTraceId";

type LogDetails = Record<string, boolean | number | string | null | undefined>;

export function getOnboardingTraceId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = readStorage("session", TRACE_KEY);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    return writeStorage("session", TRACE_KEY, created) ? created : undefined;
  } catch {
    return undefined;
  }
}

/** Opt-in at build time with NEXT_PUBLIC_ONBOARDING_DEBUG=true; silent otherwise (including production). */
export function isOnboardingDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ONBOARDING_DEBUG === "true";
}

/** Opt-in diagnostics. Never include tokens, OAuth codes, signatures, messages, or field values. */
export function onboardingLog(event: string, details: LogDetails = {}) {
  if (!isOnboardingDebugEnabled()) return;
  const traceId = getOnboardingTraceId();
  globalThis.console.info("[onboarding]", {
    event,
    ...(traceId ? { traceId } : {}),
    ...details,
  });
}

export function onboardingErrorDetails(error: unknown): LogDetails {
  if (error && typeof error === "object") {
    const candidate = error as { name?: string; code?: string; status?: number };
    return {
      errorName: candidate.name ?? "Error",
      errorCode: candidate.code ?? "UNKNOWN_ERROR",
      errorStatus: candidate.status,
    };
  }
  return { errorName: "UnknownError", errorCode: "UNKNOWN_ERROR" };
}

export function maskWalletAddress(address?: string): string | undefined {
  if (!address) return undefined;
  return address.length > 12 ? shortAddress(address) : "invalid";
}
