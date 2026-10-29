// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { StartLink } from "@/components/auth/StartLink";
import { AuthArea } from "@/components/layout/AuthArea";
import { SignupGate } from "@/components/signup/SignupGate";
import { SignupStepIndicator } from "@/components/signup/SignupStepIndicator";
import { resolveSignupAccess, resolveStartTarget, returnPathFromReferrer } from "@/lib/auth-route";
import { stripLocale } from "@/i18n/routing";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
const replace = vi.hoisted(() => vi.fn());
const flash = vi.hoisted(() => vi.fn());
const mode = vi.hoisted(() => ({ current: "api" as "api" | "mock" }));
vi.mock("@/lib/flash", () => ({ pushFlash: flash }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => mode.current,
  }));

const unfinished = (step: number) => signedInWith({ onboardingCompleted: false, onboardingStep: step });
const finished = signedInWith({ onboardingCompleted: true, profileSlug: "pelican" });

describe("resolveStartTarget (the one rule for where a user belongs)", () => {
  it.each([
    ["loading", loading, { kind: "checking" }],
    ["signed out", signedOut, { kind: "sign-up", href: "/signup" }],
    ["wallet step", unfinished(2), { kind: "resume", href: "/signup/wallet" }],
    ["profile step", unfinished(3), { kind: "resume", href: "/signup/profile" }],
    ["complete step", unfinished(4), { kind: "resume", href: "/signup/get-started" }],
    ["finished", finished, { kind: "member", href: "/members/pelican" }],
  ])("%s", (_name, snapshot, expected) => {
    expect(resolveStartTarget(snapshot)).toEqual(expected);
  });
});

describe("returnPathFromReferrer", () => {
  const go = (referrer: string) => returnPathFromReferrer(referrer, "https://app.test", stripLocale);
  it("returns the same-site page the visitor came from, without the locale", () => {
    expect(go("https://app.test/ko/bounties/x?tab=1")).toBe("/bounties/x?tab=1");
  });
  it("falls back to home for no referrer, another site, signup pages and the callback", () => {
    for (const referrer of ["", "not a url", "https://evil.test/ko/bounties", "https://app.test/ko/signup", "https://app.test/ko/signup/wallet", "https://app.test/ko/auth/callback"]) {
      expect(go(referrer)).toBe("/");
    }
  });
});

describe("resolveSignupAccess", () => {
  it.each([
    ["loading", loading, 1, { kind: "wait" }],
    ["loading", loading, 3, { kind: "wait" }],
    ["signed out, step 1", signedOut, 1, { kind: "show" }],
    ["signed out, step 2", signedOut, 2, { kind: "sign-in-first", href: "/signup" }],
    ["signed out, step 4", signedOut, 4, { kind: "sign-in-first", href: "/signup" }],
    ["owes wallet, step 1", unfinished(2), 1, { kind: "resume", href: "/signup/wallet" }],
    ["owes profile, step 1", unfinished(3), 1, { kind: "resume", href: "/signup/profile" }],
    ["owes profile, step 2", unfinished(3), 2, { kind: "show" }],
    ["owes profile, step 3", unfinished(3), 3, { kind: "show" }],
    ["finished, step 1", finished, 1, { kind: "leave" }],
    ["finished, step 2", finished, 2, { kind: "leave" }],
    ["finished, step 4", finished, 4, { kind: "leave" }],
  ] as const)("%s", (_name, snapshot, step, expected) => {
    expect(resolveSignupAccess(snapshot, step)).toEqual(expected);
  });
});

describe("signup pages follow the session", () => {
  const login = <SignupGate step={1}><button type="button">Continue with Google</button></SignupGate>;
  const stepTwo = <SignupGate step={2}><p>Wallet step</p></SignupGate>;
  const reset = () => { replace.mockClear(); flash.mockClear(); mode.current = "api"; };

  it("step 1 shows the login only when signed out", () => {
    reset();
    state.auth = signedOut;
    renderWithIntl(login);
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("shows neither the step nor a redirect while the session is still being restored", () => {
    reset();
    state.auth = loading;
    renderWithIntl(<>{login}{stepTwo}</>);
    expect(screen.queryByText("Continue with Google")).toBeNull();
    expect(screen.queryByText("Wallet step")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a finished user away from every signup step instead of asking them to log in again", async () => {
    for (const ui of [login, stepTwo]) {
      reset();
      state.auth = finished;
      const { unmount } = renderWithIntl(ui);
      expect(screen.queryByText("Continue with Google")).toBeNull();
      expect(screen.queryByText("Wallet step")).toBeNull();
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
      unmount();
    }
  });

  it("sends a user with an unfinished onboarding from step 1 to the step they owe", async () => {
    reset();
    state.auth = unfinished(3);
    renderWithIntl(login);
    expect(screen.queryByText("Continue with Google")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signup/profile"));
  });

  it("lets a user with an unfinished onboarding see steps 2-4", () => {
    reset();
    state.auth = unfinished(3);
    renderWithIntl(stepTwo);
    expect(screen.getByText("Wallet step")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor from step 2 back to step 1 with a message", async () => {
    reset();
    state.auth = signedOut;
    renderWithIntl(stepTwo);
    expect(screen.queryByText("Wallet step")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signup"));
    expect(flash).toHaveBeenCalledWith("signInRequired");
  });

  it("keeps steps 2-4 previewable signed out in mock mode", () => {
    reset();
    mode.current = "mock";
    state.auth = signedOut;
    renderWithIntl(stepTwo);
    expect(screen.getByText("Wallet step")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not bounce the user off the last step when onboarding completes while it is shown", () => {
    reset();
    state.auth = unfinished(4);
    const view = renderWithIntl(<SignupGate step={4}><p>Done</p></SignupGate>);
    expect(screen.getByText("Done")).toBeTruthy();
    state.auth = finished;
    view.rerender(<SignupGate step={4}><p>Done</p></SignupGate>);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the step (and what the user typed) when the session ends while it is shown", () => {
    reset();
    state.auth = unfinished(3);
    const step = () => <SignupGate step={3}><input aria-label="typed" /></SignupGate>;
    const view = renderWithIntl(step());
    expect(screen.getByLabelText("typed")).toBeTruthy();
    state.auth = { status: "signed-out", user: null, reason: "session-ended" };
    view.rerender(step());
    expect(screen.getByLabelText("typed")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(flash).not.toHaveBeenCalled();
  });

  it("leaves the step after a sign-out the user chose, without the sign-in-required message", async () => {
    reset();
    state.auth = unfinished(3);
    const step = () => <SignupGate step={3}><input aria-label="typed" /></SignupGate>;
    const view = renderWithIntl(step());
    expect(screen.getByLabelText("typed")).toBeTruthy();
    state.auth = signedOut;
    view.rerender(step());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signup"));
    expect(flash).not.toHaveBeenCalled();
  });

  it("stepper marks Login done and not current once signed in; step 1 is never a link", () => {
    state.auth = unfinished(3);
    const { unmount } = renderWithIntl(<SignupStepIndicator current={1} />);
    const first = screen.getAllByRole("listitem")[0]!;
    expect(first.getAttribute("data-done")).toBe("true");
    expect(first.getAttribute("aria-current")).toBeNull();
    expect(first.querySelector("a, button")).toBeNull();
    unmount();
    state.auth = signedOut;
    renderWithIntl(<SignupStepIndicator current={1} />);
    expect(screen.getAllByRole("listitem")[0]!.getAttribute("aria-current")).toBe("step");
  });
});

describe("Get started call to action", () => {
  const cta = <StartLink className="cta" memberLabel="My profile" resumeLabel="Continue sign-up" signUpLabel="Get Started" />;

  it("links signed-out visitors to signup", () => {
    state.auth = signedOut;
    render(cta);
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
  });

  it("continues at the owed step for an unfinished onboarding", () => {
    state.auth = unfinished(2);
    render(cta);
    expect(screen.getByRole("link", { name: "Continue sign-up" }).getAttribute("href")).toBe("/signup/wallet");
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  it("never offers Get Started to a finished user; it opens their profile", () => {
    state.auth = finished;
    render(cta);
    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("href")).toBe("/members/pelican");
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  it("offers no clickable sign-up link while the session is being restored", () => {
    state.auth = loading;
    render(cta);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("header: no Get Started link while loading, link when signed out, none when signed in", () => {
    state.auth = loading;
    const { unmount } = renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.queryByRole("link", { name: "Get Started" })).toBeNull();
    unmount();
    state.auth = signedOut;
    renderWithIntl(<AuthArea variant="desktop" />);
    expect(screen.getByRole("link", { name: "Get Started" })).toBeTruthy();
  });
});
