// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { StartLink } from "@/components/auth/StartLink";
import { AuthArea } from "@/components/layout/AuthArea";
import { SignupEntryGate } from "@/components/signup/SignupEntryGate";
import { resolveStartTarget, returnPathFromReferrer } from "@/lib/auth-route";
import { stripLocale } from "@/i18n/routing";
import { renderWithIntl } from "@/test/intl";
import { loading, signedIn, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
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

describe("signup step 1 for a signed-in user", () => {
  const login = <SignupEntryGate><button type="button">Continue with Google</button></SignupEntryGate>;

  it("shows the login only when signed out", () => {
    state.auth = signedOut;
    renderWithIntl(login);
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("shows neither the login nor a redirect while the session is still being restored", () => {
    replace.mockClear();
    state.auth = loading;
    renderWithIntl(login);
    expect(screen.queryByText("Continue with Google")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a finished user home instead of asking them to log in again", async () => {
    replace.mockClear();
    state.auth = finished;
    renderWithIntl(login);
    expect(screen.queryByText("Continue with Google")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("sends a user with an unfinished onboarding to the step they owe", async () => {
    replace.mockClear();
    state.auth = unfinished(3);
    renderWithIntl(login);
    expect(screen.queryByText("Continue with Google")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signup/profile"));
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
