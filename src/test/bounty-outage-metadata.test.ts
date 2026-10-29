import { describe, expect, it, vi } from "vitest";

// A BE outage makes the bounty loader throw. The layout and the page then render error.tsx (HTTP 500); their
// generateMetadata must not throw too, or that 500 page has no <title> at all.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string) => `${namespace}.${key}`,
  getFormatter: async () => ({}),
  setRequestLocale: () => undefined,
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));
vi.mock("@/lib/bounties", () => ({
  getRuntimeBounty: async () => {
    throw new Error("BE down");
  },
}));

const layout = await import("@/app/[locale]/bounties/[id]/layout");
const page = await import("@/app/[locale]/bounties/[id]/page");

const args = { params: Promise.resolve({ locale: "en", id: "4f2c3f0e-9d2a-4a5b-8c6d-1e2f3a4b5c6d" }) } as never;

describe("bounty detail metadata during a BE outage", () => {
  it("gives the error page a title instead of throwing (layout and page)", async () => {
    expect(await layout.generateMetadata(args)).toEqual({ alternates: {}, title: "bounties.meta.unavailable" });
    expect(await page.generateMetadata(args)).toEqual({ alternates: {}, title: "bounties.meta.unavailable" });
  });
});
