import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { enMessages } from "@/test/intl";

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getFormatter: async () => ({}),
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  getRuntimeBounty: async (slug: string) => ({ slug, title: "Widget", summary: "Build a widget", applicationRequired: false }),
}));

const list = await import("@/app/[locale]/bounties/page");
const apply = await import("@/app/[locale]/bounties/apply/page");
const detail = await import("@/app/[locale]/bounties/[id]/page");

// A page's `openGraph` / `twitter` replace the locale layout's wholesale: a page that only set `alternates` + `title`
// shared the site-wide og:title and the locale home's og:url when someone pasted the link into a chat.
describe("public bounty pages build their metadata through localeMetadata", () => {
  const cases = [
    ["list", () => list.generateMetadata({ params: Promise.resolve({ locale: "ko" }) } as never), "/ko/bounties"],
    ["apply guide", () => apply.generateMetadata({ params: Promise.resolve({ locale: "ko" }) } as never), "/ko/bounties/apply"],
    ["detail", () => detail.generateMetadata({ params: Promise.resolve({ locale: "ko", id: "widget" }) } as never), "/ko/bounties/widget"],
  ] as const;

  it.each(cases)("%s carries its own og:url, title and locale", async (_name, load, url) => {
    const metadata = await load();
    expect(metadata.alternates?.canonical).toBe(url);
    expect(metadata.openGraph).toMatchObject({ url, siteName: "Ninja Labs", locale: "ko_KR" });
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: metadata.title });
  });
});
