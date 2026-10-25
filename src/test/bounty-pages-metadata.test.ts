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
vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  getRuntimeBounty: async (slug: string) => ({ slug, title: "Widget", summary: "A widget." }),
}));

const list = await import("@/app/[locale]/bounties/page");
const apply = await import("@/app/[locale]/bounties/apply/page");
const detail = await import("@/app/[locale]/bounties/[id]/page");

// A page's openGraph replaces the layout's wholesale: without siteName / locale / twitter, shares of the most-linked
// pages lose them and the list pages inherit the site-wide og:title.
describe("bounty pages share metadata", () => {
  const expectShareTags = (metadata: Awaited<ReturnType<typeof list.generateMetadata>>, url: string) => {
    expect(metadata.alternates?.canonical).toBe(url);
    expect(metadata.openGraph).toMatchObject({ title: metadata.title, url, siteName: "Ninja Labs", locale: "en_US" });
    expect(metadata.twitter).toMatchObject({ title: metadata.title });
  };

  it("list", async () => {
    expectShareTags(await list.generateMetadata({ params: Promise.resolve({ locale: "en" }) }), "/en/bounties");
  });

  it("apply guide", async () => {
    expectShareTags(await apply.generateMetadata({ params: Promise.resolve({ locale: "en" }) }), "/en/bounties/apply");
  });

  it("detail", async () => {
    const metadata = await detail.generateMetadata({ params: Promise.resolve({ locale: "en", id: "iasset-price-widget" }) });
    expectShareTags(metadata, "/en/bounties/iasset-price-widget");
  });
});
