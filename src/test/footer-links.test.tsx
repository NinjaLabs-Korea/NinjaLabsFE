// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props} prefetch={undefined}>{children}</a>
  ),
}));

describe("Footer links", () => {
  it("every new-tab link carries an sr-only suffix and names its brand", () => {
    const { container } = renderWithIntl(<Footer />);
    const external = [...container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')];
    expect(external.length).toBe(8);
    for (const link of external) {
      expect(link.querySelector(".sr-only")?.textContent).toBe(" (opens in a new tab)");
    }
    expect(screen.getByRole("link", { name: /^Injective Discord\s*\(opens in a new tab\)$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Injective Ecosystem\s*\(opens in a new tab\)$/ })).toBeTruthy();
  });

  it("the logo links home", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByRole("link", { name: "Ninja Labs home" }).getAttribute("href")).toBe("/");
  });
});
