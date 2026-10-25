import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { enMessages } from "@/test/intl";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/members", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/members")>()),
  getRuntimeProfile: async (slug: string) =>
    slug.toLowerCase() === "ninja.inj" ? { slug: "ninja.inj", handle: "ninja.inj", bio: "Builder" } : undefined,
}));

const { generateMetadata } = await import("@/app/[locale]/members/[id]/page");

describe("member profile metadata", () => {
  it("canonicalizes a differently-cased URL to the stored nickname", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "NINJA.inj" }) } as never);
    expect(metadata.alternates?.canonical).toBe("/en/members/ninja.inj");
    expect(metadata.openGraph?.url).toBe("/en/members/ninja.inj");
  });

  it("drops alternates for a missing profile", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "nobody" }) } as never);
    expect(metadata.alternates).toEqual({});
  });
});
