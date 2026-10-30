// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { enMessages } from "@/test/intl";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/notices",
  useRouter: () => ({ replace }),
}));

// Rendered under the Korean locale (English copy is fine: only the active locale matters here).
const renderKo = () =>
  render(
    <NextIntlClientProvider locale="ko" messages={enMessages} timeZone="UTC">
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );

describe("LocaleSwitcher keyboard behavior", () => {
  beforeEach(() => replace.mockClear());

  it("opens with focus on the active locale and marks only it as checked", () => {
    renderKo();
    const trigger = screen.getByRole("button", { name: /^Language/ });
    expect(trigger.textContent).toContain("한국어");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const items = screen.getAllByRole("menuitemradio");
    expect(document.activeElement).toBe(items[1]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(items.map((item) => item.getAttribute("lang"))).toEqual(["en", "ko", "zh"]);
    expect(screen.getByRole("menu", { name: "Language" })).toBeTruthy();
  });

  it("re-selecting the active locale closes the menu, keeps the route and returns focus to the trigger", () => {
    renderKo();
    const trigger = screen.getByRole("button", { name: /^Language/ });
    fireEvent.keyDown(trigger, { key: "Enter" });
    act(() => fireEvent.click(screen.getAllByRole("menuitemradio")[1]));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("moves between locales with the arrow keys and switches on the focused one", () => {
    renderKo();
    fireEvent.keyDown(screen.getByRole("button", { name: /^Language/ }), { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("中文");
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("English");
    act(() => fireEvent.click(document.activeElement as HTMLElement));
    expect(replace).toHaveBeenCalledWith("/notices", { locale: "en" });
  });
});
