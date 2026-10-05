import { afterEach, describe, expect, it, vi } from "vitest";
import { onboardingLog } from "@/lib/onboarding-log";

describe("onboardingLog", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is silent unless NEXT_PUBLIC_ONBOARDING_DEBUG is true", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    onboardingLog("test.event");
    expect(info).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_DEBUG", "true");
    onboardingLog("test.event");
    expect(info).toHaveBeenCalledWith("[onboarding]", expect.objectContaining({ event: "test.event" }));
  });
});
