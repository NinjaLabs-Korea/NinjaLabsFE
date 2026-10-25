// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createFormatter, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Notice } from "@/lib/types";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a data-i18n-link="" href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "UTC" }),
}));

const data = vi.hoisted(() => ({ notice: undefined as Notice | undefined }));
vi.mock("@/lib/detail-id", () => ({ validateDetailId: async () => true }));
vi.mock("@/lib/notices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notices")>()),
  getRuntimeNotice: async () => data.notice,
}));

const { default: NoticeDetailPage } = await import("@/app/[locale]/notices/[id]/page");

const notice = (externalUrl: string): Notice => ({
  slug: "n1", title: "T", excerpt: "E", bodyMarkdown: "Body", category: "Events", publishedAt: "2026.06.20", thumbnail: "", externalUrl,
});

describe("notice detail read-more link", () => {
  it("routes a same-site path through the locale-aware Link and leaves an absolute URL a plain anchor", async () => {
    data.notice = notice("/bounties");
    const { unmount } = renderWithIntl(await NoticeDetailPage({ params: Promise.resolve({ locale: "ko", id: "n1" }) } as never));
    expect(screen.getByText(enMessages.notices.detail.readMoreLink).hasAttribute("data-i18n-link")).toBe(true);
    unmount();

    data.notice = notice("https://example.test/post");
    renderWithIntl(await NoticeDetailPage({ params: Promise.resolve({ locale: "ko", id: "n1" }) } as never));
    const link = screen.getByText(enMessages.notices.detail.readMoreLink);
    expect(link.hasAttribute("data-i18n-link")).toBe(false);
    expect(link.getAttribute("href")).toBe("https://example.test/post");
  });
});
