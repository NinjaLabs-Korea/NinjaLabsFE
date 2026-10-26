// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeyReveal } from "@/components/agents/ApiKeyReveal";
import { CompleteOnboarding } from "@/components/signup/CompleteOnboarding";
import { CompleteSignupLink } from "@/components/signup/CompleteSignupLink";
import { SignupGate } from "@/components/signup/SignupGate";
import AuthCallbackPage from "@/app/[locale]/auth/callback/page";
import { ApiHttpError } from "@/lib/api/http";
import { exchangeLoginCodeFromLocation } from "@/lib/api/oauth";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a data-locale-link="" href={href} {...props}>
      {children}
    </a>
  ),
}));

const user = { id: "u1", handle: "kim", initials: "K", profileSlug: "kim" };
const state: { auth: AuthSnapshot; mode: "mock" | "api" } = { auth: { status: "signed-out", user: null }, mode: "api" };
const completeOnboarding = vi.fn<() => Promise<void>>();
// Stable like the provider's client: CompleteOnboarding keys its effect on the client identity.
const onboardingApi = { completeOnboarding };

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useFoundationMode: () => state.mode,
    useOnboardingApi: () => onboardingApi,
  }));

describe("AuthCallbackPage #error mapping", () => {
  async function landOnCallback(fragment: string) {
    window.history.replaceState(null, "", `/en/auth/callback#${fragment}`);
    await exchangeLoginCodeFromLocation().catch(() => undefined);
  }

  it.each([
    ["error=TURNSTILE_FAILED", "The bot check did not pass. Go back to the sign-in page, complete the check again and retry."],
    ["error=TURNSTILE_UNAVAILABLE", "The bot check service is temporarily unavailable. Please try signing in again in a moment."],
    ["error=DATABASE_UNAVAILABLE", "The service is temporarily unavailable. Please try again in a moment."],
    ["error=AUTH_FAILED", "Please try signing in again in this browser tab."],
    ["error=%3Cscript%3E", "Please try signing in again in this browser tab."],
  ])("shows the copy for #%s once the sign-in failed", async (fragment, copy) => {
    await landOnCallback(fragment);
    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<AuthCallbackPage />);
    expect(screen.getByRole("status").textContent).toBe(copy);
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();
  });

  it("keeps the restoring copy while the session is still loading", async () => {
    await landOnCallback("error=TURNSTILE_FAILED");
    state.auth = { status: "loading", user: null };
    renderWithIntl(<AuthCallbackPage />);
    expect(screen.getByRole("status").textContent).toBe("Restoring your account. You will be redirected shortly.");
  });
});

describe("SignupGate", () => {
  beforeEach(() => {
    state.mode = "api";
  });

  it("renders the step for a signed-in session", () => {
    state.auth = signedInAs(user);
    renderWithIntl(<SignupGate><p>Step content</p></SignupGate>);
    expect(screen.getByText("Step content")).toBeTruthy();
  });

  it("shows a checking status while the session restores, without the step", () => {
    state.auth = { status: "loading", user: null };
    renderWithIntl(<SignupGate><p>Step content</p></SignupGate>);
    expect(screen.getByRole("status").textContent).toBe("Checking your session…");
    expect(screen.queryByText("Step content")).toBeNull();
  });

  it("asks a signed-out visitor to sign in instead of showing the step in API mode", () => {
    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<SignupGate><p>Step content</p></SignupGate>);
    expect(screen.queryByText("Step content")).toBeNull();
    expect(screen.getByText("Sign in to continue signing up")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue with Google" }).getAttribute("href")).toBe("/signup");
  });

  it("keeps every step previewable in mock mode", () => {
    state.mode = "mock";
    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<SignupGate><p>Step content</p></SignupGate>);
    expect(screen.getByText("Step content")).toBeTruthy();
  });
});

describe("CompleteOnboarding", () => {
  beforeEach(() => {
    completeOnboarding.mockReset();
  });

  it("completes onboarding once for a signed-in user and shows nothing on success", async () => {
    state.auth = signedInAs(user);
    completeOnboarding.mockResolvedValue(undefined);
    const { container } = renderWithIntl(<CompleteOnboarding />);
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe("");
  });

  it("does not call the API for a signed-out visitor or an already-completed user", async () => {
    state.auth = { status: "signed-out", user: null };
    const first = renderWithIntl(<CompleteOnboarding />);
    first.unmount();
    state.auth = signedInAs({ ...user, onboardingCompleted: true });
    renderWithIntl(<CompleteOnboarding />);
    await act(async () => undefined);
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("sends a user who has not saved the profile yet back to the step they owe instead of calling the BE", async () => {
    const replace = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, pathname: "/en/signup/get-started", replace } });
    try {
      state.auth = signedInAs({ ...user, onboardingStep: 2, onboardingCompleted: false });
      renderWithIntl(<CompleteOnboarding />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/signup/wallet"));
      expect(completeOnboarding).not.toHaveBeenCalled();

      replace.mockClear();
      cleanup();
      state.auth = signedInAs({ ...user, onboardingStep: 3, onboardingCompleted: false });
      renderWithIntl(<CompleteOnboarding />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/signup/profile"));

      // Step 4 (profile saved) completes normally and never redirects.
      replace.mockClear();
      cleanup();
      completeOnboarding.mockResolvedValue(undefined);
      state.auth = signedInAs({ ...user, onboardingStep: 4, onboardingCompleted: false });
      renderWithIntl(<CompleteOnboarding />);
      await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
      expect(replace).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("shows an alert with Retry on failure and clears it once the retry succeeds", async () => {
    state.auth = signedInAs(user);
    completeOnboarding.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    renderWithIntl(<CompleteOnboarding />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We couldn't finish saving your onboarding.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(completeOnboarding).toHaveBeenCalledTimes(2);
  });

  it("sends a user whose profile is not saved yet back to their onboarding step instead of offering a dead Retry", async () => {
    // Opened /signup/get-started directly at step 3: the BE answers 409 PROFILE_REQUIRED on every attempt.
    state.auth = signedInAs({ ...user, onboardingStep: 3, onboardingCompleted: false });
    completeOnboarding.mockRejectedValue(new ApiHttpError(409, "PROFILE_REQUIRED"));
    const assign = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/ko/signup/get-started", assign, replace });
    try {
      const { container } = renderWithIntl(<CompleteOnboarding />);
      // The snapshot already says step 3, so the page redirects up front (replace) before the BE 409 could ever matter;
      // the 409 handler (assign) is the fallback for a stale snapshot.
      await waitFor(() => expect(replace.mock.calls.length + assign.mock.calls.length).toBeGreaterThan(0));
      expect([...replace.mock.calls, ...assign.mock.calls].every(([to]) => to === "/ko/signup/profile")).toBe(true);
      expect(container.textContent).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("CompleteSignupLink", () => {
  it("opens external links in a new tab with noreferrer and keeps internal links locale-aware", () => {
    renderWithIntl(
      <>
        <CompleteSignupLink external href="https://discord.gg/x">Discord</CompleteSignupLink>
        <CompleteSignupLink href="/bounties">Bounties</CompleteSignupLink>
      </>,
    );
    const external = screen.getByRole("link", { name: "Discord" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noreferrer");
    expect(external.hasAttribute("data-locale-link")).toBe(false);
    const internal = screen.getByRole("link", { name: "Bounties" });
    expect(internal.getAttribute("target")).toBeNull();
    expect(internal.hasAttribute("data-locale-link")).toBe(true);
  });
});

describe("ApiKeyReveal", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  });

  const renderReveal = () =>
    renderWithIntl(<ApiKeyReveal apiKey="nl_secret_123" copy="Shown once." expiresLabel="Expires Jan 1, 2027" title="New API key issued" />);

  it("shows the key in a labelled read-only field and announces only that it is ready", () => {
    renderReveal();
    const input = screen.getByRole("textbox", { name: "New API key" }) as HTMLInputElement;
    expect(input.value).toBe("nl_secret_123");
    expect(input.readOnly).toBe(true);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("API key ready, copy it now.");
    expect(status.textContent).not.toContain("nl_secret_123");
    expect(screen.getByText("New API key issued")).toBeTruthy();
    expect(screen.getByText("Expires Jan 1, 2027")).toBeTruthy();
  });

  it("copies the key and announces success", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderReveal();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("API key copied to the clipboard."));
    expect(writeText).toHaveBeenCalledWith("nl_secret_123");
  });

  it("falls back to manual-copy guidance when the clipboard is missing or rejects", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const first = renderReveal();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Copying is unavailable here. Select the key and copy it manually."));
    first.unmount();

    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => Promise.reject(new Error("denied")) } });
    renderReveal();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/^Copying is unavailable/));
  });
});
