// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeHallOfFame } from "@/lib/hall-of-fame";
import enHof from "../../messages/en/hallOfFame.json";
import koHof from "../../messages/ko/hallOfFame.json";
import zhHof from "../../messages/zh/hallOfFame.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const state = vi.hoisted(() => ({ locale: "en", data: null as unknown }));
const all = { en: enHof, ko: koHof, zh: zhHof } as const;

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    const locale = state.locale as keyof typeof all;
    return createTranslator({ locale, messages: { hallOfFame: all[locale] } as never, namespace: namespace as never, timeZone: "UTC" });
  },
}));
vi.mock("@/lib/hall-of-fame", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hall-of-fame")>()),
  loadRuntimeHallOfFame: async () => state.data,
}));

const { default: HallOfFamePage } = await import("@/app/[locale]/hall-of-fame/page");
const emptyData: { hallOfFame: RuntimeHallOfFame; unavailable: boolean } = { hallOfFame: { stats: [], highlights: [], milestones: [], partners: [] }, unavailable: false };

async function renderPage(locale: "en" | "ko" | "zh", data: unknown) {
  state.locale = locale;
  state.data = data;
  render(await HallOfFamePage({ params: Promise.resolve({ locale }) } as never));
}

afterEach(cleanup);

describe("Hall of Fame empty state", () => {
  it.each([
    ["en", "Nothing here yet", "See past activities"],
    ["ko", "아직 기록이 없습니다", "지난 활동 보기"],
    ["zh", "暂无记录", "查看过往活动"],
  ] as const)("shows the empty card with a notices link in %s", async (locale, title, cta) => {
    await renderPage(locale, emptyData);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByRole("link", { name: cta }).getAttribute("href")).toBe("/notices");
  });

  it("hides the empty card when content exists", async () => {
    await renderPage("en", { ...emptyData, hallOfFame: { ...emptyData.hallOfFame, milestones: [{ title: "Launch", description: "Live", date: "2026-10-01" }] } });
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });

  it("hides the empty card when the API is unavailable", async () => {
    await renderPage("en", { ...emptyData, unavailable: true });
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });
});
