const TRACE_KEY = "ninja.onboardingTraceId";

type LogDetails = Record<string, boolean | number | string | null | undefined>;

export function getOnboardingTraceId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.sessionStorage.getItem(TRACE_KEY);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(TRACE_KEY, created);
    return created;
  } catch {
    return undefined;
  }
}

/** Temporary diagnostics. Never include tokens, OAuth codes, signatures, messages, or field values. */
export function onboardingLog(event: string, details: LogDetails = {}) {
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
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : "invalid";
}
