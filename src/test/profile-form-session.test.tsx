// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { renderWithIntl } from "@/test/intl";
import { signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => ({ checkNickname: vi.fn().mockResolvedValue({ available: true }), completeProfile: vi.fn(), completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAuthSnapshot: () => state.auth,
  }));

const DRAFT_KEY = "ninja.profileDraft";

describe("ProfileForm when the session ends mid-form", () => {
  beforeEach(() => {
    sessionStorage.clear();
    state.auth = signedInWith({ onboardingCompleted: false, onboardingStep: 3, handle: "user_ab12cd" });
  });

  it("keeps the typed values, says the session ended with a way back, and stashes a draft", () => {
    const view = renderWithIntl(<ProfileForm />);
    fireEvent.change(screen.getByLabelText("Nickname*"), { target: { value: "ninja_dev" } });
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "I build things" } });
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    view.rerender(<ProfileForm />);
    expect((screen.getByLabelText("Nickname*") as HTMLInputElement).value).toBe("ninja_dev");
    expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe("I build things");
    expect(screen.getByText("Your session has ended. Sign in again to continue.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Sign in again/ }).getAttribute("href")).toBe("/signup");
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ nickname: "ninja_dev", bio: "I build things" });
  });

  it("pre-fills a fresh onboarding form from the draft left by the ended session", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ nickname: "ninja_dev", bio: "I build things", tags: ["DEV", "bogus"] }));
    renderWithIntl(<ProfileForm />);
    expect((screen.getByLabelText("Nickname*") as HTMLInputElement).value).toBe("ninja_dev");
    expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe("I build things");
  });

  it("does not claim the session ended after a sign-out the user chose", () => {
    const view = renderWithIntl(<ProfileForm />);
    state.auth = signedOut;
    view.rerender(<ProfileForm />);
    expect(screen.queryByText("Your session has ended. Sign in again to continue.")).toBeNull();
  });

  it("shows no session message while signed in", () => {
    renderWithIntl(<ProfileForm />);
    expect(screen.queryByText("Your session has ended. Sign in again to continue.")).toBeNull();
  });
});
