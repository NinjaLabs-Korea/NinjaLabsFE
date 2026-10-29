// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => ({ checkNickname: vi.fn().mockResolvedValue({ available: true }), completeProfile: () => new Promise(() => {}), completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAuthSnapshot: () => signedInWith({ id: "user-a", onboardingCompleted: false, onboardingStep: 3 }),
  }));

function pageshow(persisted: boolean) {
  const event = new Event("pageshow") as Event & { persisted: boolean };
  Object.defineProperty(event, "persisted", { value: persisted });
  act(() => void window.dispatchEvent(event));
}

describe("ProfileForm restored from the bfcache", () => {
  beforeEach(() => sessionStorage.clear());

  it("resets a stuck 'Saving profile...' button and reloads in onboarding", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as unknown as Location);
    renderWithIntl(<ProfileForm />);
    fireEvent.change(screen.getByLabelText("Nickname*"), { target: { value: "ninja_dev" } });
    fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "bio" } });
    fireEvent.click(document.querySelector("button[aria-pressed]")!);
    await waitFor(() => expect(document.getElementById("nickname-status")!.textContent).toMatch(/available/i));
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect((screen.getByRole("button", { name: /saving/i }) as HTMLButtonElement).disabled).toBe(true));

    pageshow(false);
    expect(reload).not.toHaveBeenCalled();
    pageshow(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /saving/i })).toBeNull();
  });
});
