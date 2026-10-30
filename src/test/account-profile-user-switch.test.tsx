// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { ProfileForm } from "@/components/signup/ProfileForm";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown as AuthSnapshot }));
const completeProfile = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ origin: "https://ninjalabs.test" }) }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAccountSettingsApi: () => ({}),
    useOnboardingApi: () => ({ checkNickname: vi.fn().mockResolvedValue({ available: true }), completeProfile, completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn(), refresh: async () => state.auth }),
    useCohortApi: () => ({ getMyCohortApplications: async () => ({ status: "available", data: [] }) }),
    useFoundationMode: () => "api",
  }));

const userA = signedInWith({ id: "user-a", handle: "alice_dev", bio: "alice bio", tags: ["DEV"], onboardingCompleted: true });
const userB = signedInWith({ id: "user-b", handle: "bob_dev", bio: "bob bio", tags: ["DESIGN"], onboardingCompleted: true });

describe("profile editor across an account switch", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    completeProfile.mockClear();
    window.sessionStorage.clear();
    state.auth = userA;
  });

  it("closes the editor when another tab switches to a different user", () => {
    const view = renderWithIntl(<AccountSettingsView />);
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "A edited, unsaved" } });
    expect(screen.queryByLabelText(/^Bio/)).not.toBeNull();

    state.auth = userB;
    view.rerender(<AccountSettingsView />);
    expect(screen.queryByLabelText(/^Bio/)).toBeNull();
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy();
    // Reopening starts from B's saved values, not A's edit.
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe("bob bio");
    expect(completeProfile).not.toHaveBeenCalled();
  });

  it("an edit form opened for A never posts after the signed-in user became B", () => {
    const view = renderWithIntl(<ProfileForm mode="edit" />);
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "A edited" } });
    state.auth = userB;
    view.rerender(<ProfileForm mode="edit" />);
    fireEvent.submit(screen.getByRole("button", { name: /save/i }).closest("form")!);
    expect(completeProfile).not.toHaveBeenCalled();
  });
});
