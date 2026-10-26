import { createTranslator } from "next-intl";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { enMessages } from "@/test/intl";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));

const params = Promise.resolve({ locale: "en" });

// Owner-private pages are disallowed in robots.ts; a disallowed URL that is linked can still be indexed, so each also
// carries noindex. A new owner-private page belongs in this list.
const privatePages = {
  account: () => import("@/app/[locale]/account/page"),
  home: () => import("@/app/[locale]/home/page"),
  applications: () => import("@/app/[locale]/applications/page"),
  agents: () => import("@/app/[locale]/agents/page"),
  "signup/wallet": () => import("@/app/[locale]/signup/wallet/page"),
  "signup/profile": () => import("@/app/[locale]/signup/profile/page"),
  "signup/get-started": () => import("@/app/[locale]/signup/get-started/page"),
};

describe("owner-private pages", () => {
  beforeAll(() => {
    // signup/wallet composes the runtime config at module load.
    vi.stubEnv("NINJA_DEPLOYMENT_TIER", "test");
    vi.stubEnv("NINJA_RUNTIME_MODE", "mock");
    vi.stubEnv("NINJA_MOCK_SEED", "default");
    vi.stubEnv("NINJA_APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_INJECTIVE_EVM_CHAIN_ID", "1439");
  });

  it.each(Object.entries(privatePages))("%s is noindex", async (_name, load) => {
    const { generateMetadata } = (await load()) as unknown as { generateMetadata: (props: { params: typeof params }) => Promise<{ robots?: unknown }> };
    expect((await generateMetadata({ params })).robots).toEqual({ index: false, follow: false });
  });
});
