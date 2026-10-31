// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { SignupGate } from "@/components/signup/SignupGate";
import { shouldRedirectToOnboarding } from "@/lib/api/auth-adapter";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
const replace = vi.hoisted(() => vi.fn());
const checkNickname = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => ({ checkNickname, completeProfile: vi.fn(), completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAuthSnapshot: () => state.auth,
  }));

describe("shouldRedirectToOnboarding and /recruit", () => {
  const step2 = signedInWith({ onboardingCompleted: false, onboardingStep: 2 }).user;
  it("leaves /recruit alone for an unfinished sign-up, still redirects other pages", () => {
    expect(shouldRedirectToOnboarding(step2, "/en/recruit")).toBeNull();
    expect(shouldRedirectToOnboarding(step2, "/en/recruit/apply")).toBeNull();
    expect(shouldRedirectToOnboarding(step2, "/en/bounties")).toBe("/en/signup/wallet");
  });
});

describe("ProfileForm own nickname after the session ended", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    checkNickname.mockReset().mockResolvedValue({ available: false });
    state.auth = signedInWith({ onboardingCompleted: true, handle: "ninja_dev" });
  });
  afterEach(() => vi.useRealTimers());

  it("does not call the nickname taken after sign-out and sends no check", async () => {
    const view = renderWithIntl(<ProfileForm mode="edit" />);
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    view.rerender(<ProfileForm mode="edit" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(checkNickname).not.toHaveBeenCalled();
    expect(screen.queryByText("That nickname is already taken.")).toBeNull();
  });
});

describe("SignupGate follows the session", () => {
  beforeEach(() => replace.mockReset());
  it("leaves the step-1 sign-in card once the session is signed in, but keeps step 3", () => {
    state.auth = { status: "signed-out", user: null };
    const one = renderWithIntl(<SignupGate step={1}><p>card</p></SignupGate>);
    expect(screen.getByText("card")).toBeTruthy();
    state.auth = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
    one.rerender(<SignupGate step={1}><p>card</p></SignupGate>);
    expect(screen.queryByText("card")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/signup/profile");
    one.unmount();

    replace.mockReset();
    state.auth = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
    const three = renderWithIntl(<SignupGate step={3}><p>profile</p></SignupGate>);
    state.auth = signedInWith({ onboardingCompleted: true });
    three.rerender(<SignupGate step={3}><p>profile</p></SignupGate>);
    expect(screen.getByText("profile")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
