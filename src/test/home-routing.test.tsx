// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntroRedirect } from "@/components/auth/IntroRedirect";
import { HomeGate } from "@/components/home/HomeGate";
import { BrandLink } from "@/components/layout/BrandLink";
import { HomeHint } from "@/components/layout/HomeHint";
import { HOME_HINT_COOKIE, isFinishedUser, resolveBrandHref, resolveHomeAccess, resolveIntroAccess } from "@/lib/auth-route";
import { hasHomeHint, setHomeHint } from "@/lib/home-hint";
import { renderWithIntl } from "@/test/intl";
import { loading, signedIn, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown, mode: "api" as "api" | "mock" }));
const replace = vi.hoisted(() => vi.fn());
const hardNavigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/hard-navigate", () => ({ hardNavigate }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth, useFoundationMode: () => state.mode }));

const unfinished = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
const finished = signedInWith({ onboardingCompleted: true, profileSlug: "pelican" });

afterEach(() => {
  replace.mockReset();
  hardNavigate.mockReset();
  state.mode = "api";
  document.cookie = `${HOME_HINT_COOKIE}=; Path=/; Max-Age=0`;
});

describe("the home routing rule (lib/auth-route.ts)", () => {
  it("treats only a signed-in user with a finished onboarding as a finished user", () => {
    expect(isFinishedUser(finished)).toBe(true);
    for (const snapshot of [loading, signedOut, unfinished, signedIn]) expect(isFinishedUser(snapshot)).toBe(false);
  });

  it("sends the logo and the Intro to /home for a finished user only", () => {
    expect(resolveBrandHref(finished)).toBe("/home");
    for (const snapshot of [loading, signedOut, unfinished]) expect(resolveBrandHref(snapshot)).toBe("/");
    expect(resolveIntroAccess(finished)).toEqual({ kind: "home", href: "/home" });
    for (const snapshot of [loading, signedOut, unfinished]) expect(resolveIntroAccess(snapshot)).toEqual({ kind: "show" });
  });

  it.each([
    ["loading", loading, undefined, { kind: "wait" }],
    ["signed out", signedOut, undefined, { kind: "intro", href: "/" }],
    ["wallet step", signedInWith({ onboardingCompleted: false, onboardingStep: 2 }), undefined, { kind: "resume", href: "/signup/wallet" }],
    ["profile step", unfinished, undefined, { kind: "resume", href: "/signup/profile" }],
    ["finished", finished, undefined, { kind: "show" }],
    ["mock preview user without onboarding fields", signedIn, { preview: true }, { kind: "show" }],
  ])("home access: %s", (_name, snapshot, options, expected) => {
    expect(resolveHomeAccess(snapshot, options)).toEqual(expected);
  });
});

describe("home hint cookie", () => {
  it("is written and cleared, and HomeHint keeps it in step with the session without touching it while loading", () => {
    expect(hasHomeHint()).toBe(false);
    setHomeHint(true);
    expect(hasHomeHint()).toBe(true);
    setHomeHint(false);
    expect(hasHomeHint()).toBe(false);

    state.auth = loading;
    const { rerender } = render(<HomeHint />);
    expect(hasHomeHint()).toBe(false);
    state.auth = finished;
    rerender(<HomeHint />);
    expect(hasHomeHint()).toBe(true);
    state.auth = loading;
    rerender(<HomeHint />);
    expect(hasHomeHint(), "a session being restored must not clear the hint").toBe(true);
    state.auth = unfinished;
    rerender(<HomeHint />);
    expect(hasHomeHint()).toBe(false);
  });
});

describe("IntroRedirect", () => {
  it("replaces the route with /home for a finished user and does nothing for anyone else", () => {
    for (const snapshot of [loading, signedOut, unfinished]) {
      state.auth = snapshot;
      render(<IntroRedirect />);
    }
    expect(replace).not.toHaveBeenCalled();
    state.auth = finished;
    render(<IntroRedirect />);
    expect(replace).toHaveBeenCalledWith("/home");
  });
});

describe("BrandLink", () => {
  it("points at the Intro, then at the home once the finished user is known", () => {
    state.auth = loading;
    const { rerender } = render(<BrandLink className="x" label="Ninja Labs home">logo</BrandLink>);
    expect(screen.getByRole("link", { name: "Ninja Labs home" }).getAttribute("href")).toBe("/");
    state.auth = finished;
    rerender(<BrandLink className="x" label="Ninja Labs home">logo</BrandLink>);
    expect(screen.getByRole("link", { name: "Ninja Labs home" }).getAttribute("href")).toBe("/home");
  });
});

describe("HomeGate", () => {
  const gate = () => renderWithIntl(<HomeGate><p>secret home</p></HomeGate>);

  it("shows a neutral checking state while the session is restored, never the content", () => {
    state.auth = loading;
    gate();
    expect(screen.queryByText("secret home")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/Checking/);
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the content for a finished user", () => {
    state.auth = finished;
    gate();
    expect(screen.getByText("secret home")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the Intro and clears the hint so the proxy stops sending them back", () => {
    setHomeHint(true);
    state.auth = signedOut;
    gate();
    expect(screen.queryByText("secret home")).toBeNull();
    // A full load, not router.replace: a cached soft redirect to /home would keep the visitor on the placeholder.
    expect(hardNavigate).toHaveBeenCalledWith("/en");
    expect(replace).not.toHaveBeenCalled();
    expect(hasHomeHint()).toBe(false);
  });

  it("sends an unfinished sign-up to the step it owes", () => {
    state.auth = unfinished;
    gate();
    expect(replace).toHaveBeenCalledWith("/signup/profile");
    expect(screen.queryByText("secret home")).toBeNull();
  });

  it("keeps the home reviewable for the mock preview user (no onboarding fields)", () => {
    state.mode = "mock";
    state.auth = signedIn;
    gate();
    expect(screen.getByText("secret home")).toBeTruthy();
  });

  it("does not flash content when the session flips to signed-out", async () => {
    state.auth = finished;
    const view = gate();
    state.auth = signedOut;
    await act(async () => view.rerender(<HomeGate><p>secret home</p></HomeGate>));
    expect(screen.queryByText("secret home")).toBeNull();
  });
});
