// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

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
const nick = () => (screen.getByLabelText("Nickname") as HTMLInputElement).value;

describe("profile draft is tied to its user", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows A's draft to A but never to B, and removes it for B", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ userId: "user-a", nickname: "a_nick", bio: "a bio", tags: ["DEV"] }));
    state.auth = signedInWith({ id: "user-b", onboardingCompleted: false, onboardingStep: 3 });
    const b = renderWithIntl(<ProfileForm />);
    expect(nick()).toBe("");
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    b.unmount();

    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ userId: "user-a", nickname: "a_nick", bio: "a bio", tags: ["DEV"] }));
    state.auth = signedInWith({ id: "user-a", onboardingCompleted: false, onboardingStep: 3 });
    renderWithIntl(<ProfileForm />);
    expect(nick()).toBe("a_nick");
  });

  it("ignores and removes a legacy draft without a user id", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ nickname: "old", bio: "old", tags: [] }));
    state.auth = signedInWith({ id: "user-a", onboardingCompleted: false, onboardingStep: 3 });
    renderWithIntl(<ProfileForm />);
    expect(nick()).toBe("");
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("stores the draft with the signed-in user id", () => {
    state.auth = signedInWith({ id: "user-a", onboardingCompleted: false, onboardingStep: 3 });
    renderWithIntl(<ProfileForm />);
    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "typed" } });
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ userId: "user-a", nickname: "typed" });
  });

  it("reads the draft when the user appears after mount, and drops another user's", () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ userId: "user-a", nickname: "a_nick", bio: "x", tags: [] }));
    state.auth = { status: "loading", user: null };
    const view = renderWithIntl(<ProfileForm />);
    expect(nick()).toBe("");
    state.auth = signedInWith({ id: "user-a", onboardingCompleted: false, onboardingStep: 3 });
    view.rerender(<ProfileForm />);
    expect(nick()).toBe("a_nick");
  });
});
