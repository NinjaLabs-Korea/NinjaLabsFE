// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { renderWithIntl } from "@/test/intl";
import { peekReturnPath, rememberReturnPath } from "@/lib/return-path";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthActions: () => ({ signIn: () => new Promise(() => {}), signOut: vi.fn() }),
    useFoundationMode: () => "api",
  }));

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("GoogleLoginButton return path", () => {
  it("a plain sign-in clears a path left by an earlier attempt", () => {
    rememberReturnPath("/recruit");
    renderWithIntl(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(peekReturnPath()).toBeNull();
  });

  it("a sign-in with ?returnTo remembers it", () => {
    window.history.replaceState(null, "", "/signup?returnTo=/recruit");
    renderWithIntl(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(peekReturnPath()).toBe("/recruit");
  });
});
