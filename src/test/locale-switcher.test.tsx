// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { renderWithIntl } from "@/test/intl";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/bounties",
  useRouter: () => ({ replace }),
}));

describe("LocaleSwitcher", () => {
  it("opens a menu with the current locale checked and switches locale on select", () => {
    renderWithIntl(<LocaleSwitcher />);
    const trigger = screen.getByRole("button", { name: "Language" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["English✓", "한국어", "中文"]);
    expect(items[0].getAttribute("aria-checked")).toBe("true");

    act(() => fireEvent.click(items[1]));
    expect(replace).toHaveBeenCalledWith("/bounties", { locale: "ko" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape without switching", () => {
    replace.mockClear();
    renderWithIntl(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.keyDown(screen.getAllByRole("menuitemradio")[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
