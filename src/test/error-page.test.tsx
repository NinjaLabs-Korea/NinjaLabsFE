// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  useRouter: () => ({ refresh }),
}));

const { default: ErrorPage } = await import("@/app/[locale]/error");

describe("locale error boundary", () => {
  it("retry re-fetches the server component tree and resets the boundary", () => {
    const reset = vi.fn();
    const messages = { common: { errorPage: { eyebrow: "e", title: "t", description: "d", retry: "Retry", home: "Home" } } };
    render(<NextIntlClientProvider locale="en" messages={messages}><ErrorPage reset={reset} /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
