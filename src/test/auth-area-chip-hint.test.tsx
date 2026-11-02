// @vitest-environment jsdom
import { act, cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthArea } from "@/components/layout/AuthArea";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { setChipHint } from "@/lib/foundation/session-hint";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={prefetch ? "" : undefined} href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const state: { auth: AuthSnapshot } = { auth: loading };

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signOut: vi.fn(async () => undefined) }),
    useFoundationMode: () => "api",
  }));

function withCookieHint() {
  window.localStorage.setItem("ninja.session", "1");
}

describe("AuthArea user chip hint", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    state.auth = loading;
  });
  afterEach(() => cleanup());

  it("paints the hinted chip (initials + nickname) while the session restores, without a menu or fade", () => {
    withCookieHint();
    setChipHint({ initials: "PE", handle: "Pelican" });
    renderWithIntl(<AuthArea variant="desktop" />);
    const hint = screen.getByTestId("user-chip-hint");
    expect(hint.textContent).toContain("PE");
    expect(hint.textContent).toContain("Pelican");
    expect(hint.getAttribute("aria-hidden")).toBe("true");
    expect(hint.className).not.toContain("animate-fade-in");
    expect(hint.querySelector("button")).toBeNull();
    expect(screen.queryByRole("link", { name: "Get Started" })).toBeNull();
  });

  it("keeps the invisible reserved box when only the old hints exist", () => {
    withCookieHint();
    window.localStorage.setItem("ninja.session.member", "1");
    renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.queryByTestId("user-chip-hint")).toBeNull();
  });

  it("ignores the chip hint without the refresh-cookie hint", () => {
    window.localStorage.setItem("ninja.session.chip", JSON.stringify({ initials: "PE", handle: "Pelican" }));
    renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.queryByTestId("user-chip-hint")).toBeNull();
  });

  it("replaces the hint with the real menu without replaying the fade, and shows the new user's data", () => {
    withCookieHint();
    setChipHint({ initials: "PE", handle: "Pelican" });
    const view = renderWithIntl(<AuthArea variant="desktop" />);
    state.auth = signedInWith({ handle: "Heron", initials: "HE" });
    act(() => view.rerender(<AuthArea variant="desktop" />));
    expect(screen.queryByTestId("user-chip-hint")).toBeNull();
    const trigger = screen.getByRole("button", { name: /Heron/ });
    expect(trigger.textContent).toContain("HE");
    expect(trigger.closest(".animate-fade-in")).toBeNull();
  });

  it("fades the real menu in when no hint was shown (fresh sign-in)", () => {
    state.auth = signedInWith({ handle: "Heron", initials: "HE" });
    renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.getByRole("button", { name: /Heron/ }).closest(".animate-fade-in")).not.toBeNull();
  });

  it("falls back to Get started when the restore ends signed out", () => {
    withCookieHint();
    setChipHint({ initials: "PE", handle: "Pelican" });
    const view = renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.getByTestId("user-chip-hint")).toBeTruthy();
    state.auth = signedOut;
    act(() => {
      setChipHint(null);
      view.rerender(<AuthArea variant="desktop" />);
    });
    expect(screen.queryByTestId("user-chip-hint")).toBeNull();
    expect(screen.getByRole("link", { name: "Get Started" })).toBeTruthy();
  });
});
